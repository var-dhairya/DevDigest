import { NextResponse } from 'next/server'
import { connectDB } from '../../../lib/database.js'
import Source from '../../../models/Source.js'
import Content from '../../../models/Content.js'

// Reddit OAuth helper function
async function getRedditAccessToken() {
  try {
    const clientId = process.env.REDDIT_CLIENT_ID
    const clientSecret = process.env.REDDIT_CLIENT_SECRET
    
    if (!clientId || !clientSecret) {
      console.log('⚠️ Reddit credentials not found, falling back to public endpoints')
      return null
    }
    
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'DevDigest/1.0.0'
      },
      body: 'grant_type=client_credentials'
    })
    
    if (!response.ok) {
      console.log(`⚠️ Reddit OAuth failed: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    console.log('✅ Reddit OAuth access token obtained')
    return data.access_token
    
  } catch (error) {
    console.log(`⚠️ Reddit OAuth error: ${error.message}`)
    return null
  }
}

export async function POST() {
  try {
    console.log('🔄 Starting content refresh...')
    
    await connectDB()
    
    // Get Reddit access token for OAuth endpoints
    const redditToken = await getRedditAccessToken()
    
    const sources = await Source.find({ isActive: true }).sort({ priority: 1 })
    console.log(`📰 Found ${sources.length} active sources`)
    
    const MAX_TOTAL_POSTS = 25 // Limit total posts across all sources
    const MAX_POSTS_PER_SOURCE = Math.max(3, Math.floor(MAX_TOTAL_POSTS / sources.length)) // Fair distribution
    
    console.log(`🎯 Target: ${MAX_TOTAL_POSTS} total posts, max ${MAX_POSTS_PER_SOURCE} per source`)
    
    let totalFetched = 0
    let newPostsCount = 0
    let sourceStats = {
      reddit: { processed: 0, success: 0, failed: 0, totalFetched: 0 },
      rss: { processed: 0, success: 0, failed: 0, totalFetched: 0 },
      api: { processed: 0, success: 0, failed: 0, totalFetched: 0 }
    }
    
    // Group sources by type for parallel processing
    const redditSources = sources.filter(s => s.type === 'reddit')
    const rssSources = sources.filter(s => s.type === 'rss')
    const apiSources = sources.filter(s => s.type === 'api')
    
    console.log(`📊 Source distribution: ${redditSources.length} Reddit, ${rssSources.length} RSS, ${apiSources.length} API`)
    
    // Parallel fetching with early termination
    const fetchPromises = []
    
    // Add Reddit sources to parallel processing
    for (const source of redditSources) {
      const promise = fetchSourceWithTimeout(source, 'reddit', MAX_POSTS_PER_SOURCE, redditToken, sourceStats, true) // Force refresh for Reddit
      fetchPromises.push(promise)
    }
    
    // Add RSS sources to parallel processing
    for (const source of rssSources) {
      const promise = fetchSourceWithTimeout(source, 'rss', MAX_POSTS_PER_SOURCE, null, sourceStats, true) // Force refresh for RSS
      fetchPromises.push(promise)
    }
    
    // Add API sources to parallel processing
    for (const source of apiSources) {
      const promise = fetchSourceWithTimeout(source, 'api', MAX_POSTS_PER_SOURCE, null, sourceStats, true) // Force refresh for APIs
      fetchPromises.push(promise)
    }
    
    console.log(`🚀 Starting parallel fetch for ${fetchPromises.length} sources...`)
    
    // Execute all promises in parallel with early termination monitoring
    const results = await Promise.allSettled(fetchPromises)
    
    // Process results and update stats
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const source = sources[i]
      
      if (result.status === 'fulfilled') {
        const { fetchedCount, sourceType } = result.value
        totalFetched += fetchedCount
        newPostsCount += fetchedCount
        
        if (fetchedCount > 0) {
          sourceStats[sourceType].success++
          sourceStats[sourceType].totalFetched += fetchedCount
        } else {
          sourceStats[sourceType].failed++
        }
        
        console.log(`✅ ${source.name}: ${fetchedCount} posts fetched (Total: ${totalFetched}/${MAX_TOTAL_POSTS})`)
        
        // Early termination check
        if (totalFetched >= MAX_TOTAL_POSTS) {
          console.log(`🎯 Reached maximum posts limit (${MAX_TOTAL_POSTS}). Stopping processing.`)
          break
        }
      } else {
        console.error(`❌ ${source.name} failed:`, result.reason)
        sourceStats[source.type].failed++
      }
      
      sourceStats[source.type].processed++
    }
    
    // Print detailed summary
    console.log('\n📊 REFRESH SUMMARY:')
    console.log(`🎯 Total new posts: ${newPostsCount} (Limit: ${MAX_TOTAL_POSTS})`)
    console.log(`📰 Sources processed: ${sourceStats.reddit.processed + sourceStats.rss.processed + sourceStats.api.processed}`)
    console.log('\n📈 Source Type Breakdown:')
    console.log(`🔴 Reddit: ${sourceStats.reddit.processed} processed, ${sourceStats.reddit.success} success, ${sourceStats.reddit.failed} failed, ${sourceStats.reddit.totalFetched} posts`)
    console.log(`📡 RSS: ${sourceStats.rss.processed} processed, ${sourceStats.rss.success} success, ${sourceStats.rss.failed} failed, ${sourceStats.rss.totalFetched} posts`)
    console.log(`🔌 API: ${sourceStats.api.processed} processed, ${sourceStats.api.success} success, ${sourceStats.api.failed} failed, ${sourceStats.api.totalFetched} posts`)
    
    console.log(`\n🎉 Content refresh completed!`)
    
    return NextResponse.json({
      success: true,
      message: `Successfully fetched ${newPostsCount} new posts from ${sources.length} sources (Limit: ${MAX_TOTAL_POSTS})`,
      data: { 
        totalFetched: newPostsCount,
        sourcesProcessed: sources.length,
        sourceStats,
        maxPostsLimit: MAX_TOTAL_POSTS,
        maxPostsPerSource: MAX_POSTS_PER_SOURCE,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ Content refresh failed:', error.message)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// Helper function to fetch a single source with timeout and early termination
async function fetchSourceWithTimeout(source, sourceType, maxPosts, redditToken, sourceStats, forceRefresh = false) {
  const startTime = Date.now()
  
  try {
    console.log(`🔍 Processing ${source.name} (${sourceType})`)
    
    let fetchedCount = 0
    
    if (sourceType === 'reddit') {
      fetchedCount = await fetchRedditContent(source, maxPosts, redditToken, forceRefresh)
    } else if (sourceType === 'rss') {
      fetchedCount = await fetchRSSContent(source, maxPosts, forceRefresh)
    } else if (sourceType === 'api') {
      fetchedCount = await fetchAPIContent(source, maxPosts, forceRefresh)
    }
    
    const processingTime = Date.now() - startTime
    console.log(`  ✅ ${source.name} completed: ${fetchedCount} posts (${processingTime}ms)`)
    
    return { fetchedCount, sourceType }
    
  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error(`  ❌ ${source.name} failed after ${processingTime}ms:`, error.message)
    return { fetchedCount: 0, sourceType }
  }
}

async function fetchRedditContent(source, maxPosts, token, forceRefresh = false) {
  console.log(`  📱 Fetching Reddit content from r/${source.config.subreddit}`)
  
  try {
    // Try OAuth endpoint first if we have a token
    if (token) {
      console.log(`    🔐 Using Reddit OAuth endpoint`)
      const oauthUrl = `https://oauth.reddit.com/r/${source.config.subreddit}/${source.config.sortBy}?t=${source.config.timeFilter}&limit=${maxPosts}`
      
      const response = await fetch(oauthUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'DevDigest/1.0.0'
        }
      })
      
      if (response.ok) {
        console.log(`    ✅ Reddit OAuth endpoint succeeded`)
        const data = await response.json()
        const posts = data.data?.children || []
        
        console.log(`    📊 Found ${posts.length} Reddit posts via OAuth`)
        return await processRedditPosts(posts, maxPosts, source, forceRefresh)
      } else {
        console.log(`    ⚠️ Reddit OAuth failed with status ${response.status}, falling back to public endpoint`)
      }
    }
    
    // Fallback to public endpoints (for localhost or when OAuth fails)
    console.log(`    🌐 Using Reddit public endpoint`)
    
    // Try multiple approaches for Reddit public endpoints
    const approaches = [
      // Approach 1: Standard Reddit API
      async () => {
        const url = `https://www.reddit.com/r/${source.config.subreddit}/${source.config.sortBy}.json?t=${source.config.timeFilter}&limit=${maxPosts}`
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DevDigest/1.0.0'
          }
        })
        return response
      },
      // Approach 2: Alternative User-Agent
      async () => {
        const url = `https://www.reddit.com/r/${source.config.subreddit}/${source.config.sortBy}.json?t=${source.config.timeFilter}&limit=${maxPosts}`
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'DevDigest/1.0.0 (by /u/your_username)'
          }
        })
        return response
      },
      // Approach 3: JSON endpoint with minimal headers
      async () => {
        const url = `https://www.reddit.com/r/${source.config.subreddit}/${source.config.sortBy}.json?t=${source.config.timeFilter}&limit=${maxPosts}`
        const response = await fetch(url)
        return response
      }
    ]

    let response = null
    let approachUsed = 0

    for (let i = 0; i < approaches.length; i++) {
      try {
        approachUsed = i + 1
        response = await approaches[i]()
        if (response.ok) {
          console.log(`    ✅ Reddit public approach ${approachUsed} succeeded`)
          break
        }
        console.log(`    ⚠️ Reddit public approach ${approachUsed} failed with status ${response.status}`)
      } catch (error) {
        console.log(`    ⚠️ Reddit public approach ${approachUsed} failed: ${error.message}`)
      }
    }

    if (!response || !response.ok) {
      console.log(`    ❌ All Reddit approaches failed. This is common on localhost.`)
      return 0
    }

    const data = await response.json()
    const posts = data.data?.children || []
    
    console.log(`    📊 Found ${posts.length} Reddit posts via public endpoint`)
    return await processRedditPosts(posts, maxPosts, source, forceRefresh)

  } catch (error) {
    console.error(`  ❌ Reddit fetch failed: ${error.message}`)
    return 0
  }
}

// Helper function to process Reddit posts
async function processRedditPosts(posts, maxPosts, source, forceRefresh = false) {
  let fetchedCount = 0
  let duplicateCount = 0
  
  for (const post of posts.slice(0, maxPosts)) {
    // Safety check to prevent infinite loops
    if (fetchedCount >= maxPosts) {
      console.log(`    🎯 Reached max posts limit (${maxPosts}) for this source`)
      break
    }
    
    const postData = post.data
    
    // Smarter duplicate detection - check if we recently fetched this exact post
    const existingContent = await Content.findOne({ 
      url: postData.url,
      // Only consider it duplicate if fetched in last 24 hours
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
    
    if (existingContent && !forceRefresh) {
      duplicateCount++
      console.log(`    ⏭️ Skipping recently fetched: ${postData.title}`)
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

  console.log(`  ✅ Fetched ${fetchedCount} posts from Reddit (${duplicateCount} recent duplicates skipped)`)
  return fetchedCount
}

async function fetchRSSContent(source, maxPosts, forceRefresh = false) {
  console.log(`  📡 Fetching RSS content from ${source.url}`)
  
  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'DevDigest/1.0.0 (Content Aggregator)'
      },
      // Increased timeout to prevent early breaking
      signal: AbortSignal.timeout(20000)
    })

    if (!response.ok) {
      throw new Error(`RSS feed returned ${response.status}: ${response.statusText}`)
    }

    const xmlText = await response.text()
    
    // Check if we got valid XML content
    if (!xmlText || xmlText.length < 100) {
      throw new Error(`RSS feed returned invalid or empty content (${xmlText?.length || 0} characters)`)
    }
    
    const items = await parseRSSXML(xmlText)
    
    if (items.length === 0) {
      console.log(`    ⚠️ No RSS items found or parsed from ${source.url}`)
      return 0
    }
    
    console.log(`  📊 Found ${items.length} RSS items`)
    
    let fetchedCount = 0
    let duplicateCount = 0
    let errorCount = 0
    
    for (const item of items.slice(0, maxPosts)) {
      // Safety check to prevent infinite loops
      if (fetchedCount >= maxPosts) {
        console.log(`    🎯 Reached max posts limit (${maxPosts}) for this source`)
        break
      }
      
      try {
        // Smarter duplicate detection - check if we recently fetched this exact post
        const existingContent = await Content.findOne({ 
          url: item.link,
          // Only consider it duplicate if fetched in last 24 hours
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
        
        if (existingContent && !forceRefresh) {
          duplicateCount++
          console.log(`    ⏭️ Skipping recently fetched: ${item.title}`)
          continue
        }
        
        // Use RSS description directly - no full content fetching for speed
        let description = item.description?.substring(0, 500) || 'No description available'
        
        // Create content item
        const content = new Content({
          title: item.title,
          url: item.link,
          source: source.name,
          publishedAt: item.pubDate,
          summary: description,
          content: null, // No full content for speed
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
            hasFullContent: false,
            descriptionSource: 'rss_feed'
          }
        })

        await content.save()
        fetchedCount++
        console.log(`    ✅ Saved: ${item.title}`)
        
      } catch (saveError) {
        errorCount++
        console.error(`    ❌ Failed to save: ${item.title} - ${saveError.message}`)
      }
    }

    console.log(`  ✅ Fetched ${fetchedCount} posts from RSS (${duplicateCount} duplicates, ${errorCount} errors)`)
    return fetchedCount

  } catch (error) {
    console.error(`  ❌ RSS fetch failed: ${error.message}`)
    return 0
  }
}

async function fetchAPIContent(source, maxPosts, forceRefresh = false) {
  console.log(`  🔌 Fetching API content from ${source.url}`)
  
  try {
    let fetchedCount = 0
    
    if (source.name === 'Hacker News') {
      // Fetch top stories from HN
      console.log(`    📰 Fetching Hacker News top stories...`)
      
      try {
        const topStoriesResponse = await fetch(source.url, {
          signal: AbortSignal.timeout(15000) // Increased timeout
        })
        
        if (!topStoriesResponse.ok) {
          throw new Error(`HN API returned ${topStoriesResponse.status}`)
        }
        
        const topStories = await topStoriesResponse.json()
        console.log(`    📊 Found ${topStories.length} top stories`)
        
        for (const storyId of topStories.slice(0, maxPosts)) {
          // Safety check to prevent infinite loops
          if (fetchedCount >= maxPosts) {
            console.log(`    🎯 Reached max posts limit (${maxPosts}) for this source`)
            break
          }
          
          try {
            const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`, {
              signal: AbortSignal.timeout(10000) // Increased timeout
            })
            
            if (!storyResponse.ok) {
              console.log(`    ⚠️ Failed to fetch HN story ${storyId}: ${storyResponse.status}`)
              continue
            }
            
            const story = await storyResponse.json()
            
            if (story && story.url && story.title) {
              // Smarter duplicate detection - check if we recently fetched this exact post
              const existingContent = await Content.findOne({ 
                url: story.url,
                // Only consider it duplicate if fetched in last 24 hours
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
              })
              
              if (existingContent && !forceRefresh) {
                console.log(`    ⏭️ Skipping recently fetched HN story: ${story.title}`)
                continue
              }
              
              const content = new Content({
                title: story.title,
                url: story.url,
                source: source.name,
                publishedAt: new Date(story.time * 1000),
                summary: `Hacker News post with ${story.score || 0} points`,
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
                  comments: story.descendants || 0,
                  hnId: storyId
                }
              })

              await content.save()
              fetchedCount++
              console.log(`    ✅ Saved HN story: ${story.title}`)
            }
          } catch (error) {
            console.log(`    ⚠️ Error fetching HN story ${storyId}: ${error.message}`)
          }
        }
        
        console.log(`  ✅ Fetched ${fetchedCount} posts from Hacker News`)
        return fetchedCount
        
      } catch (error) {
        console.error(`    ❌ Hacker News API failed: ${error.message}`)
        return 0
      }
    }
    
    // For other APIs, try to fetch directly
    console.log(`    🔍 Fetching from generic API: ${source.url}`)
    
    const response = await fetch(source.url, {
      headers: source.config?.headers || {},
      signal: AbortSignal.timeout(20000) // Increased timeout
    })
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (Array.isArray(data)) {
      console.log(`    📊 Found ${data.length} items from API`)
      
      for (const item of data.slice(0, maxPosts)) {
        // Safety check to prevent infinite loops
        if (fetchedCount >= maxPosts) {
          console.log(`    🎯 Reached max posts limit (${maxPosts}) for this source`)
          break
        }
        
        if (item.title && item.url) {
          // Smarter duplicate detection - check if we recently fetched this exact post
          const existingContent = await Content.findOne({ 
            url: item.url,
            // Only consider it duplicate if fetched in last 24 hours
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          })
          
          if (existingContent && !forceRefresh) {
            console.log(`    ⏭️ Skipping recently fetched: ${item.title}`)
            continue
          }
          
          const content = new Content({
            title: item.title,
            url: item.url,
            source: source.name,
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
            summary: item.description || item.summary || 'No description available',
            content: item.content || null,
            sentiment: 'neutral',
            category: source.category,
            difficulty: 'Beginner',
            readingTime: Math.ceil((item.title.length + (item.description?.length || 0)) / 200),
            technologies: extractTechnologies(item.title + ' ' + (item.description || '')),
            keyInsights: [],
            quality: 'medium',
            isProcessed: false,
            metadata: {
              author: item.author || 'Unknown',
              tags: item.tags || [],
              wordCount: (item.title.length + (item.description?.length || 0))
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
      }
    } else {
      console.log(`    ⚠️ API returned non-array data: ${typeof data}`)
    }
    
    console.log(`  ✅ Fetched ${fetchedCount} posts from API`)
    return fetchedCount

  } catch (error) {
    console.error(`  ❌ API fetch failed: ${error.message}`)
    return 0
  }
}

async function parseRSSXML(xmlText) {
  try {
    const items = []
    
    // More robust XML parsing for RSS feeds
    const itemMatches = xmlText.match(/<item[^>]*>([\s\S]*?)<\/item>/gi)
    
    if (itemMatches) {
      for (const itemMatch of itemMatches) {
        try {
          const titleMatch = itemMatch.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
          const linkMatch = itemMatch.match(/<link[^>]*>([\s\S]*?)<\/link>/i)
          const descriptionMatch = itemMatch.match(/<description[^>]*>([\s\S]*?)<\/description>/i)
          const pubDateMatch = itemMatch.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
          const authorMatch = itemMatch.match(/<author[^>]*>([\s\S]*?)<\/author>/i)
          
          if (titleMatch && linkMatch) {
            const title = titleMatch[1].replace(/<[^>]*>/g, '').trim()
            const link = linkMatch[1].replace(/<[^>]*>/g, '').trim()
            
            // Skip if title or link is empty
            if (!title || !link || title === 'undefined' || link === 'undefined') {
              continue
            }
            
            items.push({
              title: title,
              link: link,
              description: descriptionMatch ? descriptionMatch[1].replace(/<[^>]*>/g, '').trim() : '',
              pubDate: pubDateMatch ? new Date(pubDateMatch[1].replace(/<[^>]*>/g, '').trim()) : new Date(),
              author: authorMatch ? authorMatch[1].replace(/<[^>]*>/g, '').trim() : 'Unknown'
            })
          }
        } catch (itemError) {
          console.log(`    ⚠️ Error parsing RSS item: ${itemError.message}`)
          continue
        }
      }
    }
    
    console.log(`    📊 Successfully parsed ${items.length} RSS items`)
    return items
  } catch (error) {
    console.error('Error parsing RSS XML:', error.message)
    return []
  }
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