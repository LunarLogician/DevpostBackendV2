import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import compression from 'compression';
import authRoutes from './routes/authRoutes.js';
import postRoutes from './routes/postRoutes.js';
import linkedinRoutes from './routes/linkedinRoutes.js';
import lemonsqueezyRoutes from './routes/lemonsqueezyRoutes.js';

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Trust Railway's proxy (fixes rate-limit X-Forwarded-For warning)
if (isProduction) {
  app.set('trust proxy', 1);
}

// Security Middleware
app.use(helmet());

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://devpostfe.vercel.app',
  'https://devpost-a-ifrontend.vercel.app',
  'https://devpost-a-ifrontend-gjn2iy8dz.vercel.app/',
  'https://devpost-a-ifrontend.vercel.app/dashboard',
  'https://devpost-a-ifrontend.vercel.app/',
  '*',
  process.env.CLIENT_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || isProduction) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Logging
if (isProduction) {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Compression
app.use(compression());

// Lemon Squeezy webhook route (BEFORE body parser to access raw body)
app.post(
  '/api/lemonsqueezy/webhook',
  express.raw({ type: 'application/json' }),
  (await import('./controllers/lemonsqueezyController.js')).handleWebhook
);

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database Connection
const mongoOptions = {
  serverSelectionTimeoutMS: 30000, // 30 seconds (increased from 5)
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000, // Add connection timeout
  family: 4 // Force IPv4 (sometimes faster)
};

mongoose.connect(process.env.MONGODB_URI, mongoOptions)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  });

// Mongoose connection event handlers
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/linkedin', linkedinRoutes);
app.use('/api/lemonsqueezy', lemonsqueezyRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'DevPost AI Server is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong!';
  
  res.status(statusCode).json({ 
    success: false, 
    message: isProduction ? 'Internal server error' : message,
    error: isProduction ? undefined : err.message,
    stack: isProduction ? undefined : err.stack
  });
});

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Only listen if not in Vercel (serverless) environment
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// Export app for Vercel
export default app;
