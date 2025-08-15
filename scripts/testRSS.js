// Test RSS feeds
const testFeeds = [
  {
    name: 'Medium AI',
    url: 'https://medium.com/feed/tag/artificial-intelligence'
  },
  {
    name: 'Medium Startups',
    url: 'https://medium.com/feed/tag/startup'
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/'
  }
]

async function testRSSFeeds() {
  console.log('🧪 Testing RSS feeds...\n')
  
  for (const feed of testFeeds) {
    try {
      console.log(`📡 Testing ${feed.name}: ${feed.url}`)
      
      const response = await fetch(feed.url, {
        headers: {
          'User-Agent': 'DevDigest/1.0.0 (RSS Tester)'
        },
        timeout: 10000
      })
      
      if (!response.ok) {
        console.log(`  ❌ HTTP ${response.status}: ${response.statusText}`)
        continue
      }
      
      const xmlText = await response.text()
      console.log(`  ✅ Response size: ${xmlText.length} characters`)
      
      // Check if it looks like RSS/XML
      if (xmlText.includes('<rss') || xmlText.includes('<feed') || xmlText.includes('<item')) {
        console.log(`  ✅ Valid RSS/XML format detected`)
        
        // Count items
        const itemCount = (xmlText.match(/<item/g) || []).length
        const entryCount = (xmlText.match(/<entry/g) || []).length
        const totalItems = itemCount + entryCount
        
        console.log(`  📊 Found ${totalItems} items (${itemCount} RSS items, ${entryCount} Atom entries)`)
        
        // Show first item title if available
        const titleMatch = xmlText.match(/<title[^>]*>([^<]+)<\/title>/i)
        if (titleMatch) {
          console.log(`  📝 Sample title: ${titleMatch[1].substring(0, 100)}...`)
        }
        
      } else {
        console.log(`  ❌ Doesn't look like RSS/XML`)
        console.log(`  📋 First 200 chars: ${xmlText.substring(0, 200)}...`)
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`)
    }
    
    console.log('') // Empty line for readability
  }
}

// Run the test
testRSSFeeds()
  .then(() => {
    console.log('✅ RSS testing completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ RSS testing failed:', error)
    process.exit(1)
  })
