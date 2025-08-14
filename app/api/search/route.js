import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

export async function POST(request) {
  try {
    const { query, feedContext, postContent } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Create context from post content or feed data
    let contextPrompt = ''
    if (postContent) {
      // Post-specific context
      contextPrompt = `\n\nPost Context:\nTitle: ${postContent.title}\nSource: ${postContent.source}\nSummary: ${postContent.summary || 'No summary available'}\n\nPlease provide helpful information about this specific post. If the post content is not adequate for the question, you can provide general AI/Tech/Startup related context.`
    } else if (feedContext && feedContext.length > 0) {
      // General feed context
      const recentArticles = feedContext.slice(0, 5).map(article => 
        `- ${article.title} (${article.source})`
      ).join('\n')
      
      contextPrompt = `\n\nCurrent feed context (recent articles):\n${recentArticles}\n\nPlease consider this context when answering, but you can also provide general information beyond these articles.`
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `You are a helpful AI assistant for a tech news aggregator called DevDigest. A user is asking: "${query}"

${contextPrompt}

Please provide a helpful, informative response. If the question relates to current tech news, you can reference the feed context provided. If it's a general question about technology, programming, or any other topic, feel free to provide comprehensive information.

Keep your response conversational, helpful, and well-structured. If you're referencing specific articles from the feed context, mention them appropriately.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    return NextResponse.json({ 
      response: text,
      success: true 
    })

  } catch (error) {
    console.error('Search API error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      apiKey: process.env.GOOGLE_API_KEY ? 'Present' : 'Missing'
    })
    return NextResponse.json({ 
      error: 'Failed to process search query',
      details: error.message 
    }, { status: 500 })
  }
} 