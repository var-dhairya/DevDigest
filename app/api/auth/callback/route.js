import { NextResponse } from 'next/server'
import { connectDB } from '../../../lib/database.js'
import Source from '../../../models/Source.js'

// Force dynamic rendering to prevent static optimization issues
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    // Get search parameters without using request.url
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Get the base URL - VERCEL_URL is automatically available in Vercel
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://dev-digest-ag.vercel.app'

    if (error) {
      console.error('Reddit OAuth error:', error)
      return NextResponse.redirect(`${baseUrl}/?error=oauth_failed`)
    }

    if (!code) {
      console.error('No authorization code received')
      return NextResponse.redirect(`${baseUrl}/?error=no_code`)
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(
          `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': process.env.REDDIT_USER_AGENT || 'DevDigest/1.0.0'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.REDDIT_REDIRECT_URI_PRODUCTION || `${baseUrl}/api/auth/callback`
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(`${baseUrl}/?error=token_exchange_failed`)
    }

    const tokenData = await tokenResponse.json()
    
    // Store tokens in database
    try {
      await connectDB()
      
      // Create or update a Reddit source with the access token
      const redditSource = await Source.findOneAndUpdate(
        { type: 'reddit' },
        {
          name: 'Reddit (OAuth)',
          type: 'reddit',
          url: 'https://oauth.reddit.com',
          isActive: true,
          lastFetched: new Date(),
          oauth: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
            tokenType: tokenData.token_type
          }
        },
        { upsert: true, new: true }
      )
      
      console.log('✅ Reddit OAuth successful, access token stored in database')
      console.log(`📝 Source ID: ${redditSource._id}`)
      
      // Redirect to success page
      return NextResponse.redirect(`${baseUrl}/?success=reddit_connected&sourceId=${redditSource._id}`)
      
    } catch (dbError) {
      console.error('❌ Failed to store token in database:', dbError.message)
      return NextResponse.redirect(`${baseUrl}/?error=token_storage_failed`)
    }

  } catch (error) {
    console.error('Reddit OAuth callback error:', error)
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://dev-digest-ag.vercel.app'
    return NextResponse.redirect(`${baseUrl}/?error=callback_failed`)
  }
} 