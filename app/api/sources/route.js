import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/database'
import Source from '@/models/Source'

// GET /api/sources - Get all content sources
export async function GET(request) {
  try {
    await connectDB()
    
    const sources = await Source.find({ isActive: true }).sort({ name: 1 })
    
    return NextResponse.json({ sources })
  } catch (error) {
    console.error('Error fetching sources:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sources' },
      { status: 500 }
    )
  }
}

// POST /api/sources - Add new content source
export async function POST(request) {
  try {
    const body = await request.json()
    
    await connectDB()
    
    const newSource = new Source(body)
    await newSource.save()
    
    return NextResponse.json(newSource, { status: 201 })
  } catch (error) {
    console.error('Error creating source:', error)
    return NextResponse.json(
      { error: 'Failed to create source' },
      { status: 500 }
    )
  }
}

// PUT /api/sources - Update source
export async function PUT(request) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body
    
    if (!id) {
      return NextResponse.json(
        { error: 'Source ID is required' },
        { status: 400 }
      )
    }
    
    await connectDB()
    
    const updatedSource = await Source.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
    
    if (!updatedSource) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(updatedSource)
  } catch (error) {
    console.error('Error updating source:', error)
    return NextResponse.json(
      { error: 'Failed to update source' },
      { status: 500 }
    )
  }
}

// DELETE /api/sources - Delete source
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Source ID is required' },
        { status: 400 }
      )
    }
    
    await connectDB()
    
    const deletedSource = await Source.findByIdAndDelete(id)
    
    if (!deletedSource) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ message: 'Source deleted successfully' })
  } catch (error) {
    console.error('Error deleting source:', error)
    return NextResponse.json(
      { error: 'Failed to delete source' },
      { status: 500 }
    )
  }
} 