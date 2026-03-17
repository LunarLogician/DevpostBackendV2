import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  plan: {
    type: String,
    enum: ['free', 'starter', 'pro'],
    default: 'free'
  },
  postsGenerated: {
    type: Number,
    default: 0
  },
  monthlyPostsCount: {
    type: Number,
    default: 0
  },
  lastResetDate: {
    type: Date,
    default: Date.now
  },
  // Lemon Squeezy subscription fields
  lemonSqueezyCustomerId: {
    type: String,
    default: null
  },
  lemonSqueezySubscriptionId: {
    type: String,
    default: null
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'on_trial', 'paused', 'past_due', null],
    default: null
  },
  subscriptionEndDate: {
    type: Date,
    default: null
  },
  subscriptionVariantId: {
    type: String,
    default: null
  },
  linkedinAccessToken: {
    type: String,
    default: null
  },
  linkedinRefreshToken: {
    type: String,
    default: null
  },
  linkedinTokenExpiry: {
    type: Date,
    default: null
  },
  linkedinUserId: {
    type: String,
    default: null
  },
  autoPostToLinkedIn: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationOTP: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  otpAttempts: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user can generate post based on plan limits
userSchema.methods.canGeneratePost = function() {
  // Pro plan has unlimited posts
  if (this.plan === 'pro') return true;
  
  // Reset monthly count if it's a new month
  const now = new Date();
  const lastReset = new Date(this.lastResetDate);
  
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.monthlyPostsCount = 0;
    this.lastResetDate = now;
  }
  
  // Check limits based on plan
  const limits = {
    free: 5,
    starter: 20,
    pro: 50
  };
  
  const limit = limits[this.plan] || 5;
  return this.monthlyPostsCount < limit;
};

const User = mongoose.model('User', userSchema);

export default User;
