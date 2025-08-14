import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/database'
import Content from '@/models/Content'

// GET /api/content - Fetch paginated content
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page')) || 1
    const limit = parseInt(searchParams.get('limit')) || 20
    const category = searchParams.get('category')
    const sentiment = searchParams.get('sentiment')
    const difficulty = searchParams.get('difficulty')
    const source = searchParams.get('source')
    const search = searchParams.get('search')
    const _t = searchParams.get('_t') // Cache busting parameter

    // Build filter object
    const filter = {}
    if (category && category !== 'all') filter.category = category
    if (sentiment && sentiment !== 'all') filter.sentiment = sentiment
    if (difficulty && difficulty !== 'all') filter.difficulty = difficulty
    if (source && source !== 'all') filter.source = { $regex: source, $options: 'i' }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { technologies: { $in: [new RegExp(search, 'i')] } }
      ]
    }

    // Connect to database
    await connectDB()

    // Get total count for pagination
    const total = await Content.countDocuments(filter)
    
    // Fetch content with pagination - always sort by download time first
    const content = await Content.find(filter)
      .sort({ createdAt: -1, publishedAt: -1 }) // Sort by download time first, then publication date
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    console.log(`📄 API: Fetched ${content.length} posts (page ${page}, limit ${limit})`)
    if (content.length > 0) {
      console.log(`📰 First post: "${content[0].title}" from ${content[0].source} (created: ${content[0].createdAt})`)
    }

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    return NextResponse.json({
      content,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    })
  } catch (error) {
    console.error('Error fetching content:', error)
    return NextResponse.json(
      { error: 'Failed to fetch content', details: String(error?.message || error), stack: error?.stack },
      { status: 500 }
    )
  }
}

// POST /api/content - Create new content
export async function POST(request) {
  try {
    const body = await request.json()
    
    // Connect to database
    await connectDB()
    
    // Create new content
    const newContent = new Content(body)
    await newContent.save()
    
    return NextResponse.json(newContent, { status: 201 })
  } catch (error) {
    console.error('Error creating content:', error)
    return NextResponse.json(
      { error: 'Failed to create content' },
      { status: 500 }
    )
  }
}

// PUT /api/content - Update content
export async function PUT(request) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body
    
    if (!id) {
      return NextResponse.json(
        { error: 'Content ID is required' },
        { status: 400 }
      )
    }
    
    // Connect to database
    await connectDB()
    
    // Update content
    const updatedContent = await Content.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
    
    if (!updatedContent) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(updatedContent)
  } catch (error) {
    console.error('Error updating content:', error)
    return NextResponse.json(
      { error: 'Failed to update content' },
      { status: 500 }
    )
  }
}

// DELETE /api/content - Delete content
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Content ID is required' },
        { status: 400 }
      )
    }
    
    // Connect to database
    await connectDB()
    
    // Delete content
    const deletedContent = await Content.findByIdAndDelete(id)
    
    if (!deletedContent) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ message: 'Content deleted successfully' })
  } catch (error) {
    console.error('Error deleting content:', error)
    return NextResponse.json(
      { error: 'Failed to delete content' },
      { status: 500 }
    )
  }
} 