import mongoose from 'mongoose'
import crypto from 'crypto'

const contentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  url: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  source: {
    type: String,
    required: true,
    trim: true
  },
  publishedAt: {
    type: Date,
    required: true
  },
  summary: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  content: {
    type: String,
    trim: true,
    maxlength: 50000 // Allow up to 50k characters for full content
  },
  sentiment: {
    type: String,
    enum: ['positive', 'negative', 'neutral'],
    default: 'neutral'
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  difficulty: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Intermediate'
  },
  readingTime: {
    type: Number,
    min: 1,
    max: 120,
    default: 5
  },
  technologies: [{
    type: String,
    trim: true
  }],
  keyInsights: [{
    type: String,
    trim: true
  }],
  quality: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  contentHash: {
    type: String,
    unique: true,
    sparse: true
  },
  isProcessed: {
    type: Boolean,
    default: false
  },
  processingError: {
    type: String,
    trim: true
  },
  metadata: {
    author: String,
    tags: [String],
    language: {
      type: String,
      default: 'en'
    },
    wordCount: Number,
    imageCount: Number
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for better query performance
contentSchema.index({ publishedAt: -1 })
contentSchema.index({ createdAt: -1 }) // Index for download time sorting
contentSchema.index({ createdAt: -1, publishedAt: -1 }) // Compound index for refresh feed sorting
contentSchema.index({ category: 1 })
contentSchema.index({ sentiment: 1 })
contentSchema.index({ difficulty: 1 })
contentSchema.index({ source: 1 })
contentSchema.index({ technologies: 1 })
contentSchema.index({ 'metadata.tags': 1 })

// Text search index
contentSchema.index({
  title: 'text',
  summary: 'text',
  'metadata.tags': 'text'
})

// Virtual for formatted date
contentSchema.virtual('formattedDate').get(function() {
  return this.publishedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

// Virtual for relative time
contentSchema.virtual('relativeTime').get(function() {
  const now = new Date()
  const diffTime = Math.abs(now - this.publishedAt)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 1) return 'Today'
  if (diffDays === 2) return 'Yesterday'
  if (diffDays < 7) return `${diffDays - 1} days ago`
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`
  return this.publishedAt.toLocaleDateString()
})

// Pre-save middleware to generate content hash
contentSchema.pre('save', function(next) {
  if (this.isModified('title') || this.isModified('url')) {
    this.contentHash = crypto.createHash('md5').update(this.title + this.url).digest('hex')
  }
  next()
})

// Static method to find by content hash
contentSchema.statics.findByHash = function(hash) {
  return this.findOne({ contentHash: hash })
}

// Static method to find trending technologies
contentSchema.statics.findTrendingTechnologies = function(limit = 10) {
  return this.aggregate([
    { $unwind: '$technologies' },
    { $group: { _id: '$technologies', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ])
}

// Static method to find content by sentiment distribution
contentSchema.statics.findBySentimentDistribution = function() {
  return this.aggregate([
    { $group: { _id: '$sentiment', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ])
}

// Static method to find content by category distribution
contentSchema.statics.findByCategoryDistribution = function() {
  return this.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ])
}

const Content = mongoose.models.Content || mongoose.model('Content', contentSchema)

export default Content 