import { NextResponse } from 'next/server'
import { connectDB } from '../../../lib/database.js'
import Source from '../../../models/Source.js'
import Content from '../../../models/Content.js'

export async function POST() {
  try {
    console.log('🔄 Starting content refresh...')
    
    // Add timeout handling - 25 seconds to be safe
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 25000)
    })
    
    const refreshPromise = performRefresh()
    
    // Race between timeout and actual refresh
    const result = await Promise.race([refreshPromise, timeoutPromise])
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('❌ Content refresh failed:', error.message)
    
    // Always return JSON, never let HTML error pages through
    return NextResponse.json({
      success: false,
      error: error.message || 'An error occurred during refresh',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

async function performRefresh() {
  try {
    console.log('🔌 Attempting database connection...')
    await connectDB()
    console.log('✅ Database connected successfully')
    
    const sources = await Source.find({ isActive: true }).sort({ priority: 1 })
    console.log(`📰 Found ${sources.length} active sources`)
    
    if (sources.length === 0) {
      return {
        success: true,
        message: 'No active sources found',
        data: { 
          totalFetched: 0,
          sourcesProcessed: 0,
          timestamp: new Date().toISOString()
        }
      }
    }
    
    let totalFetched = 0
    let newPostsCount = 0
    let errors = []
    const startTime = Date.now()
    const maxDuration = 15000 // 15 seconds max to leave buffer for response
    
    for (const source of sources) {
      // Check if we're approaching timeout
      if (Date.now() - startTime > maxDuration) {
        console.log('⏰ Approaching timeout, stopping refresh process')
        break
      }
      
      try {
        console.log(`🔍 Processing source: ${source.name} (${source.type})`)
        
        let fetchedCount = 0
        
        if (source.type === 'reddit') {
          fetchedCount = await fetchRedditContent(source)
        } else if (source.type === 'rss') {
          fetchedCount = await fetchRSSContent(source)
        } else if (source.type === 'api') {
          fetchedCount = await fetchAPIContent(source)
        }
        
        totalFetched += fetchedCount
        newPostsCount += fetchedCount
        console.log(`  ✅ Source ${source.name} completed: ${fetchedCount} new items`)
        
        // Reduced delay to speed up processing
        await new Promise(resolve => setTimeout(resolve, 500))
        
      } catch (error) {
        console.error(`❌ Error processing source ${source.name}:`, error.message)
        errors.push(`${source.name}: ${error.message}`)
      }
    }
    
    const duration = Date.now() - startTime
    console.log(`🎉 Content refresh completed in ${duration}ms! Total new posts: ${newPostsCount}`)
    
    return {
      success: true,
      message: `Successfully fetched ${newPostsCount} new posts from ${sources.length} sources`,
      data: { 
        totalFetched: newPostsCount,
        sourcesProcessed: sources.length,
        timestamp: new Date().toISOString(),
        duration: duration,
        errors: errors.length > 0 ? errors : undefined
      }
    }
    
  } catch (error) {
    console.error('❌ Database or connection error:', error.message)
    console.error('❌ Error stack:', error.stack)
    
    // Check if it's a MongoDB connection error
    if (error.message.includes('MongoNetworkError') || error.message.includes('MongoServerSelectionError')) {
      throw new Error('Database connection failed. Please check your MongoDB connection.')
    } else if (error.message.includes('MongoParseError')) {
      throw new Error('Database configuration error. Please check your MongoDB URI.')
    } else {
      throw new Error(`Database error: ${error.message}`)
    }
  }
}

async function fetchRedditContent(source) {
  console.log(`  📱 Fetching Reddit content from r/${source.config.subreddit}`)
  
  try {
    const url = `https://www.reddit.com/r/${source.config.subreddit}/${source.config.sortBy}.json?t=${source.config.timeFilter}&limit=10`
    
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
    for (const post of posts.slice(0, 10)) { // Reduced from 20 to 10
      const postData = post.data
      
      // Check if content already exists to avoid duplicate URL errors
      const existingContent = await Content.findOne({ url: postData.url })
      if (existingContent) {
        console.log(`    ⏭️ Skipping duplicate: ${postData.title}`)
        continue
      }
      
      // Create content item
      const content = new Content({
        title: postData.title,
        url: postData.url,
        source: source.name,
        publishedAt: new Date(postData.created_utc * 1000),
        summary: postData.selftext?.substring(0, 500) || 'No description available',
        content: postData.selftext || null,
        sentiment: 'neutral',
        category: source.category,
        difficulty: 'Beginner',
        readingTime: Math.ceil((postData.title.length + (postData.selftext?.length || 0)) / 200),
        technologies: extractTechnologies(postData.title + ' ' + (postData.selftext || '')),
        keyInsights: [],
        quality: 'medium',
        isProcessed: false,
        metadata: {
          author: postData.author,
          tags: postData.link_flair_text ? [postData.link_flair_text] : [],
          wordCount: (postData.title.length + (postData.selftext?.length || 0)),
          upvotes: postData.ups,
          comments: postData.num_comments,
          images: extractImages(postData),
          isVideo: postData.is_video || false,
          thumbnail: postData.thumbnail,
          preview: postData.preview
        }
      })

      try {
        await content.save()
        fetchedCount++
        console.log(`    ✅ Saved: ${postData.title}`)
      } catch (saveError) {
        console.error(`    ❌ Failed to save: ${postData.title} - ${saveError.message}`)
      }
    }

    console.log(`  ✅ Fetched ${fetchedCount} posts from Reddit`)
    return fetchedCount

  } catch (error) {
    console.error(`  ❌ Reddit fetch failed: ${error.message}`)
    return 0
  }
}

async function fetchRSSContent(source) {
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
    const items = await parseRSSXML(xmlText)
    
    console.log(`  📊 Found ${items.length} RSS items`)
    
    let fetchedCount = 0
    for (const item of items.slice(0, 10)) { // Reduced from 20 to 10
      // Check if content already exists to avoid duplicate URL errors
      const existingContent = await Content.findOne({ url: item.link })
      if (existingContent) {
        console.log(`    ⏭️ Skipping duplicate: ${item.title}`)
        continue
      }
      
      // Try to get better description if it's missing or too short
      let description = item.description?.substring(0, 500) || ''
      let fullContent = null
      
      if (!description || description.length < 50) {
        console.log(`    🔍 Fetching full content for: ${item.title}`)
        try {
          fullContent = await fetchFullArticleContent(item.link)
          if (fullContent) {
            description = fullContent.substring(0, 500)
            console.log(`    ✅ Got full content (${fullContent.length} chars)`)
          }
        } catch (error) {
          console.log(`    ⚠️ Could not fetch full content: ${error.message}`)
        }
      }
      
      // Create content item
      const content = new Content({
        title: item.title,
        url: item.link,
        source: source.name,
        publishedAt: new Date(item.pubDate),
        summary: description || 'No description available',
        content: fullContent || null,
        sentiment: 'neutral',
        category: source.category,
        difficulty: 'Beginner',
        readingTime: Math.ceil((item.title.length + (description?.length || 0)) / 200),
        technologies: extractTechnologies(item.title + ' ' + (description || '')),
        keyInsights: [],
        quality: 'medium',
        isProcessed: false,
        metadata: {
          author: item.author || 'Unknown',
          tags: [],
          wordCount: (item.title.length + (description?.length || 0)),
          upvotes: 0,
          comments: 0,
          hasFullContent: !!fullContent,
          descriptionSource: fullContent ? 'full_article' : 'rss_feed'
        }
      })

      try {
        await content.save()
        fetchedCount++
        console.log(`    ✅ Saved: ${item.title}`)
      } catch (saveError) {
        console.error(`    ❌ Failed to save: ${item.title} - ${saveError.message}`)
      }
    }

    console.log(`  ✅ Fetched ${fetchedCount} posts from RSS`)
    return fetchedCount

  } catch (error) {
    console.error(`  ❌ RSS fetch failed: ${error.message}`)
    return 0
  }
}

async function fetchAPIContent(source) {
  console.log(`  🔌 Fetching API content from ${source.url}`)
  
  try {
    let response
    if (source.name === 'Hacker News') {
      // Fetch top stories from HN
      const topStoriesResponse = await fetch(source.url)
      const topStories = await topStoriesResponse.json()
      
      let fetchedCount = 0
      for (const storyId of topStories.slice(0, 10)) { // Reduced from 20 to 10
        try {
          const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`)
          const story = await storyResponse.json()
          
          if (story && story.url) {
            const content = new Content({
              title: story.title,
              url: story.url,
              source: source.name,
              publishedAt: new Date(story.time * 1000),
              summary: `Hacker News post with ${story.score} points`,
              content: null,
              sentiment: 'neutral',
              category: source.category,
              difficulty: 'Beginner',
              readingTime: Math.ceil(story.title.length / 200),
              technologies: extractTechnologies(story.title),
              keyInsights: [],
              quality: 'medium',
              isProcessed: false,
              metadata: {
                author: story.by || 'Unknown',
                tags: [],
                wordCount: story.title.length,
                upvotes: story.score || 0,
                comments: story.descendants || 0
              }
            })

            await content.save()
            fetchedCount++
          }
        } catch (error) {
          console.error(`    ❌ Error fetching HN story ${storyId}:`, error.message)
        }
      }
      
      console.log(`  ✅ Fetched ${fetchedCount} posts from Hacker News`)
      return fetchedCount
    }
    
    // For other APIs, try to fetch directly
    response = await fetch(source.url)
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }
    
    const data = await response.json()
    console.log(`  ✅ Fetched ${data.length || 0} posts from API`)
    return data.length || 0

  } catch (error) {
    console.error(`  ❌ API fetch failed: ${error.message}`)
    return 0
  }
}

async function parseRSSXML(xmlText) {
  try {
    const items = []
    
    // Simple XML parsing for RSS feeds
    const itemMatches = xmlText.match(/<item[^>]*>([\s\S]*?)<\/item>/gi)
    
    if (itemMatches) {
      for (const itemMatch of itemMatches) {
        const titleMatch = itemMatch.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        const linkMatch = itemMatch.match(/<link[^>]*>([\s\S]*?)<\/link>/i)
        const descriptionMatch = itemMatch.match(/<description[^>]*>([\s\S]*?)<\/description>/i)
        const pubDateMatch = itemMatch.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
        const authorMatch = itemMatch.match(/<author[^>]*>([\s\S]*?)<\/author>/i)
        
        if (titleMatch && linkMatch) {
          items.push({
            title: titleMatch[1].replace(/<[^>]*>/g, '').trim(),
            link: linkMatch[1].replace(/<[^>]*>/g, '').trim(),
            description: descriptionMatch ? descriptionMatch[1].replace(/<[^>]*>/g, '').trim() : '',
            pubDate: pubDateMatch ? new Date(pubDateMatch[1].replace(/<[^>]*>/g, '').trim()) : new Date(),
            author: authorMatch ? authorMatch[1].replace(/<[^>]*>/g, '').trim() : 'Unknown'
          })
        }
      }
    }
    
    return items
  } catch (error) {
    console.error('Error parsing RSS XML:', error.message)
    return []
  }
}

async function fetchFullArticleContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DevDigest/1.0.0 (Content Aggregator)'
      },
      timeout: 10000
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    
    // Try to extract content from common article selectors
    const contentSelectors = [
      'article',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      '.story-body',
      '.post-text',
      '.article-body',
      '.post-body'
    ]
    
    let content = null
    for (const selector of contentSelectors) {
      const element = html.match(new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'i'))
      if (element && element[1]) {
        content = element[1]
        break
      }
    }
    
    if (!content) {
      // Try div selectors
      const divSelectors = [
        '.article',
        '.post',
        '.entry',
        '.story',
        '.content-area'
      ]
      
      for (const selector of divSelectors) {
        const element = html.match(new RegExp(`<div[^>]*class="[^"]*${selector.replace('.', '')}[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, 'i'))
        if (element && element[1]) {
          content = element[1]
          break
        }
      }
    }
    
    if (content) {
      const cleanedContent = cleanHTML(content)
      return cleanedContent.length > 100 ? cleanedContent : null
    }
    
    return null
  } catch (error) {
    console.log(`    ⚠️ Error fetching full content: ${error.message}`)
    return null
  }
}

function cleanHTML(html) {
  // Remove HTML tags and decode entities
  let text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim()
  
  // Limit length
  return text.substring(0, 2000)
}

function extractTechnologies(text) {
  const techKeywords = [
    'react', 'vue', 'angular', 'node', 'python', 'javascript', 'typescript',
    'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'mongodb', 'postgresql',
    'redis', 'elasticsearch', 'machine learning', 'ai', 'blockchain',
    'cybersecurity', 'devops', 'microservices', 'serverless'
  ]
  
  const lowerText = text.toLowerCase()
  return techKeywords.filter(keyword => lowerText.includes(keyword))
}

function extractImages(postData) {
  const images = []
  
  if (postData.preview && postData.preview.images) {
    for (const image of postData.preview.images) {
      if (image.source && image.source.url) {
        images.push(image.source.url)
      }
    }
  }
  
  return images
} 