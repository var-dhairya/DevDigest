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

async function checkDatabase() {
  try {
    console.log('🔌 Connecting to database...')
    await connectDB()
    
    console.log('\n📊 DATABASE STATUS:')
    console.log('==================')
    
    // Check sources
    const sources = await Source.find({}).sort({ priority: 1 })
    console.log(`\n📰 Sources: ${sources.length} total`)
    
    const activeSources = sources.filter(s => s.isActive)
    const inactiveSources = sources.filter(s => !s.isActive)
    
    console.log(`  ✅ Active: ${activeSources.length}`)
    console.log(`  ❌ Inactive: ${inactiveSources.length}`)
    
    // Show source types
    const sourceTypes = {}
    sources.forEach(source => {
      sourceTypes[source.type] = (sourceTypes[source.type] || 0) + 1
    })
    
    console.log('\n🔍 Source Types:')
    Object.entries(sourceTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`)
    })
    
    // Show Medium sources specifically
    const mediumSources = sources.filter(s => s.name.includes('Medium'))
    if (mediumSources.length > 0) {
      console.log('\n📱 Medium Sources:')
      mediumSources.forEach(source => {
        console.log(`  - ${source.name} (${source.type}) - ${source.isActive ? '✅ Active' : '❌ Inactive'}`)
        console.log(`    URL: ${source.url}`)
        console.log(`    Last fetched: ${source.lastFetched || 'Never'}`)
        console.log(`    Success: ${source.stats?.lastFetchSuccess ? '✅' : '❌'}`)
        console.log(`    Total fetched: ${source.stats?.totalFetched || 0}`)
      })
    }
    
    // Check content
    const totalContent = await Content.countDocuments()
    const recentContent = await Content.find({})
      .sort({ createdAt: -1 })
      .limit(5)
    
    console.log(`\n📄 Content: ${totalContent} total articles`)
    
    if (recentContent.length > 0) {
      console.log('\n🆕 Recent Content:')
      recentContent.forEach(content => {
        const age = Math.floor((Date.now() - new Date(content.createdAt)) / (1000 * 60 * 60 * 24))
        console.log(`  - ${content.title}`)
        console.log(`    Source: ${content.source}`)
        console.log(`    Age: ${age} days ago`)
        console.log(`    URL: ${content.url}`)
      })
    }
    
    // Check for content by source
    console.log('\n📊 Content by Source:')
    const contentBySource = await Content.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
    
    contentBySource.forEach(item => {
      console.log(`  ${item._id}: ${item.count} articles`)
    })
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message)
    console.error('Stack trace:', error.stack)
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkDatabase()
    .then(() => {
      console.log('\n✅ Database check completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Database check failed:', error)
      process.exit(1)
    })
}

export default checkDatabase
