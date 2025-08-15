# 🚀 DevDigest - AI-Powered Tech News Aggregator

[![Live Demo](https://img.shields.io/badge/Live%20Demo-DevDigest-green?style=for-the-badge&logo=vercel)](https://dev-digest-ag.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?style=for-the-badge&logo=mongodb)](https://mongodb.com/)
[![AI](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-blue?style=for-the-badge&logo=google)](https://ai.google.dev/)

> **Live Demo**: [https://dev-digest-ag.vercel.app/](https://dev-digest-ag.vercel.app/)

A modern, AI-powered tech news aggregator that curates content from multiple sources including RSS feeds, Reddit communities, and tech APIs. Features intelligent content analysis, sentiment detection, and personalized insights using Google's Gemini AI.

## ✨ Features

### 🎯 **Core Functionality**
- **Multi-Source Aggregation**: RSS feeds, Reddit communities, Hacker News, Dev.to
- **AI-Powered Analysis**: Content summarization, sentiment analysis, topic extraction
- **Real-time Updates**: Automatic content refresh every 15 minutes
- **Smart Filtering**: Duplicate detection and content deduplication
- **Responsive Design**: Mobile-first, dark/light mode support

### 🤖 **AI Analysis Features**
- **Content Summarization**: AI-generated summaries of articles
- **Sentiment Analysis**: Positive/negative/neutral sentiment detection
- **Topic Extraction**: Automatic identification of key topics and themes
- **Reading Time Estimation**: AI-calculated reading time for articles
- **Target Audience Analysis**: Content difficulty and audience targeting
- **Trending Detection**: Identification of trending topics and discussions

### 🔍 **Search & Discovery**
- **Smart Search**: AI-powered semantic search across all content
- **Category Filtering**: Filter by technology, AI, startups, programming
- **Source Filtering**: Browse content by specific sources
- **Advanced Filters**: Date, popularity, and engagement-based filtering

### 💬 **Interactive Features**
- **AI Chat Assistant**: Ask questions about any article or topic
- **Content Analysis Popup**: Detailed insights for each article
- **Add Custom Sources**: Add your own RSS feeds and sources
- **Refresh Controls**: Manual and automatic content refresh

### 🎨 **User Experience**
- **Dark/Light Mode**: Toggle between themes
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Loading States**: Smooth loading animations and feedback
- **Error Handling**: Graceful error handling and user feedback
- **Accessibility**: WCAG compliant design

## 🛠️ Tech Stack

### **Frontend**
- **Next.js 14**: React framework with App Router
- **React 18**: Modern React with hooks and concurrent features
- **Tailwind CSS**: Utility-first CSS framework
- **JavaScript ES6+**: Modern JavaScript features

### **Backend & APIs**
- **Next.js API Routes**: Serverless API endpoints
- **MongoDB Atlas**: Cloud database for content storage
- **Google Gemini AI**: Advanced AI analysis and insights
- **Reddit API**: Reddit content integration
- **RSS Parser**: RSS feed processing

### **Deployment & Infrastructure**
- **Vercel**: Global edge deployment
- **MongoDB Atlas**: Cloud database hosting
- **GitHub**: Version control and CI/CD

## 🚀 Live Demo

**Visit the live application**: [https://dev-digest-ag.vercel.app/](https://dev-digest-ag.vercel.app/)

## 📦 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- MongoDB Atlas account
- Google Gemini API key

### 1. Clone the Repository
```bash
git clone https://github.com/var-dhairya/DevDigest.git
cd DevDigest
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory:

```bash
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# AI Analysis API
GOOGLE_API_KEY=your_google_api_key_here

# Reddit API (Optional)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=DevDigest/1.0.0

# Content Settings
CONTENT_REFRESH_INTERVAL=*/15 * * * *
MAX_CONTENT_PER_SOURCE=50
MAX_AI_REQUESTS_PER_MINUTE=15

# App Configuration
NEXT_PUBLIC_APP_NAME=DevDigest
```

### 4. Database Setup
```bash
npm run db:setup
```

### 5. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🌐 Deployment

### Vercel Deployment (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add environment variables in Vercel dashboard
   - Deploy!

### Manual Deployment
```bash
npm run build
npm start
```

## 📊 Content Sources

### **RSS Feeds**
- **TechCrunch**: Latest tech news and startup updates
- **VentureBeat**: AI and business technology news
- **MIT Technology Review**: Deep tech insights
- **AI News**: Artificial intelligence developments
- **Dev.to**: Developer community content

### **Reddit Communities**
- **r/startups**: Startup discussions and advice
- **r/entrepreneur**: Entrepreneurship content
- **r/MachineLearning**: AI and ML research
- **r/programming**: Programming discussions
- **r/javascript**: JavaScript ecosystem
- **r/Python**: Python programming
- **r/reactjs**: React framework discussions
- **r/webdev**: Web development content

### **APIs**
- **Hacker News**: Tech news and discussions
- **Dev.to API**: Developer articles and tutorials

## 🔧 API Endpoints

### **Content Management**
- `GET /api/content` - Fetch paginated content
- `POST /api/refresh` - Trigger content refresh
- `GET /api/sources` - Get all content sources

### **AI Analysis**
- `POST /api/content/[id]/analyze` - Analyze specific content
- `POST /api/search` - AI-powered search

### **Source Management**
- `POST /api/sources` - Add new content source
- `GET /api/aggregate` - Get aggregation status

## 🎯 Key Features Explained

### **AI Content Analysis**
Each article is automatically analyzed using Google's Gemini AI to provide:
- **Summary**: Concise article summary
- **Sentiment**: Positive/negative/neutral analysis
- **Topics**: Key themes and topics discussed
- **Reading Time**: Estimated reading duration
- **Target Audience**: Content difficulty and audience

### **Smart Content Aggregation**
- **Duplicate Detection**: Prevents duplicate content across sources
- **Content Enrichment**: Fetches full article content when available
- **Metadata Extraction**: Extracts images, reading time, and engagement metrics
- **Source Prioritization**: Intelligent content ranking

### **Real-time Updates**
- **Automatic Refresh**: Content updates every 15 minutes
- **Manual Refresh**: User-triggered content updates
- **Incremental Updates**: Only fetches new content
- **Background Processing**: Non-blocking content updates

## 🎨 UI/UX Features

### **Responsive Design**
- **Mobile-First**: Optimized for mobile devices
- **Tablet Support**: Responsive design for tablets
- **Desktop Experience**: Enhanced desktop interface

### **Dark/Light Mode**
- **Theme Toggle**: Easy switching between themes
- **System Preference**: Automatic theme detection
- **Persistent Settings**: Remembers user preference

### **Loading States**
- **Skeleton Loading**: Content placeholders
- **Progress Indicators**: Loading animations
- **Error States**: Graceful error handling

## 🔒 Security & Performance

### **Security Features**
- **Environment Variables**: Secure API key management
- **Input Validation**: Sanitized user inputs
- **Rate Limiting**: API request throttling
- **CORS Protection**: Cross-origin request security

### **Performance Optimizations**
- **Static Generation**: Pre-rendered pages
- **Image Optimization**: Next.js image optimization
- **Bundle Optimization**: Code splitting and tree shaking
- **CDN Delivery**: Global edge network

## 📈 Monitoring & Analytics

### **Built-in Monitoring**
- **Error Tracking**: Automatic error logging
- **Performance Metrics**: Response time monitoring
- **Usage Analytics**: Content engagement tracking

### **Vercel Analytics**
- **Page Views**: Traffic analytics
- **Function Performance**: API response times
- **Error Rates**: Error monitoring and alerting

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Gemini AI**: For advanced content analysis capabilities
- **Vercel**: For seamless deployment and hosting
- **MongoDB Atlas**: For reliable cloud database hosting
- **Next.js Team**: For the amazing React framework
- **Tailwind CSS**: For the utility-first CSS framework

## 📞 Support

- **Live Demo**: [https://dev-digest-ag.vercel.app/](https://dev-digest-ag.vercel.app/)
- **GitHub Issues**: [Report bugs or request features](https://github.com/var-dhairya/DevDigest/issues)
- **Documentation**: See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment guide

## 🚀 Roadmap

### **Planned Features**
- [ ] **User Authentication**: User accounts and preferences
- [ ] **Personalized Feeds**: Custom content recommendations
- [ ] **Email Newsletters**: Daily/weekly digest emails
- [ ] **Mobile App**: React Native mobile application
- [ ] **Advanced Analytics**: Detailed content analytics
- [ ] **Social Sharing**: Enhanced social media integration
- [ ] **Content Curation**: Manual content curation tools
- [ ] **API Documentation**: Public API for developers

### **Technical Improvements**
- [ ] **Caching Layer**: Redis caching for improved performance
- [ ] **Search Optimization**: Elasticsearch integration
- [ ] **Real-time Updates**: WebSocket connections
- [ ] **PWA Support**: Progressive Web App features
- [ ] **Internationalization**: Multi-language support

---

**⭐ Star this repository if you found it helpful!**

**Made with ❤️ by [Dhairya](https://github.com/var-dhairya)** 