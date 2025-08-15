import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '..', '.env.local') })

import { connectDB } from '../lib/database.js'
import Source from '../models/Source.js'

async function manualAddMedium() {
  try {
    console.log('🔌 Connecting to database...')
    await connectDB()
    
    // Check if Medium source already exists
    const existingSource = await Source.findOne({ name: 'Medium AI RSS' })
    
    if (existingSource) {
      console.log('✅ Medium AI RSS source already exists')
      console.log(`  - Active: ${existingSource.isActive}`)
      console.log(`  - Last fetched: ${existingSource.lastFetched || 'Never'}`)
      console.log(`  - Total fetched: ${existingSource.stats?.totalFetched || 0}`)
      
      // Update to ensure it's active
      await Source.updateOne(
        { name: 'Medium AI RSS' },
        { 
          $set: { 
            isActive: true,
            priority: 1
          }
        }
      )
      console.log('🔄 Updated source to be active and high priority')
      
    } else {
      console.log('📝 Creating new Medium AI RSS source...')
      
      const mediumSource = new Source({
        name: 'Medium AI RSS',
        type: 'rss',
        url: 'https://medium.com/feed/tag/artificial-intelligence',
        description: 'Medium AI articles RSS feed',
        category: 'AI Articles',
        priority: 1,
        isActive: true,
        config: {
          rssParser: 'default'
        },
        filters: {
          includeKeywords: ['ai', 'artificial intelligence', 'machine learning'],
          excludeKeywords: ['spam', 'advertisement'],
          minWordCount: 50 // Very lenient
        }
      })
      
      await mediumSource.save()
      console.log('✅ Created Medium AI RSS source')
    }
    
    // Show all sources
    const allSources = await Source.find({}).sort({ priority: 1 })
    console.log(`\n📊 Total sources: ${allSources.length}`)
    
    const mediumSources = allSources.filter(s => s.name.includes('Medium'))
    if (mediumSources.length > 0) {
      console.log('\n📱 Medium sources:')
      mediumSources.forEach(source => {
        console.log(`  - ${source.name} (${source.type}) - ${source.isActive ? '✅ Active' : '❌ Inactive'}`)
        console.log(`    URL: ${source.url}`)
        console.log(`    Priority: ${source.priority}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Failed to add Medium source:', error.message)
    console.error('Stack trace:', error.stack)
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  manualAddMedium()
    .then(() => {
      console.log('\n✅ Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Script failed:', error)
      process.exit(1)
    })
}

export default manualAddMedium
