import mongoose from 'mongoose'

const sourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['reddit', 'rss', 'api', 'manual'],
    default: 'rss'
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastFetched: {
    type: Date,
    default: Date.now
  },
  fetchInterval: {
    type: Number,
    default: 15, // minutes
    min: 5,
    max: 1440
  },
  maxItemsPerFetch: {
    type: Number,
    default: 50,
    min: 1,
    max: 200
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  tags: [{
    type: String,
    trim: true
  }],
  config: {
    // Reddit-specific config
    subreddit: String,
    sortBy: {
      type: String,
      enum: ['hot', 'new', 'top', 'rising'],
      default: 'hot'
    },
    timeFilter: {
      type: String,
      enum: ['hour', 'day', 'week', 'month', 'year', 'all'],
      default: 'day'
    },
    
    // RSS-specific config
    rssParser: {
      type: String,
      default: 'default'
    },
    
    // API-specific config
    apiKey: String,
    headers: mongoose.Schema.Types.Mixed,
    rateLimit: {
      requests: Number,
      window: Number
    }
  },
  oauth: {
    accessToken: String,
    refreshToken: String,
    expiresAt: Date,
    tokenType: {
      type: String,
      default: 'bearer'
    }
  },
  stats: {
    totalFetched: {
      type: Number,
      default: 0
    },
    lastFetchCount: {
      type: Number,
      default: 0
    },
    lastFetchSuccess: {
      type: Boolean,
      default: true
    },
    lastFetchError: String,
    averageFetchTime: Number,
    successRate: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    }
  },
  filters: {
    includeKeywords: [String],
    excludeKeywords: [String],
    minWordCount: Number,
    maxWordCount: Number,
    allowedCategories: [String],
    blockedCategories: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for better query performance
sourceSchema.index({ type: 1, isActive: 1 })
sourceSchema.index({ category: 1 })
sourceSchema.index({ priority: -1 })
sourceSchema.index({ lastFetched: 1 })

// Virtual for next fetch time
sourceSchema.virtual('nextFetchTime').get(function() {
  if (!this.lastFetched) return new Date()
  return new Date(this.lastFetched.getTime() + this.fetchInterval * 60000)
})

// Virtual for fetch status
sourceSchema.virtual('fetchStatus').get(function() {
  if (!this.isActive) return 'inactive'
  if (this.nextFetchTime <= new Date()) return 'due'
  return 'scheduled'
})

// Pre-save middleware to update lastFetched
sourceSchema.pre('save', function(next) {
  if (this.isModified('lastFetched')) {
    this.stats.lastFetchCount = 0
    this.stats.lastFetchError = null
  }
  next()
})

// Static method to find active sources by type
sourceSchema.statics.findActiveByType = function(type) {
  return this.find({ type, isActive: true }).sort({ priority: -1, lastFetched: 1 })
}

// Static method to find sources due for fetching
sourceSchema.statics.findDueForFetch = function() {
  const now = new Date()
  return this.find({
    isActive: true,
    $or: [
      { lastFetched: { $exists: false } },
      { lastFetched: { $lte: new Date(now.getTime() - this.fetchInterval * 60000) } }
    ]
  }).sort({ priority: -1, lastFetched: 1 })
}

// Static method to update fetch statistics
sourceSchema.statics.updateFetchStats = function(sourceId, success, count, error, fetchTime) {
  return this.findByIdAndUpdate(sourceId, {
    $inc: {
      'stats.totalFetched': count,
      'stats.lastFetchCount': count
    },
    $set: {
      lastFetched: new Date(),
      'stats.lastFetchSuccess': success,
      'stats.lastFetchError': error || null,
      'stats.averageFetchTime': fetchTime || 0
    }
  })
}

// Instance method to check if content should be included
sourceSchema.methods.shouldIncludeContent = function(content) {
  // Check word count filters
  if (this.filters.minWordCount && content.wordCount < this.filters.minWordCount) {
    return false
  }
  if (this.filters.maxWordCount && content.wordCount > this.filters.maxWordCount) {
    return false
  }

  // Check category filters
  if (this.filters.allowedCategories.length > 0) {
    if (!this.filters.allowedCategories.includes(content.category)) {
      return false
    }
  }
  if (this.filters.blockedCategories.includes(content.category)) {
    return false
  }

  // Check keyword filters
  const contentText = `${content.title} ${content.summary}`.toLowerCase()
  
  if (this.filters.excludeKeywords.length > 0) {
    for (const keyword of this.filters.excludeKeywords) {
      if (contentText.includes(keyword.toLowerCase())) {
        return false
      }
    }
  }

  if (this.filters.includeKeywords.length > 0) {
    let hasIncludedKeyword = false
    for (const keyword of this.filters.includeKeywords) {
      if (contentText.includes(keyword.toLowerCase())) {
        hasIncludedKeyword = true
        break
      }
    }
    if (!hasIncludedKeyword) return false
  }

  return true
}

const Source = mongoose.models.Source || mongoose.model('Source', sourceSchema)

export default Source 