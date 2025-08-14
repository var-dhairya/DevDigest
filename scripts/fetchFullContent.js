import { connectDB } from '../lib/database.js'
import Content from '../models/Content.js'
import dotenv from 'dotenv'

dotenv.config()

async function fetchFullContent() {
  try {
    await connectDB()
    console.log('🔗 Connected to database')
    
    // Find content that doesn't have full content yet
    const contents = await Content.find({ 
      $or: [
        { content: { $exists: false } },
        { content: null },
        { content: '' }
      ]
    }).limit(10) // Process 10 at a time to avoid overwhelming
    
    console.log(`📝 Found ${contents.length} posts without full content`)
    
    for (const post of contents) {
      try {
        console.log(`\n🔍 Processing: ${post.title}`)
        console.log(`  📍 URL: ${post.url}`)
        
        // Skip if it's a Reddit post (we already have selftext)
        if (post.source.includes('Reddit')) {
          console.log(`  ⚠️ Skipping Reddit post (should have selftext)`)
          continue
        }
        
        // Try to fetch content from the URL
        const response = await fetch(post.url, {
          headers: {
            'User-Agent': 'DevDigest/1.0.0 (Content Fetcher)'
          },
          timeout: 10000 // 10 second timeout
        })
        
        if (!response.ok) {
          console.log(`  ❌ Failed to fetch: ${response.status}`)
          continue
        }
        
        const html = await response.text()
        
        // Extract text content (simple approach)
        const textContent = extractTextFromHTML(html)
        
        if (textContent && textContent.length > post.summary.length) {
          // Update the post with full content
          post.content = textContent.substring(0, 50000) // Limit to 50k chars
          await post.save()
          console.log(`  ✅ Updated with ${textContent.length} characters of content`)
        } else {
          console.log(`  ⚠️ No additional content found`)
        }
        
        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error) {
        console.error(`  ❌ Error processing ${post.title}:`, error.message)
      }
    }
    
    console.log('\n🎉 Full content fetching completed!')
    
  } catch (error) {
    console.error('❌ Script failed:', error.message)
  } finally {
    process.exit(0)
  }
}

function extractTextFromHTML(html) {
  // Simple text extraction - remove HTML tags and decode entities
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace common entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

// Run the script
fetchFullContent() 