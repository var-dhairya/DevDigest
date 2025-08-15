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

async function testEnhancedFetching() {
  try {
    console.log('🧪 Testing Enhanced Fetching Algorithm...')
    console.log('=' .repeat(50))
    
    await connectDB()
    
    // Get a sample Reddit source for testing
    const redditSource = await Source.findOne({ 
      type: 'reddit', 
      isActive: true,
      'config.subreddit': { $exists: true }
    })
    
    if (!redditSource) {
      console.log('❌ No Reddit sources found for testing')
      return
    }
    
    console.log(`📋 Testing with source: ${redditSource.name}`)
    console.log(`🎯 Subreddit: r/${redditSource.config.subreddit}`)
    console.log(`⚙️ Config: ${redditSource.config.sortBy}/${redditSource.config.timeFilter}`)
    
    // Get current content count
    const contentBefore = await Content.countDocuments({ source: redditSource.name })
    console.log(`📊 Current content count: ${contentBefore}`)
    
    // Test the enhanced refresh endpoint
    console.log('\n🚀 Triggering enhanced refresh...')
    
    const startTime = Date.now()
    const response = await fetch('http://localhost:3000/api/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000
    
    if (!response.ok) {
      console.log(`❌ Refresh API failed: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.log('Error details:', errorText)
      return
    }
    
    const result = await response.json()
    console.log(`⏱️ Refresh completed in ${duration.toFixed(2)} seconds`)
    
    // Get updated content count
    const contentAfter = await Content.countDocuments({ source: redditSource.name })
    const newContent = contentAfter - contentBefore
    
    console.log('\n📊 RESULTS:')
    console.log('=' .repeat(30))
    console.log(`✅ API Success: ${result.success}`)
    console.log(`📈 Total new posts: ${result.data?.totalFetched || 0}`)
    console.log(`📋 Sources processed: ${result.data?.sourcesProcessed || 0}`)
    console.log(`🎯 Max posts limit: ${result.data?.maxPostsLimit || 'N/A'}`)
    console.log(`⏱️ Duration: ${duration.toFixed(2)}s`)
    console.log(`📊 ${redditSource.name} new content: ${newContent}`)
    
    if (result.data?.sourceStats) {
      console.log('\n📈 Source Type Breakdown:')
      const stats = result.data.sourceStats
      console.log(`🔴 Reddit: ${stats.reddit?.success || 0} success, ${stats.reddit?.failed || 0} failed, ${stats.reddit?.totalFetched || 0} posts`)
      console.log(`📡 RSS: ${stats.rss?.success || 0} success, ${stats.rss?.failed || 0} failed, ${stats.rss?.totalFetched || 0} posts`)
      console.log(`🔌 API: ${stats.api?.success || 0} success, ${stats.api?.failed || 0} failed, ${stats.api?.totalFetched || 0} posts`)
    }
    
    // Test multiple refresh calls to ensure consistency
    console.log('\n🔄 Testing consistency with multiple calls...')
    const consistencyResults = []
    
    for (let i = 1; i <= 3; i++) {
      console.log(`\n📞 Call ${i}:`)
      const callStart = Date.now()
      
      const callResponse = await fetch('http://localhost:3000/api/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const callEnd = Date.now()
      const callDuration = (callEnd - callStart) / 1000
      
      if (callResponse.ok) {
        const callResult = await callResponse.json()
        const callNewPosts = callResult.data?.totalFetched || 0
        consistencyResults.push({
          call: i,
          success: true,
          posts: callNewPosts,
          duration: callDuration
        })
        console.log(`✅ Call ${i}: ${callNewPosts} posts in ${callDuration.toFixed(2)}s`)
      } else {
        consistencyResults.push({
          call: i,
          success: false,
          posts: 0,
          duration: callDuration
        })
        console.log(`❌ Call ${i}: Failed in ${callDuration.toFixed(2)}s`)
      }
      
      // Small delay between calls
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // Analyze consistency
    console.log('\n📊 CONSISTENCY ANALYSIS:')
    console.log('=' .repeat(30))
    const successfulCalls = consistencyResults.filter(r => r.success)
    const totalPosts = successfulCalls.reduce((sum, r) => sum + r.posts, 0)
    const avgPosts = successfulCalls.length > 0 ? totalPosts / successfulCalls.length : 0
    const avgDuration = successfulCalls.length > 0 ? 
      successfulCalls.reduce((sum, r) => sum + r.duration, 0) / successfulCalls.length : 0
    
    console.log(`✅ Successful calls: ${successfulCalls.length}/3`)
    console.log(`📈 Total posts across calls: ${totalPosts}`)
    console.log(`📊 Average posts per call: ${avgPosts.toFixed(1)}`)
    console.log(`⏱️ Average duration: ${avgDuration.toFixed(2)}s`)
    
    // Success criteria
    const minExpectedPosts = 1 // At least 1 post should be fetched in most calls
    const successfulWithPosts = successfulCalls.filter(r => r.posts >= minExpectedPosts).length
    
    console.log(`\n🎯 SUCCESS CRITERIA:`)
    console.log(`- Calls that fetched ≥${minExpectedPosts} posts: ${successfulWithPosts}/3`)
    console.log(`- All calls successful: ${successfulCalls.length === 3 ? '✅' : '❌'}`)
    console.log(`- Average response time < 30s: ${avgDuration < 30 ? '✅' : '❌'}`)
    
    if (successfulWithPosts >= 2 && successfulCalls.length >= 2 && avgDuration < 30) {
      console.log('\n🎉 ENHANCED FETCHING ALGORITHM: PASSED')
      console.log('✅ The algorithm successfully ensures consistent content fetching!')
    } else {
      console.log('\n⚠️ ENHANCED FETCHING ALGORITHM: NEEDS IMPROVEMENT')
      console.log('❌ The algorithm may need further optimization.')
    }
    
    // Show sample of recent content
    console.log('\n📄 Recent Content Sample:')
    const recentContent = await Content.find({ source: redditSource.name })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('title source createdAt metadata.fetchStrategy')
    
    recentContent.forEach((content, index) => {
      const age = Math.floor((Date.now() - new Date(content.createdAt)) / (1000 * 60))
      console.log(`${index + 1}. ${content.title}`)
      console.log(`   Source: ${content.source} | Age: ${age}m | Strategy: ${content.metadata?.fetchStrategy || 'N/A'}`)
    })
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Stack trace:', error.stack)
  }
}

// Helper function to check if the server is running
async function checkServerHealth() {
  try {
    const response = await fetch('http://localhost:3000/api/health', {
      signal: AbortSignal.timeout(5000)
    })
    return response.ok
  } catch (error) {
    return false
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🏥 Checking server health...')
  
  const isServerRunning = await checkServerHealth()
  
  if (!isServerRunning) {
    console.log('❌ Server is not running at http://localhost:3000')
    console.log('💡 Please start the development server first:')
    console.log('   npm run dev')
    process.exit(1)
  }
  
  testEnhancedFetching()
    .then(() => {
      console.log('\n✅ Test completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Test failed:', error)
      process.exit(1)
    })
}

export default testEnhancedFetching
