import { NextResponse } from 'next/server'
import { connectDB } from '../../../lib/database.js'
import Source from '../../../models/Source.js'
import Content from '../../../models/Content.js'

export async function GET() {
  try {
    console.log('🔍 Debug endpoint called')
    
    // Test database connection
    let dbConnected = false
    let dbError = null
    try {
      await connectDB()
      dbConnected = true
    } catch (error) {
      dbError = error.message
    }
    
    let sources = []
    let contentCount = 0
    
    if (dbConnected) {
      // Get all sources
      sources = await Source.find({ isActive: true })
      contentCount = await Content.countDocuments()
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        vercelUrl: process.env.VERCEL_URL || 'not-set',
        hasMongoUri: !!process.env.MONGODB_URI,
        hasRedditClientId: !!process.env.REDDIT_CLIENT_ID,
        hasRedditClientSecret: !!process.env.REDDIT_CLIENT_SECRET,
        hasRedditRedirectUri: !!process.env.REDDIT_REDIRECT_URI_PRODUCTION
      },
      database: {
        connected: dbConnected,
        error: dbError,
        sources: {
          total: sources.length,
          list: sources.map(s => ({
            name: s.name,
            type: s.type,
            url: s.url,
            isActive: s.isActive
          }))
        },
        content: {
          total: contentCount
        }
      }
    })
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error.message)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
