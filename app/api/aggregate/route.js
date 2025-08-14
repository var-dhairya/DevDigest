import { NextResponse } from 'next/server'
import ContentAggregator from '../../../lib/contentAggregator.js'
import AIAnalyzer from '../../../lib/aiAnalyzer.js'
import { connectDB } from '../../../lib/database.js'
import Content from '../../../models/Content.js'

// Singleton instances
let aggregator = null
let aiAnalyzer = null

export async function GET() {
  try {
    await connectDB()
    
    // Initialize services if not already done
    if (!aggregator) {
      aggregator = new ContentAggregator()
    }
    if (!aiAnalyzer) {
      aiAnalyzer = new AIAnalyzer()
    }

    const status = {
      aggregator: await aggregator.getStatus(),
      aiAnalyzer: await aiAnalyzer.getStatus(),
      timestamp: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      message: 'Content aggregation service status',
      data: status
    })

  } catch (error) {
    console.error('Error getting aggregation status:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    await connectDB()
    
    // Initialize services if not already done
    if (!aggregator) {
      aggregator = new ContentAggregator()
    }
    if (!aiAnalyzer) {
      aiAnalyzer = new AIAnalyzer()
    }

    // Check if aggregator is already running
    if (aggregator.isRunning) {
              return NextResponse.json({
          success: false,
          error: 'Content aggregator is already running',
          data: await aggregator.getStatus()
        }, { status: 409 })
    }

    // Start aggregation in background
    aggregator.start().then(async (success) => {
      if (success) {
        console.log('🎯 Content aggregation completed successfully!')
      }
    }).catch(error => {
      console.error('❌ Content aggregation failed:', error)
    })

         return NextResponse.json({
       success: true,
       message: 'Content aggregation started',
       data: {
         aggregator: await aggregator.getStatus(),
         aiAnalyzer: await aiAnalyzer.getStatus(),
         timestamp: new Date().toISOString()
       }
     })

  } catch (error) {
    console.error('Error starting content aggregation:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    if (aggregator && aggregator.isRunning) {
      aggregator.stop()
      return NextResponse.json({
        success: true,
        message: 'Content aggregator stopped',
        data: await aggregator.getStatus()
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Content aggregator is not running'
      }, { status: 404 })
    }
  } catch (error) {
    console.error('Error stopping content aggregator:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
} 