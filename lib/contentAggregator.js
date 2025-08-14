import { connectDB } from './database.js'
import Source from '../models/Source.js'
import Content from '../models/Content.js'
import { GoogleGenerativeAI } from '@google/generative-ai'

class ContentAggregator {
  constructor() {
    this.isRunning = false
    this.lastRun = null
    this.stats = {
      totalFetched: 0,
      totalProcessed: 0,
      totalErrors: 0,
      lastRunTime: null
    }
    
    // Initialize Gemini AI
    if (process.env.GOOGLE_API_KEY) {
      this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    }
    
    // Load stats from database on initialization
    this.loadStatsFromDB()
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Content aggregator is already running')
      return false
    }

    console.log('🚀 Starting content aggregator...')
    this.isRunning = true
    this.lastRun = new Date()

    try {
      await connectDB()
      const sources = await Source.find({ isActive: true }).sort({ priority: 1 })
      
      console.log(`📰 Found ${sources.length} active sources`)
      
      for (const source of sources) {
        try {
          console.log(`\n🔍 Processing source: ${source.name} (${source.type})`)
          console.log(`  📍 URL: ${source.url}`)
          console.log(`  🏷️ Category: ${source.category}`)
          
          const result = await this.processSource(source)
          console.log(`  ✅ Source ${source.name} completed: ${result} items`)
          
          // Small delay to avoid overwhelming servers
          await this.sleep(1000)
          
        } catch (error) {
          console.error(`❌ Error processing source ${source.name}:`, error.message)
          console.error(`  📍 Source URL: ${source.url}`)
          console.error(`  🏷️ Source type: ${source.type}`)
          console.error(`  📋 Full error:`, error)
          this.stats.totalErrors++
          
          // Update source with error info but continue with other sources
          try {
            source.lastFetchSuccess = false
            source.processingError = error.message
            await source.save()
          } catch (saveError) {
            console.error(`  ⚠️ Could not save error info for ${source.name}:`, saveError.message)
          }
          
          // Continue with next source instead of stopping
          continue
        }
      }

      this.stats.lastRunTime = new Date()
      console.log('\n🎉 Content aggregation completed!')
      console.log(`📊 Stats: ${this.stats.totalFetched} fetched, ${this.stats.totalProcessed} processed, ${this.stats.totalErrors} errors`)
      
      // Save stats to database
      await this.saveStatsToDB()
      
    } catch (error) {
      console.error('❌ Content aggregation failed:', error.message)
    } finally {
      this.isRunning = false
    }

    return true
  }

  async processSource(source) {
    switch (source.type) {
      case 'reddit':
        return await this.fetchRedditContent(source)
      case 'rss':
        return await this.fetchRSSContent(source)
      case 'api':
        return await this.fetchAPIContent(source)
      default:
        throw new Error(`Unknown source type: ${source.type}`)
    }
  }

  async fetchRedditContent(source) {
    console.log(`  📱 Fetching Reddit content from r/${source.config.subreddit}`)
    
    try {
      // Use Reddit's JSON endpoint (no API key required)
      const url = `https://www.reddit.com/r/${source.config.subreddit}/${source.config.sortBy}.json?t=${source.config.timeFilter}&limit=50`
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DevDigest/1.0.0 (Content Aggregator)'
        }
      })

      if (!response.ok) {
        throw new Error(`Reddit API returned ${response.status}`)
      }

      const data = await response.json()
      const posts = data.data.children || []

      let fetchedCount = 0
      for (const post of posts.slice(0, 50)) { // Limit to 50 items per Reddit subreddit
        const postData = post.data
        
        // Skip if it doesn't meet filter criteria
        if (!this.matchesFilters(postData, source.filters)) {
          continue
        }

        // Check if content already exists
        const existingContent = await Content.findOne({ url: postData.url })
        if (existingContent) {
          continue
        }

        // Create content item
        const content = new Content({
          title: postData.title,
          url: postData.url,
          source: source.name,
          publishedAt: new Date(postData.created_utc * 1000),
          summary: postData.selftext?.substring(0, 500) || 'No description available',
          content: postData.selftext || null, // Store full content for AI analysis
          sentiment: 'neutral', // Will be analyzed by AI
          category: source.category,
          difficulty: 'Beginner',
          readingTime: Math.ceil((postData.title.length + (postData.selftext?.length || 0)) / 200),
          technologies: this.extractTechnologies(postData.title + ' ' + (postData.selftext || '')),
          keyInsights: [],
          quality: 'medium',
          isProcessed: false,
          metadata: {
            author: postData.author,
            tags: postData.link_flair_text ? [postData.link_flair_text] : [],
            wordCount: (postData.title.length + (postData.selftext?.length || 0)),
            upvotes: postData.ups,
            comments: postData.num_comments,
            // Extract images and media
            images: this.extractImages(postData),
            isVideo: postData.is_video || false,
            thumbnail: postData.thumbnail,
            preview: postData.preview
          }
        })

        await content.save()
        fetchedCount++
        this.stats.totalFetched++
      }

      // Update source stats
      source.lastFetched = new Date()
      source.lastFetchSuccess = true
      source.lastFetchCount = fetchedCount
      source.stats.totalFetched += fetchedCount
      await source.save()

      console.log(`  ✅ Fetched ${fetchedCount} new posts from Reddit`)
      return fetchedCount

    } catch (error) {
      throw new Error(`Reddit fetch failed: ${error.message}`)
    }
  }

  async fetchRSSContent(source) {
    console.log(`  📡 Fetching RSS content from ${source.url}`)
    
    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'DevDigest/1.0.0 (Content Aggregator)'
        }
      })

      if (!response.ok) {
        throw new Error(`RSS feed returned ${response.status}`)
      }

      const xmlText = await response.text()
      const items = await this.parseRSSXML(xmlText)
      
      console.log(`  📊 Found ${items.length} RSS items`)
      
      let fetchedCount = 0
      for (const item of items.slice(0, 50)) { // Limit to 50 items per RSS feed
        // Skip if it doesn't meet filter criteria
        if (!this.matchesFilters(item, source.filters)) {
          continue
        }

        // Check if content already exists
        const existingContent = await Content.findOne({ url: item.link })
        if (existingContent) {
          continue
        }

        // Try to fetch full article content
        let fullContent = null
        try {
          fullContent = await this.fetchFullArticleContent(item.link)
        } catch (error) {
          console.log(`  ⚠️ Could not fetch full content for ${item.title}`)
        }

        // Create content item
        const content = new Content({
          title: item.title,
          url: item.link,
          source: source.name,
          publishedAt: new Date(item.pubDate || Date.now()),
          summary: item.description?.substring(0, 500) || 'No description available',
          content: fullContent || item.description || null, // Use full content if available
          sentiment: 'neutral', // Will be analyzed by AI
          category: source.category,
          difficulty: 'Beginner',
          readingTime: Math.ceil((item.title.length + (fullContent?.length || item.description?.length || 0)) / 200),
          technologies: this.extractTechnologies(item.title + ' ' + (fullContent || item.description || '')),
          keyInsights: [],
          quality: 'medium',
          isProcessed: false,
          metadata: {
            author: item.author,
            tags: item.categories || [],
            wordCount: (item.title.length + (fullContent?.length || item.description?.length || 0))
          }
        })

        await content.save()
        fetchedCount++
        this.stats.totalFetched++
      }

      // Update source stats
      source.lastFetched = new Date()
      source.lastFetchSuccess = true
      source.lastFetchCount = fetchedCount
      source.stats.totalFetched += fetchedCount
      await source.save()

      console.log(`  ✅ Fetched ${fetchedCount} new articles from RSS`)
      return fetchedCount

    } catch (error) {
      throw new Error(`RSS fetch failed: ${error.message}`)
    }
  }

  async fetchAPIContent(source) {
    console.log(`  🔌 Fetching API content from ${source.url}`)
    
    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'DevDigest/1.0.0 (Content Aggregator)',
          ...source.config.headers
        }
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()
      console.log(`  📊 Raw API response type:`, typeof data)
      console.log(`  📊 Raw API response keys:`, Object.keys(data || {}))
      
      const items = this.extractItemsFromAPI(data, source)
      
      console.log(`  📊 Found ${items.length} API items`)
      
      // Debug: Show first few items
      if (items.length > 0) {
        console.log(`  📋 Sample API item:`, {
          title: items[0].title?.substring(0, 50) + '...',
          url: items[0].url?.substring(0, 50) + '...',
          hasSummary: !!items[0].summary
        })
      }
      
      let fetchedCount = 0
      for (const item of items.slice(0, 50)) { // Limit to 50 items per API
        // Skip if it doesn't meet filter criteria
        if (!this.matchesFilters(item, source.filters)) {
          continue
        }

        // Check if content already exists
        const existingContent = await Content.findOne({ url: item.url })
        if (existingContent) {
          continue
        }

        // Create content item
        const content = new Content({
          title: item.title,
          url: item.url,
          source: source.name,
          publishedAt: new Date(item.publishedAt || item.created_at || item.date || Date.now()),
          summary: item.summary?.substring(0, 500) || item.description?.substring(0, 500) || 'No description available',
          content: item.summary || item.description || null, // Store full content for AI analysis
          sentiment: 'neutral', // Will be analyzed by AI
          category: source.category,
          difficulty: 'Beginner',
          readingTime: Math.ceil((item.title.length + (item.summary?.length || item.description?.length || 0)) / 200),
          technologies: this.extractTechnologies(item.title + ' ' + (item.summary || item.description || '')),
          keyInsights: [],
          quality: 'medium',
          isProcessed: false,
          metadata: {
            author: item.author || item.user?.login || item.creator,
            tags: item.tags || item.topics || item.labels || [],
            wordCount: (item.title.length + (item.summary?.length || item.description?.length || 0))
          }
        })

        await content.save()
        fetchedCount++
        this.stats.totalFetched++
      }

      // Update source stats
      source.lastFetched = new Date()
      source.lastFetchSuccess = true
      source.lastFetchCount = fetchedCount
      source.stats.totalFetched += fetchedCount
      await source.save()

      console.log(`  ✅ Fetched ${fetchedCount} new items from API`)
      return fetchedCount

    } catch (error) {
      console.error(`  ❌ API fetch error for ${source.name}:`, error.message)
      throw new Error(`API fetch failed: ${error.message}`)
    }
  }

  async fetchFullArticleContent(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DevDigest/1.0.0 (Content Fetcher)'
        },
        timeout: 15000
      })

      if (!response.ok) {
        return null
      }

      const html = await response.text()
      
      // Extract main content using common selectors
      const contentSelectors = [
        'article',
        '[role="main"]',
        '.post-content',
        '.article-content',
        '.entry-content',
        '.content',
        'main',
        '.post-body',
        '.article-body'
      ]

      let content = ''
      
      // Try to find content using selectors
      for (const selector of contentSelectors) {
        const elements = html.match(new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'gi'))
        if (elements && elements.length > 0) {
          content = elements.join(' ')
          break
        }
      }

      // If no structured content found, extract from body
      if (!content) {
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
        if (bodyMatch) {
          content = bodyMatch[1]
        }
      }

      if (content) {
        // Clean the HTML content
        return this.cleanHTML(content)
      }

      return null
    } catch (error) {
      console.log(`  ⚠️ Could not fetch full content from ${url}:`, error.message)
      return null
    }
  }

  matchesFilters(content, filters) {
    if (!filters) return true

    const text = (content.title || '') + ' ' + (content.description || content.selftext || content.summary || '')
    const lowerText = text.toLowerCase()

    // Check minimum word count (make it extremely lenient)
    if (filters.minWordCount && text.split(/\s+/).length < Math.max(3, filters.minWordCount / 8)) {
      console.log(`  ⚠️ Filtered out due to word count: ${text.split(/\s+/).length} < ${Math.max(3, filters.minWordCount / 8)}`)
      return false
    }

    // Check include keywords (make it more lenient)
    if (filters.includeKeywords && filters.includeKeywords.length > 0) {
      const hasIncludeKeyword = filters.includeKeywords.some(keyword => 
        lowerText.includes(keyword.toLowerCase())
      )
      if (!hasIncludeKeyword) {
        console.log(`  ⚠️ Filtered out due to missing include keywords: ${filters.includeKeywords.join(', ')}`)
        return false
      }
    }

    // Check exclude keywords (keep this strict)
    if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
      const hasExcludeKeyword = filters.excludeKeywords.some(keyword => 
        lowerText.includes(keyword.toLowerCase())
      )
      if (hasExcludeKeyword) {
        console.log(`  ⚠️ Filtered out due to exclude keywords: ${filters.excludeKeywords.join(', ')}`)
        return false
      }
    }

    return true
  }

  extractTechnologies(text) {
    const techKeywords = [
      'React', 'Vue', 'Angular', 'Node.js', 'Python', 'JavaScript', 'TypeScript',
      'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'MongoDB', 'PostgreSQL',
      'Redis', 'GraphQL', 'REST', 'API', 'AI', 'Machine Learning', 'TensorFlow',
      'PyTorch', 'Next.js', 'Express', 'Django', 'Flask', 'FastAPI'
    ]

    const found = techKeywords.filter(tech => 
      text.toLowerCase().includes(tech.toLowerCase())
    )

    return found.slice(0, 5) // Limit to 5 technologies
  }

  extractImages(postData) {
    const images = []
    
    // Check if post has preview images
    if (postData.preview && postData.preview.images && postData.preview.images.length > 0) {
      postData.preview.images.forEach(image => {
        if (image.source && image.source.url) {
          images.push({
            url: image.source.url.replace(/&amp;/g, '&'),
            width: image.source.width,
            height: image.source.height,
            type: 'preview'
          })
        }
      })
    }
    
    // Check if post has thumbnail
    if (postData.thumbnail && postData.thumbnail !== 'self' && postData.thumbnail !== 'default') {
      images.push({
        url: postData.thumbnail,
        width: 140,
        height: 140,
        type: 'thumbnail'
      })
    }
    
    // Check if post URL is an image
    if (postData.url && this.isImageUrl(postData.url)) {
      images.push({
        url: postData.url,
        width: 800,
        height: 600,
        type: 'direct'
      })
    }
    
    return images
  }

  isImageUrl(url) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    const lowerUrl = url.toLowerCase()
    return imageExtensions.some(ext => lowerUrl.includes(ext)) || 
           lowerUrl.includes('imgur.com') ||
           lowerUrl.includes('i.redd.it')
  }

  async parseRSSXML(xmlText) {
    // Enhanced XML parsing for RSS and Atom feeds
    const items = []
    
    try {
      console.log(`  🔍 Parsing RSS/Atom XML (${xmlText.length} characters)`)
      
      // Check if it's an Atom feed
      const isAtom = xmlText.includes('<feed') || xmlText.includes('<entry')
      
      if (isAtom) {
        console.log('  📡 Detected Atom format')
        // Handle Atom format
        const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/g
        let match

        while ((match = entryRegex.exec(xmlText)) !== null) {
          const entryContent = match[1]
          
          const title = this.extractXMLTagWithCDATA(entryContent, 'title')
          const link = this.extractXMLTagWithCDATA(entryContent, 'link') || 
                      this.extractXMLTagWithCDATA(entryContent, 'id')
          const description = this.extractXMLTagWithCDATA(entryContent, 'summary') || 
                            this.extractXMLTagWithCDATA(entryContent, 'content')
          const pubDate = this.extractXMLTagWithCDATA(entryContent, 'published') ||
                         this.extractXMLTagWithCDATA(entryContent, 'updated')
          const author = this.extractXMLTagWithCDATA(entryContent, 'name') ||
                        this.extractXMLTagWithCDATA(entryContent, 'author')
          const categories = this.extractXMLTagsWithCDATA(entryContent, 'category')

          if (title && link) {
            items.push({
              title: this.cleanHTML(title),
              link: this.fixRSSUrl(link, entryContent),
              description: this.cleanHTML(description),
              pubDate: pubDate,
              author: this.cleanHTML(author),
              categories: categories
            })
          }
        }
      } else {
        console.log('  📡 Detected RSS format')
        // Handle RSS format
        const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g
        let match

        while ((match = itemRegex.exec(xmlText)) !== null) {
          const itemContent = match[1]
          
          // Extract title (handle CDATA)
          const title = this.extractXMLTagWithCDATA(itemContent, 'title')
          const link = this.extractXMLTagWithCDATA(itemContent, 'link')
          const description = this.extractXMLTagWithCDATA(itemContent, 'description') || 
                            this.extractXMLTagWithCDATA(itemContent, 'content') ||
                            this.extractXMLTagWithCDATA(itemContent, 'content:encoded')
          const pubDate = this.extractXMLTagWithCDATA(itemContent, 'pubDate') ||
                         this.extractXMLTagWithCDATA(itemContent, 'date') ||
                         this.extractXMLTagWithCDATA(itemContent, 'dc:date')
          const author = this.extractXMLTagWithCDATA(itemContent, 'author') ||
                        this.extractXMLTagWithCDATA(itemContent, 'dc:creator')
          const categories = this.extractXMLTagsWithCDATA(itemContent, 'category')

          if (title && link) {
            items.push({
              title: this.cleanHTML(title),
              link: this.fixRSSUrl(link, itemContent),
              description: this.cleanHTML(description),
              pubDate: pubDate,
              author: this.cleanHTML(author),
              categories: categories
            })
          }
        }
      }

      console.log(`  📝 Parsed ${items.length} items`)

      // Debug: Show first few items
      if (items.length > 0) {
        console.log(`  📋 Sample item:`, {
          title: items[0].title?.substring(0, 50) + '...',
          link: items[0].link?.substring(0, 50) + '...',
          hasDescription: !!items[0].description
        })
      }

      return items

    } catch (error) {
      console.error('  ❌ RSS/Atom parsing error:', error.message)
      console.error('  📋 XML preview:', xmlText.substring(0, 500))
      return []
    }
  }

  // Fix RSS URLs that only provide query parameters instead of direct article links
  fixRSSUrl(url, itemContent) {
    if (!url) return url
    
    // Handle The Verge RSS feed specifically
    if (url.includes('theverge.com') && url.includes('?p=')) {
      // Extract the post ID from the query parameter
      const postIdMatch = url.match(/\?p=(\d+)/)
      if (postIdMatch) {
        const postId = postIdMatch[1]
        // Try to find a better URL in the content
        const guidMatch = itemContent.match(/<guid[^>]*>([^<]+)<\/guid>/i)
        if (guidMatch && guidMatch[1] && !guidMatch[1].includes('?p=')) {
          return guidMatch[1]
        }
        // If no better URL found, construct a proper article URL
        return `https://www.theverge.com/${postId}`
      }
    }
    
    // Handle other RSS feeds with similar issues
    if (url.includes('?') && !url.includes('/')) {
      // Try to find a better URL in the content
      const guidMatch = itemContent.match(/<guid[^>]*>([^<]+)<\/guid>/i)
      if (guidMatch && guidMatch[1] && !guidMatch[1].includes('?')) {
        return guidMatch[1]
      }
    }
    
    return url
  }

  extractXMLTagWithCDATA(content, tagName) {
    // Handle both regular tags and CDATA sections
    const cdataRegex = new RegExp(`<${tagName}[^>]*>\\s*<!\\[CDATA\\[([^\\]]*)\\]\\]>\\s*</${tagName}>`, 'i')
    const regularRegex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i')
    
    // Try CDATA first
    let match = content.match(cdataRegex)
    if (match) {
      return match[1]
    }
    
    // Try regular tag
    match = content.match(regularRegex)
    return match ? match[1] : null
  }

  extractXMLTagsWithCDATA(content, tagName) {
    // Handle both regular tags and CDATA sections for multiple tags
    const cdataRegex = new RegExp(`<${tagName}[^>]*>\\s*<!\\[CDATA\\[([^\\]]*)\\]\\]>\\s*</${tagName}>`, 'gi')
    const regularRegex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'gi')
    
    const matches = []
    
    // Find CDATA matches
    let match
    while ((match = cdataRegex.exec(content)) !== null) {
      matches.push(this.cleanHTML(match[1]))
    }
    
    // Find regular matches
    while ((match = regularRegex.exec(content)) !== null) {
      matches.push(this.cleanHTML(match[1]))
    }
    
    return matches.filter(Boolean)
  }

  cleanHTML(text) {
    if (!text) return ''
    return text.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim()
  }

  extractItemsFromAPI(data, source) {
    // Handle different API response formats
    let items = []
    
    if (Array.isArray(data)) {
      items = data
    } else if (data.items && Array.isArray(data.items)) {
      items = data.items
    } else if (data.articles && Array.isArray(data.articles)) {
      items = data.articles
    } else if (data.posts && Array.isArray(data.posts)) {
      items = data.posts
    } else if (data.results && Array.isArray(data.results)) {
      items = data.results
    } else if (data.stories && Array.isArray(data.stories)) {
      items = data.stories
    } else if (data.data && Array.isArray(data.data)) {
      items = data.data
    } else {
      console.warn(`  ⚠️ Unknown API response format for ${source.name}`)
      console.log(`  📋 Response keys:`, Object.keys(data || {}))
      return []
    }

    // Normalize items to have consistent structure
    return items.map(item => {
      // Handle different field names for common properties
      return {
        title: item.title || item.name || item.headline || 'Untitled',
        url: item.url || item.link || item.html_url || item.permalink || `#${item.id}`,
        summary: item.summary || item.description || item.body || item.excerpt || item.title,
        publishedAt: item.published_at || item.created_at || item.date || item.pubDate || item.timestamp,
        author: item.author || item.user?.login || item.creator || item.by || 'Unknown',
        tags: item.tags || item.topics || item.labels || item.categories || [],
        ...item // Keep original properties
      }
    }).filter(item => item.title && item.url && item.url !== '#undefined')
  }

  async loadStatsFromDB() {
    try {
      await connectDB()
      // Get total stats from all sources
      const sources = await Source.find({})
      const totalFetched = sources.reduce((sum, source) => sum + (source.stats?.totalFetched || 0), 0)
      const totalErrors = sources.reduce((sum, source) => sum + (source.stats?.totalErrors || 0), 0)
      
      // Also get total content count for verification
      const totalContent = await Content.countDocuments()
      
      this.stats.totalFetched = totalFetched
      this.stats.totalErrors = totalErrors
      this.stats.totalProcessed = totalContent // Use actual content count instead of calculated
      
      console.log(`📊 Loaded stats from DB: ${totalFetched} fetched, ${totalErrors} errors, ${totalContent} total content`)
    } catch (error) {
      console.error('❌ Error loading stats from DB:', error.message)
      // Fallback to safe defaults
      this.stats.totalFetched = 0
      this.stats.totalErrors = 0
      this.stats.totalProcessed = 0
    }
  }

  async saveStatsToDB() {
    try {
      await connectDB()
      // Update global stats in a dedicated collection or use existing sources
      // For now, we'll just log the current stats
      console.log(`💾 Current stats: ${this.stats.totalFetched} fetched, ${this.stats.totalErrors} errors`)
      
      // Optionally, we could create a global stats document here
      // This would make stats even more persistent
    } catch (error) {
      console.error('❌ Error saving stats to DB:', error.message)
    }
  }

  async resetStats() {
    try {
      await connectDB()
      // Reset all source stats
      await Source.updateMany({}, { 
        $set: { 
          'stats.totalFetched': 0,
          'stats.totalErrors': 0,
          'stats.lastFetchCount': 0
        }
      })
      
      // Reset local stats
      this.stats.totalFetched = 0
      this.stats.totalErrors = 0
      this.stats.totalProcessed = 0
      
      console.log('🔄 Stats reset successfully')
    } catch (error) {
      console.error('❌ Error resetting stats:', error.message)
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async getStatus() {
    // Always refresh stats from database to ensure accuracy
    await this.loadStatsFromDB()
    
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      stats: this.stats
    }
  }

  async triggerAggregation() {
    if (this.isRunning) {
      return false
    }
    
    console.log('🎯 Manual aggregation triggered')
    return await this.start()
  }

  stop() {
    this.isRunning = false
    console.log('⏹️ Content aggregator stopped')
  }
}

export default ContentAggregator 