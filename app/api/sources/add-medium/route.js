import { NextResponse } from 'next/server'
import { connectDB } from '../../../../lib/database.js'
import Source from '../../../../models/Source.js'

export async function POST() {
  try {
    console.log('📝 Adding Medium sources...')
    
    await connectDB()
    
    // Medium RSS sources
    const mediumSources = [
      {
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
          includeKeywords: ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network'],
          excludeKeywords: ['spam', 'advertisement'],
          minWordCount: 50 // Very lenient
        }
      },
      {
        name: 'Medium Startups RSS',
        type: 'rss',
        url: 'https://medium.com/feed/tag/startup',
        description: 'Medium startup articles RSS feed',
        category: 'Startup Articles',
        priority: 1,
        isActive: true,
        config: {
          rssParser: 'default'
        },
        filters: {
          includeKeywords: ['startup', 'entrepreneur', 'business', 'funding', 'growth', 'product', 'saas'],
          excludeKeywords: ['spam', 'advertisement'],
          minWordCount: 50 // Very lenient
        }
      },
      {
        name: 'Medium Programming RSS',
        type: 'rss',
        url: 'https://medium.com/feed/tag/programming',
        description: 'Medium programming articles RSS feed',
        category: 'Programming Articles',
        priority: 1,
        isActive: true,
        config: {
          rssParser: 'default'
        },
        filters: {
          includeKeywords: ['javascript', 'python', 'react', 'node', 'web', 'development', 'coding'],
          excludeKeywords: ['spam', 'advertisement'],
          minWordCount: 50 // Very lenient
        }
      }
    ]
    
    const results = []
    
    for (const sourceData of mediumSources) {
      try {
        // Check if source already exists
        const existingSource = await Source.findOne({ name: sourceData.name })
        
        if (existingSource) {
          // Update existing source
          await Source.updateOne(
            { name: sourceData.name },
            { 
              $set: { 
                isActive: true,
                filters: sourceData.filters,
                priority: sourceData.priority,
                url: sourceData.url,
                description: sourceData.description,
                category: sourceData.category
              }
            }
          )
          results.push({ name: sourceData.name, action: 'updated', success: true })
          console.log(`✅ Updated existing source: ${sourceData.name}`)
        } else {
          // Create new source
          const source = new Source(sourceData)
          await source.save()
          results.push({ name: sourceData.name, action: 'created', success: true })
          console.log(`✅ Created new source: ${sourceData.name}`)
        }
      } catch (error) {
        results.push({ name: sourceData.name, action: 'failed', success: false, error: error.message })
        console.error(`❌ Failed to process ${sourceData.name}:`, error.message)
      }
    }
    
    // Show current sources
    const allSources = await Source.find({}).sort({ priority: 1 })
    const mediumSourcesInDB = allSources.filter(s => s.name.includes('Medium'))
    
    console.log(`\n📊 Total sources in database: ${allSources.length}`)
    console.log(`📱 Medium sources: ${mediumSourcesInDB.length}`)
    
    return NextResponse.json({
      success: true,
      message: 'Medium sources processed successfully',
      data: {
        results,
        totalSources: allSources.length,
        mediumSources: mediumSourcesInDB.length,
        sources: mediumSourcesInDB.map(s => ({
          name: s.name,
          url: s.url,
          isActive: s.isActive,
          priority: s.priority
        }))
      }
    })
    
  } catch (error) {
    console.error('❌ Failed to add Medium sources:', error.message)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
