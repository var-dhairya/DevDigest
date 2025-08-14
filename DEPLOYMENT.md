# 🚀 DevDigest Vercel Deployment Guide

## 📋 Prerequisites

- [Vercel Account](https://vercel.com/signup)
- [GitHub/GitLab Repository](https://github.com) with your DevDigest code
- MongoDB Atlas database (for production)
- Google Gemini API key

## 🔧 Environment Variables Setup

### 1. In Vercel Dashboard:
Go to your project → Settings → Environment Variables and add:

```bash
# Required
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
GOOGLE_API_KEY=your_google_api_key_here

# Optional (for enhanced Reddit features)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=DevDigest/1.0.0
REDDIT_REDIRECT_URI_PRODUCTION=https://your-app-name.vercel.app/api/auth/callback
REDDIT_REDIRECT_URI_DEVELOPMENT=http://localhost:3000/api/auth/callback

# Content Settings
CONTENT_REFRESH_INTERVAL=*/15 * * * *
MAX_CONTENT_PER_SOURCE=50
MAX_AI_REQUESTS_PER_MINUTE=15

# App Configuration
NEXT_PUBLIC_APP_NAME=DevDigest
```

### 2. Environment Variable Details:

- **MONGODB_URI**: Your MongoDB Atlas connection string
- **GOOGLE_API_KEY**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **REDDIT_***: Optional, for enhanced Reddit content (get from [Reddit Apps](https://www.reddit.com/prefs/apps))

## 🚀 Deployment Steps

### Method 1: Vercel CLI (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel --prod
   ```

### Method 2: GitHub Integration

1. **Connect Repository:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Build Settings:**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

3. **Deploy:**
   - Click "Deploy"
   - Vercel will automatically build and deploy

## ⚙️ Build Configuration

### Build Settings:
- **Node.js Version**: 18.x or higher
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### Function Settings:
- **Max Duration**: 30 seconds (for API routes)
- **Memory**: 1024 MB (default)

## 🔍 Post-Deployment Checklist

### 1. Test Core Features:
- ✅ Homepage loads
- ✅ Content feed displays
- ✅ AI analysis works
- ✅ Search functionality
- ✅ Add source form

### 2. Check API Routes:
- ✅ `/api/content` - Content fetching
- ✅ `/api/sources` - Source management
- `/api/refresh` - Content refresh
- `/api/analysis` - AI analysis
- `/api/search` - Search functionality

### 3. Verify Environment:
- ✅ Database connection
- ✅ Google API integration
- ✅ Reddit API (if configured)

## 🐛 Troubleshooting

### Common Issues:

1. **Build Failures:**
   - Check Node.js version (18+ required)
   - Verify all dependencies are in package.json
   - Check for syntax errors

2. **Environment Variables:**
   - Ensure all required vars are set in Vercel
   - Check variable names match exactly
   - Verify API keys are valid

3. **Database Connection:**
   - Check MongoDB Atlas network access
   - Verify connection string format
   - Ensure database user has proper permissions

4. **API Rate Limits:**
   - Monitor Google API usage
   - Check Reddit API limits
   - Implement proper error handling

## 📊 Monitoring

### Vercel Analytics:
- Page views and performance
- Function execution times
- Error rates and logs

### Custom Monitoring:
- Database connection status
- API response times
- Content refresh success rates

## 🔄 Continuous Deployment

### Automatic Deploys:
- Push to `main` branch triggers production deploy
- Push to other branches creates preview deployments
- Pull requests generate preview URLs

### Manual Deploys:
```bash
vercel --prod
```

## 📈 Performance Optimization

### Vercel Features:
- Edge Network (global CDN)
- Automatic HTTPS
- Image optimization
- Function optimization

### Next.js Features:
- Static generation
- Incremental static regeneration
- API route optimization
- Bundle optimization

## 🆘 Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)

---

**🎉 Your DevDigest app is now ready for production deployment on Vercel!** 