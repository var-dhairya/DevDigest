import { NextResponse } from 'next/server'
import { connectDB } from '../../../../../lib/database.js'
import Content from '../../../../../models/Content.js'
import AIAnalyzer from '../../../../../lib/aiAnalyzer.js'

// Function to fetch Reddit comments
async function fetchRedditComments(url) {
  try {
    if (!url.includes('reddit.com')) {
      return null
    }
    
    // Convert Reddit URL to JSON endpoint
    const jsonUrl = url.replace(/\/$/, '') + '.json'
    
    console.log(`🔗 Attempting to fetch Reddit comments from: ${jsonUrl}`)
    
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })
    
    if (!response.ok) {
      console.log(`⚠️ Reddit API returned ${response.status}: ${response.statusText}`)
      if (response.status === 403) {
        console.log('🚫 Reddit is blocking our requests. This is common with their public JSON endpoints.')
        console.log('💡 Comments will not be available for analysis.')
      }
      return null
    }
    
    const data = await response.json()
    
    // Extract comments from Reddit JSON response
    const comments = []
    if (data && data.length > 1 && data[1].data && data[1].data.children) {
      const extractComments = (commentData, depth = 0) => {
        if (depth > 3) return // Limit depth to avoid too much data
        
        for (const comment of commentData) {
          if (comment.data && comment.data.body && comment.data.body !== '[deleted]' && comment.data.body !== '[removed]') {
            comments.push({
              body: comment.data.body,
              author: comment.data.author,
              score: comment.data.score,
              depth: depth
            })
            
            // Recursively extract replies
            if (comment.data.replies && comment.data.replies.data && comment.data.replies.data.children) {
              extractComments(comment.data.replies.data.children, depth + 1)
            }
          }
        }
      }
      
      extractComments(data[1].data.children)
      console.log(`✅ Successfully extracted ${comments.length} comments from Reddit`)
    } else {
      console.log('⚠️ No comment data found in Reddit response')
    }
    
    return comments.slice(0, 50) // Limit to 50 comments
  } catch (error) {
    console.error('❌ Error fetching Reddit comments:', error.message)
    return null
  }
}

// Function to fetch full article content
async function fetchFullArticleContent(url) {
  try {
    if (url.includes('reddit.com')) {
      return null // Reddit content is already in the post
    }
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DevDigest/1.0.0 (Content Analyzer)'
      },
      timeout: 15000
    })
    
    if (!response.ok) {
      return null
    }
    
    const html = await response.text()
    
    // Extract main content using common selectors
    const contentSelectors = [
      'article',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      'main',
      '.post-body',
      '.article-body'
    ]
    
    let content = ''
    
    // Try to find content using selectors
    for (const selector of contentSelectors) {
      const elements = html.match(new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'gi'))
      if (elements && elements.length > 0) {
        content = elements.join(' ')
        break
      }
    }
    
    // If no structured content found, extract from body
    if (!content) {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      if (bodyMatch) {
        content = bodyMatch[1]
      }
    }
    
    if (content) {
      // Clean the HTML content
      return content
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
        .substring(0, 10000) // Limit to 10k characters
    }
    
    return null
  } catch (error) {
    console.error('Error fetching full article content:', error.message)
    return null
  }
}

export async function POST(request, { params }) {
  try {
    await connectDB()
    const { id } = params
    
    console.log(`🔍 Starting comprehensive analysis for content ID: ${id}`)
    
    // Find the content item
    const content = await Content.findById(id)
    if (!content) {
      return NextResponse.json({
        success: false,
        error: 'Content not found'
      }, { status: 404 })
    }

    console.log(`📝 Found content: ${content.title}`)
    console.log(`🔗 URL: ${content.url}`)

    // Fetch additional content and comments
    const [comments, fullContent] = await Promise.all([
      fetchRedditComments(content.url),
      fetchFullArticleContent(content.url)
    ])
    
    console.log(`💬 Fetched ${comments?.length || 0} comments`)
    console.log(`📄 Full content length: ${fullContent?.length || 0} characters`)

    // Create enhanced content object with comments and full content
    const enhancedContent = {
      ...content.toObject(),
      fullContent: fullContent || content.content || content.summary,
      comments: comments || [],
      hasComments: comments && comments.length > 0,
      hasFullContent: !!(fullContent || content.content)
    }

    // Initialize AI analyzer
    const aiAnalyzer = new AIAnalyzer()
    
    console.log(`🤖 Starting AI analysis...`)
    
    // Analyze the enhanced content
    const result = await aiAnalyzer.analyzeEnhancedContent(enhancedContent)
    
    if (result.success) {
      console.log(`✅ AI analysis successful`)
      
      // Update the content with AI analysis
      await Content.findByIdAndUpdate(id, {
        ...result.analysis,
        isProcessed: true,
        updatedAt: new Date()
      })
      
      return NextResponse.json({
        success: true,
        message: 'Content analyzed successfully with full content and comments',
        analysis: result.analysis,
        metadata: {
          commentsCount: comments?.length || 0,
          fullContentLength: fullContent?.length || 0,
          hasComments: !!(comments && comments.length > 0),
          hasFullContent: !!(fullContent || content.content)
        }
      })
    } else {
      console.log(`⚠️ AI analysis failed, using enhanced fallback`)
      
      // Return the enhanced fallback analysis
      return NextResponse.json({
        success: false,
        message: 'AI analysis failed, using enhanced fallback',
        error: result.error,
        analysis: result.analysis,
        metadata: {
          commentsCount: comments?.length || 0,
          fullContentLength: fullContent?.length || 0,
          hasComments: !!(comments && comments.length > 0),
          hasFullContent: !!(fullContent || content.content)
        }
      })
    }

  } catch (error) {
    console.error('Error analyzing content:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
} 