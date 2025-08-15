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
    // Progressive exploration strategy - try multiple approaches to find new content
    const explorationStrategies = [
      // Primary strategy: Use source's configured sort/time
      {
        sortBy: source.config.sortBy || 'hot',
        timeFilter: source.config.timeFilter || 'day',
        limit: maxPosts,
        description: 'primary configured strategy'
      },
      // Secondary strategies: Try different combinations when primary fails
      {
        sortBy: 'top',
        timeFilter: 'week',
        limit: Math.min(maxPosts * 2, 100), // Go deeper
        description: 'top weekly posts (deeper content)'
      },
      {
        sortBy: 'top',
        timeFilter: 'month',
        limit: Math.min(maxPosts * 3, 150), // Go even deeper
        description: 'top monthly posts (historical content)'
      },
      {
        sortBy: 'new',
        timeFilter: 'day',
        limit: maxPosts,
        description: 'new posts from today'
      },
      {
        sortBy: 'rising',
        timeFilter: 'day',
        limit: maxPosts,
        description: 'rising posts from today'
      }
    ]

    let totalFetched = 0
    let strategyIndex = 0
    let lastFetchCount = 0

    // Try strategies progressively until we get content or exhaust all options
    while (totalFetched < maxPosts && strategyIndex < explorationStrategies.length) {
      const strategy = explorationStrategies[strategyIndex]
      console.log(`    🔍 Strategy ${strategyIndex + 1}: ${strategy.description}`)
      
      const strategyResult = await fetchRedditWithStrategy(
        source, 
        strategy, 
        maxPosts - totalFetched, 
        token, 
        forceRefresh,
        strategyIndex
      )
      
      if (strategyResult.fetchedCount > 0) {
        totalFetched += strategyResult.fetchedCount
        lastFetchCount = strategyResult.fetchedCount
        console.log(`    ✅ Strategy ${strategyIndex + 1} yielded ${strategyResult.fetchedCount} posts`)
        
        // If we got a good amount of content, we can be more selective with remaining strategies
        if (strategyResult.fetchedCount >= maxPosts * 0.6) {
          console.log(`    🎯 Good content yield, being selective with remaining strategies`)
          break
        }
      } else {
        console.log(`    ⚠️ Strategy ${strategyIndex + 1} yielded no new content`)
      }
      
      strategyIndex++
      
      // Small delay between strategies to be respectful to Reddit
      if (strategyIndex < explorationStrategies.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`  📊 Total fetched: ${totalFetched} posts using ${strategyIndex} strategies`)
    return totalFetched

  } catch (error) {
    console.error(`  ❌ Reddit fetch failed: ${error.message}`)
    return 0
  }
}

// Helper function to fetch Reddit content with a specific strategy
async function fetchRedditWithStrategy(source, strategy, targetPosts, token, forceRefresh, strategyIndex) {
  try {
    // Try OAuth endpoint first if we have a token
    if (token) {
      console.log(`      🔐 Using Reddit OAuth endpoint for ${strategy.sortBy}/${strategy.timeFilter}`)
      const oauthUrl = `https://oauth.reddit.com/r/${source.config.subreddit}/${strategy.sortBy}?t=${strategy.timeFilter}&limit=${strategy.limit}`
      
      const response = await fetch(oauthUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'DevDigest/1.0.0'
        }
      })
      
      if (response.ok) {
        console.log(`      ✅ Reddit OAuth endpoint succeeded`)
        const data = await response.json()
        const posts = data.data?.children || []
        
        console.log(`      📊 Found ${posts.length} Reddit posts via OAuth`)
        return await processRedditPostsWithStrategy(posts, targetPosts, source, forceRefresh, strategy, strategyIndex)
      } else {
        console.log(`      ⚠️ Reddit OAuth failed with status ${response.status}, falling back to public endpoint`)
      }
    }
    
    // Fallback to public endpoints
    console.log(`      🌐 Using Reddit public endpoint for ${strategy.sortBy}/${strategy.timeFilter}`)
    
    // Try multiple approaches for Reddit public endpoints
    const approaches = [
      // Approach 1: Standard Reddit API
      async () => {
        const url = `https://www.reddit.com/r/${source.config.subreddit}/${strategy.sortBy}.json?t=${strategy.timeFilter}&limit=${strategy.limit}`
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DevDigest/1.0.0'
          }
        })
        return response
      },
      // Approach 2: Alternative User-Agent
      async () => {
        const url = `https://www.reddit.com/r/${source.config.subreddit}/${strategy.sortBy}.json?t=${strategy.timeFilter}&limit=${strategy.limit}`
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'DevDigest/1.0.0 (by /u/your_username)'
          }
        })
        return response
      },
      // Approach 3: JSON endpoint with minimal headers
      async () => {
        const url = `https://www.reddit.com/r/${source.config.subreddit}/${strategy.sortBy}.json?t=${strategy.timeFilter}&limit=${strategy.limit}`
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
          console.log(`      ✅ Reddit public approach ${approachUsed} succeeded`)
          break
        }
        console.log(`      ⚠️ Reddit public approach ${approachUsed} failed with status ${response.status}`)
      } catch (error) {
        console.log(`      ⚠️ Reddit public approach ${approachUsed} failed: ${error.message}`)
      }
    }

    if (!response || !response.ok) {
      console.log(`      ❌ All Reddit approaches failed for ${strategy.sortBy}/${strategy.timeFilter}`)
      return { fetchedCount: 0, sourceType: 'reddit' }
    }

    const data = await response.json()
    const posts = data.data?.children || []
    
    console.log(`      📊 Found ${posts.length} Reddit posts via public endpoint`)
    return await processRedditPostsWithStrategy(posts, targetPosts, source, forceRefresh, strategy, strategyIndex)

  } catch (error) {
    console.error(`      ❌ Strategy fetch failed: ${error.message}`)
    return { fetchedCount: 0, sourceType: 'reddit' }
  }
}

// Enhanced Reddit post processing with strategy awareness
async function processRedditPostsWithStrategy(posts, targetPosts, source, forceRefresh, strategy, strategyIndex) {
  let fetchedCount = 0
  let duplicateCount = 0
  let filteredCount = 0
  let processedCount = 0
  
  // Sort posts by relevance to strategy (newer posts first for new/rising, higher scores for top)
  const sortedPosts = [...posts].sort((a, b) => {
    if (strategy.sortBy === 'new' || strategy.sortBy === 'rising') {
      return b.data.created_utc - a.data.created_utc
    } else if (strategy.sortBy === 'top') {
      return b.data.score - a.data.score
    } else {
      return b.data.score - a.data.score // hot posts by score
    }
  })
  
  for (const post of sortedPosts) {
    // Safety check to prevent infinite loops
    if (fetchedCount >= targetPosts) {
      console.log(`        🎯 Reached target posts limit (${targetPosts}) for this strategy`)
      break
    }
    
    processedCount++
    const postData = post.data
    
    // Enhanced duplicate detection with strategy awareness
    const existingContent = await Content.findOne({ 
      url: postData.url
    })
    
    if (existingContent && !forceRefresh) {
      duplicateCount++
      if (duplicateCount <= 3) { // Only log first few duplicates to avoid spam
        console.log(`        ⏭️ Skipping duplicate: ${postData.title}`)
      }
      continue
    }
    
    // More intelligent filtering based on strategy
    let shouldInclude = true
    let filterReason = ''
    
    // Check word count filter (more lenient for deeper strategies)
    if (source.filters?.minWordCount) {
      const totalWords = (postData.title?.length || 0) + (postData.selftext?.length || 0)
      const minRequired = strategy.sortBy === 'top' && strategy.timeFilter === 'month' 
        ? Math.max(15, source.filters.minWordCount / 20) // Very lenient for historical content
        : Math.max(20, source.filters.minWordCount / 10) // Standard leniency
      
      if (totalWords < minRequired) {
        filterReason = `word count: ${totalWords} < ${minRequired}`
        shouldInclude = false
      }
    }
    
    // Check include keywords (more flexible for deeper strategies)
    if (source.filters?.includeKeywords && source.filters.includeKeywords.length > 0) {
      const text = (postData.title + ' ' + (postData.selftext || '')).toLowerCase()
      const hasKeyword = source.filters.includeKeywords.some(keyword => 
        text.includes(keyword.toLowerCase())
      )
      
      // For deeper strategies, be more flexible with keyword matching
      if (!hasKeyword) {
        if (strategy.sortBy === 'top' && (strategy.timeFilter === 'week' || strategy.timeFilter === 'month')) {
          // For historical top posts, only require partial keyword match
          const partialMatch = source.filters.includeKeywords.some(keyword => {
            const keywordParts = keyword.toLowerCase().split(' ')
            return keywordParts.some(part => text.includes(part))
          })
          if (!partialMatch) {
            filterReason = `missing keywords: ${source.filters.includeKeywords.join(', ')}`
            shouldInclude = false
          }
        } else {
          filterReason = `missing keywords: ${source.filters.includeKeywords.join(', ')}`
          shouldInclude = false
        }
      }
    }
    
    // Check exclude keywords (keep this strict)
    if (source.filters?.excludeKeywords && source.filters.excludeKeywords.length > 0) {
      const text = (postData.title + ' ' + (postData.selftext || '')).toLowerCase()
      const hasExcludeKeyword = source.filters.excludeKeywords.some(keyword => 
        text.includes(keyword.toLowerCase())
      )
      if (hasExcludeKeyword) {
        filterReason = `exclude keywords: ${source.filters.excludeKeywords.join(', ')}`
        shouldInclude = false
      }
    }
    
    if (!shouldInclude) {
      filteredCount++
      if (filteredCount <= 3) { // Only log first few filtered posts
        console.log(`        ⚠️ Filtered out due to ${filterReason}`)
      }
      continue
    }
    
    // Create content item with strategy metadata
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
        preview: postData.preview,
        // Strategy metadata for tracking
        fetchStrategy: `${strategy.sortBy}_${strategy.timeFilter}`,
        strategyDepth: strategyIndex,
        originalScore: postData.score,
        originalRank: processedCount
      }
    })

    try {
      await content.save()
      fetchedCount++
      console.log(`        ✅ Saved: ${postData.title} (${strategy.sortBy}/${strategy.timeFilter})`)
    } catch (saveError) {
      console.error(`        ❌ Failed to save: ${postData.title} - ${saveError.message}`)
    }
  }

  console.log(`      📊 Strategy ${strategy.sortBy}/${strategy.timeFilter}: ${fetchedCount} posts fetched (${duplicateCount} duplicates, ${filteredCount} filtered, ${processedCount} processed)`)
  return { fetchedCount, sourceType: 'reddit' }
}

async function fetchRSSContent(source, maxPosts, forceRefresh = false) {
  console.log(`  📡 Fetching RSS content from ${source.url}`)
  
  try {
    // Progressive RSS exploration strategy
    const rssStrategies = [
      // Primary strategy: Standard RSS fetch
      {
        url: source.url,
        description: 'primary RSS endpoint',
        timeout: 20000,
        headers: {
          'User-Agent': 'DevDigest/1.0.0 (Content Aggregator)'
        }
      },
      // Secondary strategy: Try with different User-Agent
      {
        url: source.url,
        description: 'alternative User-Agent',
        timeout: 25000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 DevDigest/1.0.0'
        }
      },
      // Tertiary strategy: Minimal headers for compatibility
      {
        url: source.url,
        description: 'minimal headers',
        timeout: 30000,
        headers: {}
      }
    ]

    let totalFetched = 0
    let strategyIndex = 0

    // Try strategies progressively until we get content or exhaust all options
    while (totalFetched < maxPosts && strategyIndex < rssStrategies.length) {
      const strategy = rssStrategies[strategyIndex]
      console.log(`    🔍 RSS Strategy ${strategyIndex + 1}: ${strategy.description}`)
      
      try {
        const response = await fetch(strategy.url, {
          headers: strategy.headers,
          signal: AbortSignal.timeout(strategy.timeout)
        })

        console.log(`      📊 HTTP response status: ${response.status} ${response.statusText}`)

        if (!response.ok) {
          console.log(`      ⚠️ Strategy ${strategyIndex + 1} failed: ${response.status} ${response.statusText}`)
          strategyIndex++
          continue
        }

        const xmlText = await response.text()
        console.log(`      📄 Response size: ${xmlText.length} characters`)
        
        // Check if we got valid XML content
        if (!xmlText || xmlText.length < 100) {
          console.log(`      ⚠️ Strategy ${strategyIndex + 1} returned invalid content (${xmlText?.length || 0} characters)`)
          strategyIndex++
          continue
        }
        
        // Check if it looks like RSS/XML
        if (!xmlText.includes('<rss') && !xmlText.includes('<feed') && !xmlText.includes('<item')) {
          console.log(`      ⚠️ Strategy ${strategyIndex + 1} response doesn't look like RSS/XML`)
          strategyIndex++
          continue
        }
        
        console.log(`      ✅ Valid RSS/XML format detected`)
        
        const items = await parseRSSXML(xmlText)
        
        if (items.length === 0) {
          console.log(`      ⚠️ Strategy ${strategyIndex + 1} yielded no RSS items`)
          strategyIndex++
          continue
        }
        
        console.log(`      📊 Found ${items.length} RSS items`)
        
        // Process items with this strategy
        const strategyResult = await processRSSItemsWithStrategy(
          items, 
          maxPosts - totalFetched, 
          source, 
          forceRefresh, 
          strategy,
          strategyIndex
        )
        
        if (strategyResult.fetchedCount > 0) {
          totalFetched += strategyResult.fetchedCount
          console.log(`      ✅ Strategy ${strategyIndex + 1} yielded ${strategyResult.fetchedCount} posts`)
          
          // If we got a good amount of content, we can be more selective
          if (strategyResult.fetchedCount >= maxPosts * 0.6) {
            console.log(`      🎯 Good content yield, being selective with remaining strategies`)
            break
          }
        } else {
          console.log(`      ⚠️ Strategy ${strategyIndex + 1} yielded no new content`)
        }
        
      } catch (strategyError) {
        console.log(`      ❌ Strategy ${strategyIndex + 1} failed: ${strategyError.message}`)
      }
      
      strategyIndex++
      
      // Small delay between strategies
      if (strategyIndex < rssStrategies.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`  📊 Total RSS fetched: ${totalFetched} posts using ${strategyIndex} strategies`)
    return totalFetched

  } catch (error) {
    console.error(`  ❌ RSS fetch failed: ${error.message}`)
    console.error(`  📋 Full error:`, error)
    return 0
  }
}

// Enhanced RSS item processing with strategy awareness
async function processRSSItemsWithStrategy(items, targetPosts, source, forceRefresh, strategy, strategyIndex) {
  let fetchedCount = 0
  let duplicateCount = 0
  let errorCount = 0
  let filteredCount = 0
  let processedCount = 0
  
  // Sort items by date (newest first) for better content discovery
  const sortedItems = [...items].sort((a, b) => {
    const dateA = a.pubDate ? new Date(a.pubDate) : new Date(0)
    const dateB = b.pubDate ? new Date(b.pubDate) : new Date(0)
    return dateB - dateA
  })
  
  for (const item of sortedItems) {
    // Safety check to prevent infinite loops
    if (fetchedCount >= targetPosts) {
      console.log(`        🎯 Reached target posts limit (${targetPosts}) for this strategy`)
      break
    }
    
    processedCount++
    
    try {
      console.log(`        🔍 Processing item: ${item.title?.substring(0, 50)}...`)
      
      // Enhanced duplicate detection
      const existingContent = await Content.findOne({ 
        url: item.link
      })
      
      if (existingContent && !forceRefresh) {
        duplicateCount++
        if (duplicateCount <= 3) { // Only log first few duplicates
          console.log(`        ⏭️ Skipping duplicate: ${item.title}`)
        }
        continue
      }
      
      // Use RSS description directly - no full content fetching for speed
      let description = item.description?.substring(0, 500) || 'No description available'
      
      // More intelligent filtering based on strategy
      let shouldInclude = true
      let filterReason = ''
      
      // Check word count filter (more lenient for RSS)
      if (source.filters?.minWordCount) {
        const totalWords = (item.title?.length || 0) + (description?.length || 0)
        const minRequired = Math.max(15, source.filters.minWordCount / 15) // More lenient for RSS
        if (totalWords < minRequired) {
          filterReason = `word count: ${totalWords} < ${minRequired}`
          shouldInclude = false
        }
      }
      
      // Check include keywords (more flexible for RSS)
      if (source.filters?.includeKeywords && source.filters.includeKeywords.length > 0) {
        const text = (item.title + ' ' + description).toLowerCase()
        const hasKeyword = source.filters.includeKeywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        )
        
        // For RSS, be more flexible with keyword matching
        if (!hasKeyword) {
          const partialMatch = source.filters.includeKeywords.some(keyword => {
            const keywordParts = keyword.toLowerCase().split(' ')
            return keywordParts.some(part => text.includes(part))
          })
          if (!partialMatch) {
            filterReason = `missing keywords: ${source.filters.includeKeywords.join(', ')}`
            shouldInclude = false
          }
        }
      }
      
      // Check exclude keywords (keep this strict)
      if (source.filters?.excludeKeywords && source.filters.excludeKeywords.length > 0) {
        const text = (item.title + ' ' + description).toLowerCase()
        const hasExcludeKeyword = source.filters.excludeKeywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        )
        if (hasExcludeKeyword) {
          filterReason = `exclude keywords: ${source.filters.excludeKeywords.join(', ')}`
          shouldInclude = false
        }
      }
      
      if (!shouldInclude) {
        filteredCount++
        if (filteredCount <= 3) { // Only log first few filtered posts
          console.log(`        ⚠️ Filtered out due to ${filterReason}`)
        }
        continue
      }
      
      console.log(`        ✅ Item passed all filters, creating content...`)
      
      // Create content item with strategy metadata
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
          descriptionSource: 'rss_feed',
          // Strategy metadata for tracking
          fetchStrategy: strategy.description,
          strategyIndex: strategyIndex,
          originalRank: processedCount
        }
      })

      await content.save()
      fetchedCount++
      console.log(`        ✅ Saved: ${item.title} (${strategy.description})`)
      
    } catch (saveError) {
      errorCount++
      console.error(`        ❌ Failed to save: ${item.title} - ${saveError.message}`)
    }
  }

  console.log(`        📊 Strategy ${strategy.description}: ${fetchedCount} posts fetched (${duplicateCount} duplicates, ${filteredCount} filtered, ${errorCount} errors, ${processedCount} processed)`)
  return { fetchedCount, sourceType: 'rss' }
}

async function fetchAPIContent(source, maxPosts, forceRefresh = false) {
  console.log(`  🔌 Fetching API content from ${source.url}`)
  
  try {
    let totalFetched = 0
    
    if (source.name === 'Hacker News') {
      // Enhanced Hacker News fetching with progressive strategies
      console.log(`    📰 Fetching Hacker News with progressive strategies...`)
      
      const hnStrategies = [
        // Primary strategy: Top stories
        {
          endpoint: 'topstories',
          description: 'top stories',
          limit: maxPosts
        },
        // Secondary strategy: Best stories (different content)
        {
          endpoint: 'beststories',
          description: 'best stories',
          limit: Math.min(maxPosts * 2, 100)
        },
        // Tertiary strategy: New stories (fresh content)
        {
          endpoint: 'newstories',
          description: 'new stories',
          limit: Math.min(maxPosts * 2, 100)
        }
      ]

      let strategyIndex = 0

      // Try strategies progressively until we get content or exhaust all options
      while (totalFetched < maxPosts && strategyIndex < hnStrategies.length) {
        const strategy = hnStrategies[strategyIndex]
        console.log(`    🔍 HN Strategy ${strategyIndex + 1}: ${strategy.description}`)
        
        try {
          const storiesResponse = await fetch(`https://hacker-news.firebaseio.com/v0/${strategy.endpoint}.json`, {
            signal: AbortSignal.timeout(15000)
          })
          
          if (!storiesResponse.ok) {
            console.log(`      ⚠️ HN Strategy ${strategyIndex + 1} failed: ${storiesResponse.status}`)
            strategyIndex++
            continue
          }
          
          const stories = await storiesResponse.json()
          console.log(`      📊 Found ${stories.length} ${strategy.description}`)
          
          // Process stories with this strategy
          const strategyResult = await processHNStoriesWithStrategy(
            stories.slice(0, strategy.limit), 
            maxPosts - totalFetched, 
            source, 
            forceRefresh, 
            strategy,
            strategyIndex
          )
          
          if (strategyResult.fetchedCount > 0) {
            totalFetched += strategyResult.fetchedCount
            console.log(`      ✅ HN Strategy ${strategyIndex + 1} yielded ${strategyResult.fetchedCount} posts`)
            
            // If we got a good amount of content, we can be more selective
            if (strategyResult.fetchedCount >= maxPosts * 0.6) {
              console.log(`      🎯 Good content yield, being selective with remaining strategies`)
              break
            }
          } else {
            console.log(`      ⚠️ HN Strategy ${strategyIndex + 1} yielded no new content`)
          }
          
        } catch (strategyError) {
          console.log(`      ❌ HN Strategy ${strategyIndex + 1} failed: ${strategyError.message}`)
        }
        
        strategyIndex++
        
        // Small delay between strategies
        if (strategyIndex < hnStrategies.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      console.log(`  ✅ Total HN fetched: ${totalFetched} posts using ${strategyIndex} strategies`)
      return totalFetched
    }
    
    // For other APIs, try progressive strategies
    console.log(`    🔍 Fetching from generic API with progressive strategies: ${source.url}`)
    
    const apiStrategies = [
      // Primary strategy: Standard API call
      {
        url: source.url,
        description: 'primary API endpoint',
        timeout: 20000,
        headers: source.config?.headers || {}
      },
      // Secondary strategy: Try with different parameters
      {
        url: source.url.includes('?') ? `${source.url}&limit=${maxPosts * 2}` : `${source.url}?limit=${maxPosts * 2}`,
        description: 'increased limit',
        timeout: 25000,
        headers: source.config?.headers || {}
      },
      // Tertiary strategy: Try with minimal parameters
      {
        url: source.url.split('?')[0], // Remove query parameters
        description: 'minimal parameters',
        timeout: 30000,
        headers: {}
      }
    ]

    let strategyIndex = 0

    // Try strategies progressively until we get content or exhaust all options
    while (totalFetched < maxPosts && strategyIndex < apiStrategies.length) {
      const strategy = apiStrategies[strategyIndex]
      console.log(`    🔍 API Strategy ${strategyIndex + 1}: ${strategy.description}`)
      
      try {
        const response = await fetch(strategy.url, {
          headers: strategy.headers,
          signal: AbortSignal.timeout(strategy.timeout)
        })
        
        if (!response.ok) {
          console.log(`      ⚠️ API Strategy ${strategyIndex + 1} failed: ${response.status} ${response.statusText}`)
          strategyIndex++
          continue
        }
        
        const data = await response.json()
        
        if (Array.isArray(data)) {
          console.log(`      📊 Found ${data.length} items from API`)
          
          // Process items with this strategy
          const strategyResult = await processAPIItemsWithStrategy(
            data, 
            maxPosts - totalFetched, 
            source, 
            forceRefresh, 
            strategy,
            strategyIndex
          )
          
          if (strategyResult.fetchedCount > 0) {
            totalFetched += strategyResult.fetchedCount
            console.log(`      ✅ API Strategy ${strategyIndex + 1} yielded ${strategyResult.fetchedCount} posts`)
            
            // If we got a good amount of content, we can be more selective
            if (strategyResult.fetchedCount >= maxPosts * 0.6) {
              console.log(`      🎯 Good content yield, being selective with remaining strategies`)
              break
            }
          } else {
            console.log(`      ⚠️ API Strategy ${strategyIndex + 1} yielded no new content`)
          }
        } else {
          console.log(`      ⚠️ API Strategy ${strategyIndex + 1} returned non-array data: ${typeof data}`)
        }
        
      } catch (strategyError) {
        console.log(`      ❌ API Strategy ${strategyIndex + 1} failed: ${strategyError.message}`)
      }
      
      strategyIndex++
      
      // Small delay between strategies
      if (strategyIndex < apiStrategies.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    console.log(`  ✅ Total API fetched: ${totalFetched} posts using ${strategyIndex} strategies`)
    return totalFetched

  } catch (error) {
    console.error(`  ❌ API fetch failed: ${error.message}`)
    return 0
  }
}

// Enhanced Hacker News story processing with strategy awareness
async function processHNStoriesWithStrategy(stories, targetPosts, source, forceRefresh, strategy, strategyIndex) {
  let fetchedCount = 0
  let duplicateCount = 0
  let errorCount = 0
  let processedCount = 0
  
  for (const storyId of stories) {
    // Safety check to prevent infinite loops
    if (fetchedCount >= targetPosts) {
      console.log(`        🎯 Reached target posts limit (${targetPosts}) for this strategy`)
      break
    }
    
    processedCount++
    
    try {
      const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`, {
        signal: AbortSignal.timeout(10000)
      })
      
      if (!storyResponse.ok) {
        console.log(`        ⚠️ Failed to fetch HN story ${storyId}: ${storyResponse.status}`)
        continue
      }
      
      const story = await storyResponse.json()
      
      if (story && story.url && story.title) {
        // Enhanced duplicate detection
        const existingContent = await Content.findOne({ 
          url: story.url
        })
        
        if (existingContent && !forceRefresh) {
          duplicateCount++
          if (duplicateCount <= 3) { // Only log first few duplicates
            console.log(`        ⏭️ Skipping duplicate HN story: ${story.title}`)
          }
          continue
        }
        
        const content = new Content({
          title: story.title,
          url: story.url,
          source: source.name,
          publishedAt: new Date(story.time * 1000),
          summary: `Hacker News ${strategy.description} with ${story.score || 0} points`,
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
            hnId: storyId,
            // Strategy metadata for tracking
            fetchStrategy: strategy.description,
            strategyIndex: strategyIndex,
            originalRank: processedCount
          }
        })

        await content.save()
        fetchedCount++
        console.log(`        ✅ Saved HN story: ${story.title} (${strategy.description})`)
      }
    } catch (error) {
      errorCount++
      if (errorCount <= 3) { // Only log first few errors
        console.log(`        ⚠️ Error fetching HN story ${storyId}: ${error.message}`)
      }
    }
  }
  
  console.log(`        📊 HN Strategy ${strategy.description}: ${fetchedCount} posts fetched (${duplicateCount} duplicates, ${errorCount} errors, ${processedCount} processed)`)
  return { fetchedCount, sourceType: 'api' }
}

// Enhanced API item processing with strategy awareness
async function processAPIItemsWithStrategy(items, targetPosts, source, forceRefresh, strategy, strategyIndex) {
  let fetchedCount = 0
  let duplicateCount = 0
  let filteredCount = 0
  let processedCount = 0
  
  // Sort items by relevance (newer first if date available, otherwise by order)
  const sortedItems = [...items].sort((a, b) => {
    if (a.publishedAt && b.publishedAt) {
      return new Date(b.publishedAt) - new Date(a.publishedAt)
    }
    return 0 // Keep original order if no dates
  })
  
  for (const item of sortedItems) {
    // Safety check to prevent infinite loops
    if (fetchedCount >= targetPosts) {
      console.log(`        🎯 Reached target posts limit (${targetPosts}) for this strategy`)
      break
    }
    
    processedCount++
    
    if (item.title && item.url) {
      // Enhanced duplicate detection
      const existingContent = await Content.findOne({ 
        url: item.url
      })
      
      if (existingContent && !forceRefresh) {
        duplicateCount++
        if (duplicateCount <= 3) { // Only log first few duplicates
          console.log(`        ⏭️ Skipping duplicate: ${item.title}`)
        }
        continue
      }
      
      // More intelligent filtering based on strategy
      let shouldInclude = true
      let filterReason = ''
      
      // Check word count filter (more lenient for API content)
      if (source.filters?.minWordCount) {
        const totalWords = (item.title?.length || 0) + (item.description?.length || 0)
        const minRequired = Math.max(15, source.filters.minWordCount / 15) // More lenient for API
        if (totalWords < minRequired) {
          filterReason = `word count: ${totalWords} < ${minRequired}`
          shouldInclude = false
        }
      }
      
      // Check include keywords (more flexible for API content)
      if (source.filters?.includeKeywords && source.filters.includeKeywords.length > 0) {
        const text = (item.title + ' ' + (item.description || '')).toLowerCase()
        const hasKeyword = source.filters.includeKeywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        )
        
        // For API content, be more flexible with keyword matching
        if (!hasKeyword) {
          const partialMatch = source.filters.includeKeywords.some(keyword => {
            const keywordParts = keyword.toLowerCase().split(' ')
            return keywordParts.some(part => text.includes(part))
          })
          if (!partialMatch) {
            filterReason = `missing keywords: ${source.filters.includeKeywords.join(', ')}`
            shouldInclude = false
          }
        }
      }
      
      // Check exclude keywords (keep this strict)
      if (source.filters?.excludeKeywords && source.filters.excludeKeywords.length > 0) {
        const text = (item.title + ' ' + (item.description || '')).toLowerCase()
        const hasExcludeKeyword = source.filters.excludeKeywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        )
        if (hasExcludeKeyword) {
          filterReason = `exclude keywords: ${source.filters.excludeKeywords.join(', ')}`
          shouldInclude = false
        }
      }
      
      if (!shouldInclude) {
        filteredCount++
        if (filteredCount <= 3) { // Only log first few filtered posts
          console.log(`        ⚠️ Filtered out due to ${filterReason}`)
        }
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
          wordCount: (item.title.length + (item.description?.length || 0)),
          // Strategy metadata for tracking
          fetchStrategy: strategy.description,
          strategyIndex: strategyIndex,
          originalRank: processedCount
        }
      })

      try {
        await content.save()
        fetchedCount++
        console.log(`        ✅ Saved: ${item.title} (${strategy.description})`)
      } catch (saveError) {
        console.error(`        ❌ Failed to save: ${item.title} - ${saveError.message}`)
      }
    }
  }
  
  console.log(`        📊 API Strategy ${strategy.description}: ${fetchedCount} posts fetched (${duplicateCount} duplicates, ${filteredCount} filtered, ${processedCount} processed)`)
  return { fetchedCount, sourceType: 'api' }
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