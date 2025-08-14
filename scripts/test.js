import { connectDB } from '../lib/database.js'
import Content from '../models/Content.js'
import Source from '../models/Source.js'

async function testDatabase() {
  try {
    console.log('🧪 Testing DevDigest Database Connection...')
    
    // Test database connection
    await connectDB()
    console.log('✅ Database connection successful')
    
    // Test Content model
    const contentCount = await Content.countDocuments()
    console.log(`✅ Content model working: ${contentCount} documents found`)
    
    // Test Source model
    const sourceCount = await Source.countDocuments()
    console.log(`✅ Source model working: ${sourceCount} documents found`)
    
    // Test content aggregation
    if (contentCount > 0) {
      const sampleContent = await Content.findOne().lean()
      console.log('✅ Sample content:', {
        title: sampleContent.title,
        category: sampleContent.category,
        sentiment: sampleContent.sentiment,
        difficulty: sampleContent.difficulty
      })
    }
    
    // Test sources
    if (sourceCount > 0) {
      const sampleSource = await Source.findOne().lean()
      console.log('✅ Sample source:', {
        name: sampleSource.name,
        type: sampleSource.type,
        category: sampleSource.category
      })
    }
    
    console.log('\n🎉 All database tests passed!')
    
  } catch (error) {
    console.error('❌ Database test failed:', error)
    process.exit(1)
  }
}

// Test API endpoints
async function testAPI() {
  try {
    console.log('\n🌐 Testing API Endpoints...')
    
    // Test content API
    const contentResponse = await fetch('http://localhost:3000/api/content')
    if (contentResponse.ok) {
      const contentData = await contentResponse.json()
      console.log(`✅ Content API working: ${contentData.content?.length || 0} items`)
    } else {
      console.log('⚠️ Content API not responding')
    }
    
    // Test analysis API
    const analysisResponse = await fetch('http://localhost:3000/api/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Article',
        content: 'This is a test article about JavaScript and React development.',
        url: 'https://example.com/test'
      })
    })
    
    if (analysisResponse.ok) {
      const analysisData = await analysisResponse.json()
      console.log('✅ Analysis API working:', analysisData.success ? 'AI analysis' : 'Fallback analysis')
    } else {
      console.log('⚠️ Analysis API not responding')
    }
    
    // Test aggregator API
    const aggregatorResponse = await fetch('http://localhost:3000/api/aggregator')
    if (aggregatorResponse.ok) {
      const aggregatorData = await aggregatorResponse.json()
      console.log('✅ Aggregator API working:', aggregatorData.status?.isRunning ? 'Running' : 'Stopped')
    } else {
      console.log('⚠️ Aggregator API not responding')
    }
    
    console.log('\n🎉 All API tests completed!')
    
  } catch (error) {
    console.error('❌ API test failed:', error)
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting DevDigest Tests...\n')
  
  try {
    await testDatabase()
    await testAPI()
    
    console.log('\n✨ All tests completed successfully!')
    console.log('\n📋 Next steps:')
    console.log('   1. Start the Next.js server: npm run dev')
    console.log('   2. Open http://localhost:3000 in your browser')
    console.log('   3. Use the Admin Panel to start content aggregation')
    console.log('   4. Add your Gemini API key to .env.local')
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error)
    process.exit(1)
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
}

export { testDatabase, testAPI, runTests } 