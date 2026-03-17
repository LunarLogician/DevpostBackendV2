# DevPost AI Backend

AI-powered LinkedIn content engine for developers.

## 🚀 Quick Deploy to Railway

### Step 1: Deploy from GitHub
1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select **`LunarLogician/DevpostBackend`**
4. Railway will automatically detect the Node.js app and start building

### Step 2: Add Environment Variables
After deployment starts, click on your service, then go to the **"Variables"** tab and add these:

```bash
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb+srv://your-username:your-password@cluster.mongodb.net/devpost-ai
JWT_SECRET=your_super_secret_jwt_key_here
N8N_WEBHOOK_URL=https://your-n8n-webhook-url
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=https://your-railway-domain.up.railway.app/api/linkedin/callback
CLIENT_URL=https://your-frontend-url.com
```

### Step 3: Get Your Railway URL
1. Go to **"Settings"** tab in your Railway service
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"** to get a public URL like: `your-app.up.railway.app`
4. Copy this URL

### Step 4: Update Environment Variables
1. Go back to **"Variables"** tab
2. Update `LINKEDIN_REDIRECT_URI` with your Railway URL:
   ```
   LINKEDIN_REDIRECT_URI=https://your-railway-domain.up.railway.app/api/linkedin/callback
   ```
3. Save and redeploy

### Step 5: Update LinkedIn OAuth Settings
1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
2. Select your app
3. Go to **"Auth"** tab
4. Add your Railway redirect URI to **"Authorized redirect URLs for your app"**:
   ```
   https://your-railway-domain.up.railway.app/api/linkedin/callback
   ```

## 🔧 Local Development

1. Clone the repository:
```bash
git clone https://github.com/LunarLogician/DevpostBackend.git
cd DevpostBackend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Update `.env` with your credentials

5. Run development server:
```bash
npm run dev
```

Server will run on `http://localhost:5000`

## 📝 API Endpoints

### Health Check
```
GET /api/health
```

### Authentication
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Posts
```
GET    /api/posts
POST   /api/posts
GET    /api/posts/:id
PUT    /api/posts/:id
DELETE /api/posts/:id
```

### LinkedIn Integration
```
GET  /api/linkedin/auth
GET  /api/linkedin/callback
POST /api/linkedin/post
GET  /api/linkedin/profile
```

## 🛠️ Tech Stack

- **Node.js** + **Express.js**
- **MongoDB** + **Mongoose**
- **JWT** Authentication
- **LinkedIn OAuth 2.0**
- **OpenAI API** Integration
- **Security**: Helmet, CORS, Rate Limiting

## 📦 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `NODE_ENV` | Environment (development/production) | Yes |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth Client ID | Yes |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth Client Secret | Yes |
| `LINKEDIN_REDIRECT_URI` | OAuth callback URL | Yes |
| `CLIENT_URL` | Frontend URL for CORS | Yes |
| `N8N_WEBHOOK_URL` | N8N webhook endpoint | Yes |

## 🔒 Security Notes

- Never commit `.env` or `.env.production` files
- Use strong JWT secrets in production
- Keep LinkedIn OAuth credentials secure
- Use MongoDB Atlas IP whitelist or VPN

## 📄 License

ISC
# DevpostBackendV2
