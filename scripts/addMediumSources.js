import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '..', '.env.local') })

import { connectDB } from '../lib/database.js'
import Source from '../models/Source.js'

// Medium RSS sources
const mediumSources = [
  {
    name: 'Medium AI RSS',
    type: 'rss',
    url: 'https://medium.com/feed/tag/artificial-intelligence',
    description: 'Medium AI articles RSS feed',
    category: 'AI Articles',
    priority: 5,
    isActive: true,
    config: {
      rssParser: 'default'
    },
    filters: {
      includeKeywords: ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network'],
      excludeKeywords: ['spam', 'advertisement'],
      minWordCount: 100 // Reduced from 200 to be more lenient
    }
  },
  {
    name: 'Medium Startups RSS',
    type: 'rss',
    url: 'https://medium.com/feed/tag/startup',
    description: 'Medium startup articles RSS feed',
    category: 'Startup Articles',
    priority: 5,
    isActive: true,
    config: {
      rssParser: 'default'
    },
    filters: {
      includeKeywords: ['startup', 'entrepreneur', 'business', 'funding', 'growth', 'product', 'saas'],
      excludeKeywords: ['spam', 'advertisement'],
      minWordCount: 100 // Reduced from 200 to be more lenient
    }
  },
  {
    name: 'Medium Programming RSS',
    type: 'rss',
    url: 'https://medium.com/feed/tag/programming',
    description: 'Medium programming articles RSS feed',
    category: 'Programming Articles',
    priority: 5,
    isActive: true,
    config: {
      rssParser: 'default'
    },
    filters: {
      includeKeywords: ['javascript', 'python', 'react', 'node', 'web', 'development', 'coding'],
      excludeKeywords: ['spam', 'advertisement'],
      minWordCount: 100 // Reduced from 200 to be more lenient
    }
  }
]

async function addMediumSources() {
  try {
    console.log('🔌 Connecting to database...')
    await connectDB()
    
    console.log('📰 Adding Medium sources...')
    
    for (const sourceData of mediumSources) {
      // Check if source already exists
      const existingSource = await Source.findOne({ name: sourceData.name })
      
      if (existingSource) {
        console.log(`✅ Source already exists: ${sourceData.name}`)
        // Update the existing source to ensure it's active
        await Source.updateOne(
          { name: sourceData.name },
          { 
            $set: { 
              isActive: true,
              filters: sourceData.filters,
              priority: sourceData.priority
            }
          }
        )
        console.log(`🔄 Updated existing source: ${sourceData.name}`)
      } else {
        const source = new Source(sourceData)
        await source.save()
        console.log(`✅ Created new source: ${sourceData.name}`)
      }
    }
    
    console.log('🎉 Medium sources added successfully!')
    
    // Show current sources
    const allSources = await Source.find({}).sort({ priority: 1 })
    console.log(`\n📊 Total sources in database: ${allSources.length}`)
    console.log('📋 Active sources:')
    allSources.forEach(source => {
      console.log(`  - ${source.name} (${source.type}) - ${source.isActive ? '✅ Active' : '❌ Inactive'}`)
    })
    
  } catch (error) {
    console.error('❌ Failed to add Medium sources:', error.message)
    console.error('Stack trace:', error.stack)
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addMediumSources()
    .then(() => {
      console.log('✅ Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Script failed:', error)
      process.exit(1)
    })
}

export default addMediumSources
