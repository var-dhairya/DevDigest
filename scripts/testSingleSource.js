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

async function testSingleSource() {
  try {
    console.log('🔌 Connecting to database...')
    await connectDB()
    
    // Get a Medium source
    const mediumSource = await Source.findOne({ name: 'Medium AI RSS' })
    
    if (!mediumSource) {
      console.log('❌ Medium AI RSS source not found')
      return
    }
    
    console.log(`📰 Testing source: ${mediumSource.name}`)
    console.log(`🔗 URL: ${mediumSource.url}`)
    console.log(`🏷️ Type: ${mediumSource.type}`)
    console.log(`✅ Active: ${mediumSource.isActive}`)
    
    // Test fetching RSS content
    console.log('\n📡 Fetching RSS content...')
    
    const response = await fetch(mediumSource.url, {
      headers: {
        'User-Agent': 'DevDigest/1.0.0 (Content Aggregator)'
      }
    })
    
    if (!response.ok) {
      throw new Error(`RSS feed returned ${response.status}: ${response.statusText}`)
    }
    
    const xmlText = await response.text()
    console.log(`✅ RSS response size: ${xmlText.length} characters`)
    
    // Parse RSS XML
    console.log('\n🔍 Parsing RSS XML...')
    const items = await parseRSSXML(xmlText)
    console.log(`✅ Parsed ${items.length} RSS items`)
    
    if (items.length > 0) {
      console.log('\n📋 Sample items:')
      items.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.title}`)
        console.log(`     Link: ${item.link}`)
        console.log(`     Description: ${item.description?.substring(0, 100)}...`)
      })
      
      // Test saving one item
      console.log('\n💾 Testing content save...')
      const testItem = items[0]
      
      // Check if it already exists
      const existingContent = await Content.findOne({ url: testItem.link })
      if (existingContent) {
        console.log(`⚠️ Item already exists in database: ${testItem.title}`)
      } else {
        console.log(`✅ Item is new, can be saved`)
        
        // Test the filtering logic
        console.log('\n🔍 Testing filtering logic...')
        let shouldInclude = true
        
        // Check word count filter
        if (mediumSource.filters?.minWordCount) {
          const totalWords = (testItem.title?.length || 0) + (testItem.description?.length || 0)
          const minRequired = Math.max(20, mediumSource.filters.minWordCount / 10)
          console.log(`  Word count: ${totalWords} (required: ${minRequired})`)
          
          if (totalWords < minRequired) {
            console.log(`  ❌ Filtered out due to word count`)
            shouldInclude = false
          } else {
            console.log(`  ✅ Word count filter passed`)
          }
        }
        
        // Check include keywords
        if (mediumSource.filters?.includeKeywords && mediumSource.filters.includeKeywords.length > 0) {
          const text = (testItem.title + ' ' + (testItem.description || '')).toLowerCase()
          const hasKeyword = mediumSource.filters.includeKeywords.some(keyword => 
            text.includes(keyword.toLowerCase())
          )
          console.log(`  Include keywords: ${mediumSource.filters.includeKeywords.join(', ')}`)
          
          if (!hasKeyword) {
            console.log(`  ❌ Filtered out due to missing keywords`)
            shouldInclude = false
          } else {
            console.log(`  ✅ Keyword filter passed`)
          }
        }
        
        console.log(`\n🎯 Final result: ${shouldInclude ? '✅ INCLUDED' : '❌ FILTERED OUT'}`)
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Stack trace:', error.stack)
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
    
    return items
  } catch (error) {
    console.error('Error parsing RSS XML:', error.message)
    return []
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSingleSource()
    .then(() => {
      console.log('\n✅ Test completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Test failed:', error)
      process.exit(1)
    })
}

export default testSingleSource
