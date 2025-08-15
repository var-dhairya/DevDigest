import { NextResponse } from 'next/server'

// Force dynamic rendering to prevent static optimization issues
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('Reddit OAuth error:', error)
      return NextResponse.redirect(new URL('/?error=oauth_failed', request.url))
    }

    if (!code) {
      console.error('No authorization code received')
      return NextResponse.redirect(new URL('/?error=no_code', request.url))
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
        redirect_uri: process.env.NODE_ENV === 'production' 
          ? process.env.REDDIT_REDIRECT_URI_PRODUCTION
          : process.env.REDDIT_REDIRECT_URI_DEVELOPMENT
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url))
    }

    const tokenData = await tokenResponse.json()
    
    console.log('Reddit OAuth successful, access token received')
    
    // Redirect to success page or back to main app
    return NextResponse.redirect(new URL('/?success=reddit_connected', request.url))

  } catch (error) {
    console.error('Reddit OAuth callback error:', error)
    return NextResponse.redirect(new URL('/?error=callback_failed', request.url))
  }
} 