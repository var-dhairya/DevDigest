import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

// POST /api/analysis - Analyze content with Gemini AI
export async function POST(request) {
  try {
    const body = await request.json()
    const { title, content, url } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    // Check if API key is available
    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Prepare content for analysis
    const analysisPrompt = `
    Analyze the following tech article and provide insights in JSON format:
    
    Title: ${title}
    Content: ${content}
    URL: ${url}
    
    Please provide analysis in this exact JSON format:
    {
      "summary": "2-3 sentence summary of the article",
      "sentiment": "positive/negative/neutral",
      "category": "specific category like 'Frontend Development', 'AI/ML', 'DevOps', 'Mobile Development', 'Backend Development', 'Data Science', 'Cybersecurity', 'Cloud Computing'",
      "difficulty": "Beginner/Intermediate/Advanced",
      "readingTime": "estimated reading time in minutes (number only)",
      "technologies": ["array", "of", "main", "technologies", "mentioned"],
      "keyInsights": ["array", "of", "2-3", "key", "takeaways"],
      "quality": "high/medium/low based on content depth and usefulness"
    }
    
    Focus on accuracy and be specific with categories and technologies.
    `

    try {
      // Generate content using Gemini
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
      const result = await model.generateContent(analysisPrompt)
      const response = await result.response
      const analysisText = response.text()

      // Extract JSON from response
      let analysis
      try {
        // Find JSON in the response (sometimes Gemini adds extra text)
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in response')
        }
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', parseError)
        console.log('Raw response:', analysisText)
        
        // Fallback analysis
        analysis = {
          summary: content.substring(0, 200) + '...',
          sentiment: 'neutral',
          category: 'Technology',
          difficulty: 'Intermediate',
          readingTime: Math.ceil(content.length / 200),
          technologies: [],
          keyInsights: ['Content analysis failed'],
          quality: 'medium'
        }
      }

      return NextResponse.json({
        success: true,
        analysis,
        rawResponse: analysisText
      })

    } catch (geminiError) {
      console.error('Gemini API error:', geminiError)
      
      // Fallback analysis when Gemini fails
      const fallbackAnalysis = {
        summary: content.substring(0, 200) + '...',
        sentiment: 'neutral',
        category: 'Technology',
        difficulty: 'Intermediate',
        readingTime: Math.ceil(content.length / 200),
        technologies: [],
        keyInsights: ['AI analysis unavailable'],
        quality: 'medium'
      }

      return NextResponse.json({
        success: false,
        analysis: fallbackAnalysis,
        error: 'AI analysis failed, using fallback',
        geminiError: geminiError.message
      })
    }

  } catch (error) {
    console.error('Analysis API error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze content' },
      { status: 500 }
    )
  }
}

// GET /api/analysis/sentiments - Get sentiment distribution
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'sentiments') {
      // This would typically query your database
      // For now, return sample data
      return NextResponse.json({
        sentiments: {
          positive: 45,
          neutral: 35,
          negative: 20
        }
      })
    }

    if (type === 'categories') {
      return NextResponse.json({
        categories: {
          'Frontend Development': 30,
          'Backend Development': 25,
          'AI/ML': 20,
          'DevOps': 15,
          'Mobile Development': 10
        }
      })
    }

    return NextResponse.json(
      { error: 'Invalid analysis type requested' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Analysis GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analysis data' },
      { status: 500 }
    )
  }
} 