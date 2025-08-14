# DevDigest 🚀

A modern tech feed aggregator that curates and analyzes technology content from multiple sources using AI-powered insights.

## 📋 Project Overview

DevDigest is a comprehensive tech news aggregator that automatically collects content from various tech sources, analyzes it using Google's Gemini AI API, and presents it in an engaging card-based interface. Perfect for developers, tech enthusiasts, and anyone looking to stay updated with the latest in technology.

## 🎯 Project Goals

- **Content Aggregation**: Automatically collect startup and AI content from 20+ free sources
- **AI-Powered Analysis**: Use Gemini API for content summarization, sentiment analysis, and categorization
- **Modern UI/UX**: Beautiful, responsive interface with infinite scroll and filtering
- **Portfolio Showcase**: Demonstrate full-stack development skills for job applications
- **100% Free**: No paid APIs or subscriptions required - completely cost-free

## 🏗️ Technical Architecture

```
Next.js App (Port 3000)
├── Frontend (app/page.js, components/)
├── Backend API (app/api/*/route.js)
├── Content Aggregator Service
├── Gemini AI Analysis Service
└── Database (MongoDB)
```

## 🚀 Features

### Phase 1: MVP (Weeks 1-3)
- [ ] Content aggregation from Reddit tech subreddits
- [ ] Basic card-based UI with infinite scroll
- [ ] Gemini API integration for content analysis
- [ ] Content storage and retrieval
- [ ] Basic filtering and search

### Phase 2: Enhanced Features (Weeks 4-6)
- [ ] RSS feed integration from tech blogs
- [ ] Advanced AI analysis (difficulty, reading time, quality score)
- [ ] User preferences and content categorization
- [ ] Content recommendation system
- [ ] Performance optimization

### Phase 3: Polish & Deploy (Weeks 7-8)
- [ ] Advanced filtering and search
- [ ] Caching strategies
- [ ] Error handling and fallbacks
- [ ] Deployment and monitoring
- [ ] Documentation and testing

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + Next.js 14
- **Styling**: Tailwind CSS + Framer Motion
- **State Management**: Zustand or React Context
- **UI Components**: Headless UI + Radix UI

### Backend
- **Runtime**: Next.js API Routes (built-in)
- **Database**: MongoDB Atlas (production)
- **Content Processing**: Cheerio, RSS-parser
- **AI Integration**: Google Gemini API

### Infrastructure
- **Hosting**: Vercel (full-stack deployment)
- **Database**: MongoDB Atlas (free tier)
- **Monitoring**: Basic logging and error tracking

## 📊 AI Analysis Features

### Gemini API Integration
- **Content Summarization**: Generate 2-3 sentence summaries
- **Sentiment Analysis**: Positive/Negative/Neutral classification
- **Content Categorization**: AI, Web Dev, Mobile, DevOps, etc.
- **Difficulty Assessment**: Beginner/Intermediate/Advanced
- **Reading Time Estimation**: Based on content length and complexity
- **Key Technology Identification**: Extract main technologies mentioned

### Cost Optimization
- **Free Tier**: 15 requests/minute (900/hour)
- **Smart Batching**: Process multiple articles together
- **Caching**: Store AI results to avoid re-processing
- **Fallback Strategy**: Graceful degradation when API fails

## 🔄 Content Sources (All Free!)

### Primary Sources
- **Reddit**: r/startups, r/entrepreneur, r/indiehackers, r/MachineLearning, r/datascience, r/programming, r/webdev, r/javascript, r/reactjs, r/node
- **RSS Feeds**: TechCrunch, VentureBeat, MIT Technology Review, Ars Technica, The Verge, Wired, Fast Company
- **Free APIs**: Hacker News API, Dev.to API, Indie Hackers API
- **Total Sources**: 25+ high-quality, free content sources covering startups, AI, and programming

### Content Types
- Articles, tutorials, news, discussions, project showcases
- Filtering for quality and relevance
- Deduplication across sources

## 📱 User Interface

### Design Principles
- **Modern & Clean**: Minimalist design with focus on content
- **Responsive**: Mobile-first approach
- **Accessible**: WCAG 2.1 AA compliance
- **Fast**: Optimized for performance

### UI Components
- **Content Cards**: Rich previews with AI insights
- **Infinite Scroll**: Smooth content loading
- **Filtering**: Category, sentiment, difficulty filters
- **Search**: Full-text search across content
- **Dark/Light Mode**: Theme switching capability

## 🗄️ Database Schema

### Content Table
```sql
content {
  id: UUID (Primary Key)
  title: String
  url: String
  source: String
  publishedAt: DateTime
  summary: String (AI-generated)
  sentiment: String (AI-analyzed)
  category: String (AI-categorized)
  difficulty: String (AI-assessed)
  readingTime: Integer (AI-estimated)
  technologies: Array (AI-extracted)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Sources Table
```sql
sources {
  id: UUID (Primary Key)
  name: String
  type: String (reddit, rss, api)
  url: String
  isActive: Boolean
  lastFetched: DateTime
  createdAt: DateTime
}
```

## 🔧 Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Git
- Google Cloud account (for Gemini API)

### Environment Variables
```env
# Gemini API
GOOGLE_API_KEY=your_gemini_api_key

# Database
DATABASE_URL=your_database_connection_string

# Reddit API (optional)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret

# Server
PORT=3000
NODE_ENV=development
```

### Installation
```bash
# Clone repository
git clone https://github.com/yourusername/devdigest.git
cd devdigest

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

## 📈 Progress Tracking

### Week 1-2: Foundation
- [x] Project setup and configuration
- [x] Next.js full-stack application
- [x] Modern UI with component architecture
- [x] Database models and API routes
- [x] Content aggregation service
- [x] Reddit API integration
- [x] Gemini AI analysis integration

### Week 3-4: Core Features
- [x] Content aggregation pipeline
- [x] Gemini API integration
- [x] Content display components
- [x] Admin panel for service management
- [ ] RSS feed integration
- [ ] Advanced filtering and search

### Week 5-6: Enhancement
- [ ] RSS feed integration
- [ ] Advanced AI features
- [ ] UI/UX improvements
- [ ] Performance optimization

### Week 7-8: Polish
- [ ] Testing and bug fixes
- [ ] Deployment setup
- [ ] Documentation
- [ ] Final touches

## 🚀 Deployment Strategy

### Frontend (Vercel)
- Automatic deployment from main branch
- Environment variable configuration
- Performance monitoring

### Backend (Next.js API Routes)
- Built-in API routes
- Serverless functions
- Automatic scaling

### Database (MongoDB Atlas)
- Free tier for development
- Automatic backups
- Performance monitoring

## 🧪 Testing Strategy

### Unit Tests
- API endpoint testing
- Content processing logic
- AI integration testing

### Integration Tests
- End-to-end content flow
- Database operations
- API integrations

### Performance Tests
- Content loading speed
- API response times
- Database query optimization

## 📚 API Documentation

### Content Endpoints
- `GET /api/content` - Fetch paginated content
- `GET /api/content/:id` - Get specific content
- `POST /api/content/refresh` - Trigger content refresh
- `GET /api/categories` - Get available categories

### Analysis Endpoints
- `POST /api/analyze` - Analyze new content
- `GET /api/sentiments` - Get sentiment distribution
- `GET /api/trends` - Get trending topics

## 🔍 Monitoring & Analytics

### Performance Metrics
- API response times
- Content processing speed
- AI analysis accuracy
- User engagement metrics

### Error Tracking
- API failures
- Content processing errors
- Database connection issues
- User-reported problems

## 🎯 Success Metrics

### Technical Metrics
- Content refresh time < 5 minutes
- API response time < 200ms
- 99% uptime
- Zero data loss

### User Experience Metrics
- Page load time < 2 seconds
- Smooth infinite scroll
- Accurate content categorization
- Helpful AI insights

## 🚧 Known Limitations

### API Constraints
- Reddit API rate limits (1000 requests/hour)
- Gemini API rate limits (15 requests/minute)
- RSS feed update frequency

### Content Quality
- Manual review may be needed for edge cases
- AI analysis accuracy depends on content quality
- Some sources may have inconsistent formatting

## 🔮 Future Enhancements

### Phase 4+ Ideas
- User accounts and personalization
- Content bookmarking and sharing
- Newsletter generation
- Mobile app development
- Advanced analytics dashboard
- Content recommendation engine
- Social features and discussions

## 📝 Contributing

This is a portfolio project, but contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 👨‍💻 Author

Built as a portfolio project to demonstrate full-stack development skills.

---

**Last Updated**: [Current Date]
**Project Status**: 🚧 In Development
**Next Milestone**: Project setup and basic server configuration 