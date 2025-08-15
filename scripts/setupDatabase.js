import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '..', '.env.local') })

import { connectDB } from '../lib/database.js'
import Source from '../models/Source.js'
import Content from '../models/Content.js'

// Default content sources - All FREE, no paid APIs
const defaultSources = [
  // Reddit Communities (Free - No API Key Required)
  {
    name: 'Reddit - Startups',
    type: 'reddit',
    url: 'https://www.reddit.com/r/startups/',
    description: 'Reddit startup community discussions and ideas',
    category: 'Startups',
    priority: 1,
    config: {
      subreddit: 'startups',
      sortBy: 'hot',
      timeFilter: 'day'
    },
    filters: {
      includeKeywords: ['startup', 'entrepreneur', 'business', 'funding', 'growth', 'product'],
      excludeKeywords: ['meme', 'joke', 'funny', 'spam'],
      minWordCount: 50
    }
  },
  {
    name: 'Reddit - Entrepreneurship',
    type: 'reddit',
    url: 'https://www.reddit.com/r/entrepreneur/',
    description: 'Reddit entrepreneurship community content',
    category: 'Entrepreneurship',
    priority: 2,
    config: {
      subreddit: 'entrepreneur',
      sortBy: 'hot',
      timeFilter: 'day'
    },
    filters: {
      includeKeywords: ['entrepreneur', 'business', 'startup', 'success', 'strategy', 'marketing'],
      excludeKeywords: ['meme', 'joke', 'funny', 'spam'],
      minWordCount: 50
    }
  },
  {
    name: 'Reddit - Indie Hackers',
    type: 'reddit',
    url: 'https://www.reddit.com/r/indiehackers/',
    description: 'Reddit indie hacker projects and discussions',
    category: 'Indie Hacking',
    priority: 3,
    config: {
      subreddit: 'indiehackers',
      sortBy: 'hot',
      timeFilter: 'day'
    },
    filters: {
      includeKeywords: ['indie', 'hacker', 'project', 'saas', 'product', 'launch'],
      excludeKeywords: ['meme', 'joke', 'funny', 'spam'],
      minWordCount: 50
    }
  },
  {
    name: 'Reddit - AI/ML',
    type: 'reddit',
    url: 'https://www.reddit.com/r/MachineLearning/',
    description: 'Reddit machine learning and AI community',
    category: 'AI/ML',
    priority: 4,
    config: {
      subreddit: 'MachineLearning',
      sortBy: 'hot',
      timeFilter: 'day'
    },
    filters: {
      includeKeywords: ['ai', 'machine learning', 'deep learning', 'neural network', 'data science'],
      excludeKeywords: ['meme', 'joke', 'funny', 'spam'],
      minWordCount: 50
    }
  },
  {
    name: 'Reddit - Programming',
    type: 'reddit',
    url: 'https://www.reddit.com/r/programming/',
    description: 'Reddit programming community posts',
    category: 'Programming',
    priority: 5,
    config: {
      subreddit: 'programming',
      sortBy: 'hot',
      timeFilter: 'day'
    },
    filters: {
      includeKeywords: ['javascript', 'python', 'react', 'node', 'web', 'development'],
      excludeKeywords: ['meme', 'joke', 'funny', 'spam'],
      minWordCount: 50
    }
  },
  {
    name: 'Reddit - JavaScript',
    type: 'reddit',
    url: 'https://www.reddit.com/r/javascript/',
    description: 'Reddit JavaScript community posts',
    category: 'JavaScript',
    priority: 6,
    config: {
      subreddit: 'javascript',
      sortBy: 'hot',
      timeFilter: 'day'
    },
    filters: {
      includeKeywords: ['javascript', 'es6', 'react', 'node', 'typescript'],
      excludeKeywords: ['meme', 'joke', 'funny', 'spam'],
      minWordCount: 50
    }
  },
  {
    name: 'Reddit - Web Development',
    type: 'reddit',
    url: 'https://www.reddit.com/r/webdev/',
    description: 'Reddit web development community posts',
    category: 'Web Development',
    priority: 7,
    config: {
      subreddit: 'webdev',
      sortBy: 'hot',
      timeFilter: 'day'
    },
    filters: {
      includeKeywords: ['javascript', 'react', 'vue', 'angular', 'css', 'html'],
      excludeKeywords: ['meme', 'joke', 'funny', 'spam'],
      minWordCount: 50
    }
  },
  {
    name: 'Reddit - Python',
    type: 'reddit',
    url: 'https://www.reddit.com/r/Python/',
    description: 'Reddit Python community posts',
    category: 'Python',
    priority: 8,
    config: {
      subreddit: 'Python',
      sortBy: 'hot',
      timeFilter: 'day'
    },
    filters: {
      includeKeywords: ['python', 'django', 'flask', 'data', 'machine learning', 'ai'],
      excludeKeywords: ['meme', 'joke', 'funny', 'spam'],
      minWordCount: 50
    }
  },
  {
    name: 'Reddit - Data Science',
    type: 'reddit',
    url: 'https://www.reddit.com/r/datascience/',
    description: 'Reddit data science community',
    category: 'Data Science',
    priority: 9,
    config: {
      subreddit: 'datascience',
      sortBy: 'hot',
      timeFilter: 'day'
    },
    filters: {
      includeKeywords: ['data science', 'machine learning', 'ai', 'analytics', 'statistics'],
      excludeKeywords: ['meme', 'joke', 'funny', 'spam'],
      minWordCount: 50
    }
  },
  {
    name: 'Reddit - React',
    type: 'reddit',
    url: 'https://www.reddit.com/r/reactjs/',
    description: 'Reddit React community posts',
    category: 'Frontend Development',
    priority: 10,
    config: {
      subreddit: 'reactjs',
      sortBy: 'hot',
      timeFilter: 'day'
    },
    filters: {
      includeKeywords: ['react', 'javascript', 'frontend', 'web', 'development'],
      excludeKeywords: ['meme', 'joke', 'funny', 'spam'],
      minWordCount: 50
    }
  },
  {
    name: 'Reddit - Node.js',
    type: 'reddit',
    url: 'https://www.reddit.com/r/node/',
    description: 'Reddit Node.js community posts',
    category: 'Backend Development',
    priority: 10,
    config: {
      subreddit: 'node',
      sortBy: 'hot',
      timeFilter: 'day'
    },
    filters: {
      includeKeywords: ['node', 'javascript', 'backend', 'server', 'development'],
      excludeKeywords: ['meme', 'joke', 'funny', 'spam'],
      minWordCount: 50
    }
  },

  // Free APIs (No API Key Required)
  {
    name: 'Hacker News',
    type: 'api',
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    description: 'Hacker News top stories - free API',
    category: 'Technology News',
    priority: 9,
    config: {
      url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
      headers: {}
    },
    filters: {
      includeKeywords: ['startup', 'ai', 'programming', 'technology', 'software', 'development'],
      minWordCount: 100
    }
  },
  {
    name: 'Dev.to',
    type: 'api',
    url: 'https://dev.to/api/articles',
    description: 'Dev.to articles - free API',
    category: 'Development',
    priority: 8,
    config: {
      url: 'https://dev.to/api/articles?tag=startup&top=1&per_page=20',
      headers: {
        'Accept': 'application/json'
      }
    },
    filters: {
      includeKeywords: ['startup', 'ai', 'javascript', 'react', 'web', 'development'],
      minWordCount: 200
    }
  },
  {
    name: 'Indie Hackers',
    type: 'api',
    url: 'https://indiehackers.com/api',
    description: 'Indie Hackers projects - free API',
    category: 'Indie Hacking',
    priority: 7,
    config: {
      url: 'https://indiehackers.com/api/projects',
      headers: {}
    },
    filters: {
      includeKeywords: ['indie', 'hacker', 'startup', 'saas', 'product'],
      minWordCount: 100
    }
  },

  // RSS Feeds (Free - No API Key Required)
  {
    name: 'TechCrunch RSS',
    type: 'rss',
    url: 'https://techcrunch.com/feed/',
    description: 'TechCrunch startup and tech news RSS feed',
    category: 'Startup News',
    priority: 6,
    config: {
      rssParser: 'default'
    },
    filters: {
      includeKeywords: ['startup', 'funding', 'ai', 'tech', 'entrepreneur'],
      excludeKeywords: ['spam', 'advertisement'],
      minWordCount: 150
    }
  },
  {
    name: 'VentureBeat RSS',
    type: 'rss',
    url: 'https://venturebeat.com/feed/',
    description: 'VentureBeat startup and tech news RSS feed',
    category: 'Startup News',
    priority: 5,
    config: {
      rssParser: 'default'
    },
    filters: {
      includeKeywords: ['startup', 'venture', 'ai', 'tech', 'funding'],
      excludeKeywords: ['spam', 'advertisement'],
      minWordCount: 150
    }
  },
  {
    name: 'AI News RSS',
    type: 'rss',
    url: 'https://www.artificialintelligence-news.com/feed/',
    description: 'AI News RSS feed for artificial intelligence updates',
    category: 'AI News',
    priority: 4,
    config: {
      rssParser: 'default'
    },
    filters: {
      includeKeywords: ['ai', 'artificial intelligence', 'machine learning', 'deep learning'],
      excludeKeywords: ['spam', 'advertisement'],
      minWordCount: 150
    }
  },
  {
    name: 'MIT Technology Review RSS',
    type: 'rss',
    url: 'https://www.technologyreview.com/feed/',
    description: 'MIT Technology Review RSS feed',
    category: 'Technology News',
    priority: 3,
    config: {
      rssParser: 'default'
    },
    filters: {
      includeKeywords: ['ai', 'startup', 'technology', 'innovation', 'research'],
      excludeKeywords: ['spam', 'advertisement'],
      minWordCount: 150
    }
  },
  {
    name: 'Ars Technica RSS',
    type: 'rss',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    description: 'Ars Technica technology news RSS feed',
    category: 'Technology News',
    priority: 2,
    config: {
      rssParser: 'default'
    },
    filters: {
      includeKeywords: ['ai', 'startup', 'technology', 'innovation', 'science'],
      excludeKeywords: ['spam', 'advertisement'],
      minWordCount: 150
    }
  },
  {
    name: 'The Verge RSS',
    type: 'rss',
    url: 'https://www.theverge.com/rss/index.xml',
    description: 'The Verge technology news RSS feed',
    category: 'Technology News',
    priority: 1,
    config: {
      rssParser: 'default'
    },
    filters: {
      includeKeywords: ['ai', 'startup', 'technology', 'innovation', 'product'],
      excludeKeywords: ['spam', 'advertisement'],
      minWordCount: 150
    }
  },
  {
    name: 'Wired RSS',
    type: 'rss',
    url: 'https://www.wired.com/feed/rss',
    description: 'Wired technology news RSS feed',
    category: 'Technology News',
    priority: 1,
    config: {
      rssParser: 'default'
    },
    filters: {
      includeKeywords: ['ai', 'startup', 'technology', 'innovation', 'science'],
      excludeKeywords: ['spam', 'advertisement'],
      minWordCount: 150
    }
  },
  {
    name: 'Fast Company RSS',
    type: 'rss',
    url: 'https://www.fastcompany.com/feed',
    description: 'Fast Company business and innovation RSS feed',
    category: 'Business Innovation',
    priority: 1,
    config: {
      rssParser: 'default'
    },
    filters: {
      includeKeywords: ['startup', 'innovation', 'business', 'entrepreneur', 'ai'],
      excludeKeywords: ['spam', 'advertisement'],
      minWordCount: 150
    }
  }
]

// Sample content for testing - Balanced mix of Startup, AI, and Programming
const sampleContent = [
  {
    title: 'How I Built a $10K MRR SaaS in 6 Months',
    url: 'https://example.com/saas-success-story',
    source: 'Reddit - Startups',
    publishedAt: new Date('2024-01-15T10:00:00Z'),
    summary: 'A detailed case study of building a successful SaaS product from idea to $10K monthly recurring revenue, including technical challenges, marketing strategies, and lessons learned.',
    sentiment: 'positive',
    category: 'Startups',
    difficulty: 'Intermediate',
    readingTime: 12,
    technologies: ['React', 'Node.js', 'Stripe', 'PostgreSQL', 'AWS'],
    keyInsights: ['Start with a simple MVP', 'Focus on customer feedback early', 'Automate everything possible'],
    quality: 'high',
    isProcessed: true
  },
  {
    title: 'Getting Started with Next.js 14 App Router',
    url: 'https://example.com/nextjs-14-guide',
    source: 'Reddit - Web Development',
    publishedAt: new Date('2024-01-14T15:30:00Z'),
    summary: 'A comprehensive guide to building modern web applications with Next.js 14, covering the new App Router, Server Components, and performance optimizations.',
    sentiment: 'positive',
    category: 'Frontend Development',
    difficulty: 'Intermediate',
    readingTime: 8,
    technologies: ['Next.js', 'React', 'JavaScript', 'TypeScript'],
    keyInsights: ['App Router simplifies routing', 'Server Components improve performance', 'Built-in optimizations reduce bundle size'],
    quality: 'high',
    isProcessed: true
  },
  {
    title: 'The Future of AI in Startup Ecosystems',
    url: 'https://example.com/ai-startup-future',
    source: 'AI News RSS',
    publishedAt: new Date('2024-01-13T09:15:00Z'),
    summary: 'An analysis of how artificial intelligence is transforming startup ecosystems, from automated customer service to predictive analytics and beyond.',
    sentiment: 'positive',
    category: 'AI/ML',
    difficulty: 'Advanced',
    readingTime: 10,
    technologies: ['AI', 'Machine Learning', 'Startup Tools', 'Automation'],
    keyInsights: ['AI reduces operational costs', 'Data-driven decision making', 'Automation enables scaling'],
    quality: 'high',
    isProcessed: true
  },
  {
    title: 'Understanding Docker Containers for Developers',
    url: 'https://example.com/docker-containers',
    source: 'Reddit - Programming',
    publishedAt: new Date('2024-01-12T14:20:00Z'),
    summary: 'Learn the fundamentals of Docker containers, including how they work, why they\'re useful, and how to create and manage them effectively for development and deployment.',
    sentiment: 'neutral',
    category: 'DevOps',
    difficulty: 'Beginner',
    readingTime: 12,
    technologies: ['Docker', 'Containers', 'DevOps', 'Linux'],
    keyInsights: ['Containers provide isolation', 'Docker simplifies deployment', 'Images are immutable'],
    quality: 'high',
    isProcessed: true
  },
  {
    title: 'Indie Hacker Guide: From Side Project to Full-Time Income',
    url: 'https://example.com/indie-hacker-guide',
    source: 'Reddit - Indie Hackers',
    publishedAt: new Date('2024-01-11T11:45:00Z'),
    summary: 'A comprehensive guide for indie hackers looking to turn their side projects into sustainable full-time income, covering monetization, marketing, and growth strategies.',
    sentiment: 'positive',
    category: 'Indie Hacking',
    difficulty: 'Intermediate',
    readingTime: 18,
    technologies: ['Web Development', 'Marketing', 'Analytics', 'Payment Processing'],
    keyInsights: ['Start with solving real problems', 'Build in public for marketing', 'Focus on recurring revenue'],
    quality: 'high',
    isProcessed: true
  },
  {
    title: 'Building AI-Powered Features for Your Startup',
    url: 'https://example.com/ai-startup-features',
    source: 'Dev.to',
    publishedAt: new Date('2024-01-10T16:30:00Z'),
    summary: 'A practical guide to implementing AI features in your startup, including chatbots, recommendation systems, and predictive analytics using open-source tools.',
    sentiment: 'positive',
    category: 'AI/ML',
    difficulty: 'Intermediate',
    readingTime: 15,
    technologies: ['Python', 'TensorFlow', 'OpenAI API', 'FastAPI', 'Redis'],
    keyInsights: ['Use pre-trained models initially', 'Focus on user experience', 'Start with simple AI features'],
    quality: 'high',
    isProcessed: true
  },
  {
    title: 'Startup Funding Strategies for 2024',
    url: 'https://example.com/startup-funding-2024',
    source: 'TechCrunch RSS',
    publishedAt: new Date('2024-01-09T11:45:00Z'),
    summary: 'An overview of current startup funding trends, including venture capital, angel investing, and alternative funding sources for entrepreneurs in 2024.',
    sentiment: 'neutral',
    category: 'Startups',
    difficulty: 'Beginner',
    readingTime: 8,
    technologies: ['Business Strategy', 'Finance', 'Networking', 'Pitch Decks'],
    keyInsights: ['Build relationships with investors early', 'Focus on traction over ideas', 'Consider alternative funding sources'],
    quality: 'high',
    isProcessed: true
  },
  {
    title: 'Machine Learning for Product Managers',
    url: 'https://example.com/ml-product-managers',
    source: 'Reddit - Data Science',
    publishedAt: new Date('2024-01-08T16:30:00Z'),
    summary: 'A guide for product managers to understand machine learning concepts and how to effectively work with data science teams to build AI-powered products.',
    sentiment: 'positive',
    category: 'Data Science',
    difficulty: 'Intermediate',
    readingTime: 14,
    technologies: ['Machine Learning', 'Product Management', 'Data Analysis', 'A/B Testing'],
    keyInsights: ['Understand the basics of ML', 'Focus on business outcomes', 'Collaborate closely with data teams'],
    quality: 'high',
    isProcessed: true
  }
]

async function setupDatabase() {
  try {
    // Connect to database
    await connectDB()
    
    // Clear existing data (optional - comment out if you want to keep existing data)
    await Source.deleteMany({})
    await Content.deleteMany({})
    
    // Check if sources already exist
    const existingSources = await Source.countDocuments()
    if (existingSources === 0) {
      
      for (const sourceData of defaultSources) {
        const source = new Source(sourceData)
        await source.save()
      }
      
    }
    
    // Check if content already exists
    const existingContent = await Content.countDocuments()
    if (existingContent === 0) {
      
      for (const contentData of sampleContent) {
        const content = new Content(contentData)
        await content.save()
      }
      
    }
    
  } catch (error) {
    console.error('❌ Database setup failed:', error)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

// Run setup if this file is executed directly
const normalizePath = (path) => {
  return path.replace(/\\/g, '/').replace(/^file:\/\/\//, '').replace(/^\/+/, '')
}

const shouldRun = normalizePath(import.meta.url) === normalizePath(process.argv[1])

if (shouldRun) {
  setupDatabase()
} else {
  console.log('⏭️ Skipping execution - not run directly')
}

export default setupDatabase 