'use client'

import { useState } from 'react'

export default function AddSourceForm({ isOpen, onClose, onSourceAdded }) {
  const [formData, setFormData] = useState({
    url: '',
    name: '',
    type: 'reddit',
    category: 'Technology',
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const detectSourceType = (url) => {
    if (url.includes('reddit.com/r/')) {
      return 'reddit'
    } else if (url.includes('medium.com/')) {
      return 'medium'
    } else if (url.includes('rss') || url.includes('feed')) {
      return 'rss'
    }
    return 'api'
  }

  const extractSourceName = (url, type) => {
    if (type === 'reddit' && url.includes('reddit.com/r/')) {
      const match = url.match(/reddit\.com\/r\/([^\/\?]+)/)
      return match ? `r/${match[1]}` : 'Reddit Subreddit'
    } else if (type === 'medium' && url.includes('medium.com/')) {
      const match = url.match(/medium\.com\/([^\/\?]+)/)
      return match ? `Medium: ${match[1]}` : 'Medium Publication'
    }
    return 'New Source'
  }

  const handleUrlChange = (e) => {
    const url = e.target.value
    setFormData(prev => ({
      ...prev,
      url,
      type: detectSourceType(url),
      name: extractSourceName(url, detectSourceType(url))
    }))
  }

  const validateForm = () => {
    if (!formData.url.trim()) {
      setError('Please enter a URL')
      return false
    }

    try {
      new URL(formData.url)
    } catch {
      setError('Please enter a valid URL')
      return false
    }

    if (!formData.name.trim()) {
      setError('Please enter a source name')
      return false
    }

    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Prepare source data based on type
      let sourceData = {
        name: formData.name,
        type: formData.type,
        url: formData.url,
        category: formData.category,
        description: formData.description,
        isActive: true,
        priority: 1,
        fetchInterval: 15,
        maxItemsPerFetch: 50
      }

      // Add type-specific configuration
      if (formData.type === 'reddit') {
        const subredditMatch = formData.url.match(/reddit\.com\/r\/([^\/\?]+)/)
        if (subredditMatch) {
          sourceData.config = {
            subreddit: subredditMatch[1],
            sortBy: 'hot',
            timeFilter: 'day'
          }
        }
      }

      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sourceData)
      })

      const result = await response.json()

      if (response.ok) {
        setSuccess('Source added successfully! It will be included in the next content refresh.')
        setFormData({
          url: '',
          name: '',
          type: 'reddit',
          category: 'Technology',
          description: ''
        })
        
        // Notify parent component
        if (onSourceAdded) {
          onSourceAdded(result)
        }
        
        // Auto-close after success
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        setError(result.error || 'Failed to add source')
      }
    } catch (error) {
      console.error('Error adding source:', error)
      setError('Failed to add source. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-[#0a0a0a] rounded-xl shadow-2xl max-w-md w-full max-h-[98vh] sm:max-h-[90vh] border border-gray-200 dark:border-[#1a1a1a] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-[#1a1a1a] flex-shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Add New Source</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">Add a new content source to your feed</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3 sm:space-y-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source URL *
            </label>
            <input
              type="url"
              name="url"
              value={formData.url}
              onChange={handleUrlChange}
              placeholder="https://www.reddit.com/r/programming or https://medium.com/tech-publication"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-[#1a1a1a] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Supports Reddit subreddits, Medium publications, RSS feeds, and APIs
            </p>
          </div>

          {/* Source Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source Type
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-[#1a1a1a] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white text-sm sm:text-base"
            >
              <option value="reddit">Reddit Subreddit</option>
              <option value="medium">Medium Publication</option>
              <option value="rss">RSS Feed</option>
              <option value="api">API Endpoint</option>
            </select>
          </div>

          {/* Source Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Source Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter a descriptive name for this source"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-[#1a1a1a] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-[#1a1a1a] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white text-sm sm:text-base"
            >
              <option value="Technology">Technology</option>
              <option value="Programming">Programming</option>
              <option value="Startups">Startups</option>
              <option value="AI/ML">AI/ML</option>
              <option value="Web Development">Web Development</option>
              <option value="Mobile Development">Mobile Development</option>
              <option value="Data Science">Data Science</option>
              <option value="DevOps">DevOps</option>
              <option value="General">General</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of what this source provides"
              rows="3"
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-[#1a1a1a] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex space-x-3 pt-4 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-[#1a1a1a] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors text-sm sm:text-base font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm sm:text-base"
            >
              {loading ? 'Adding...' : 'Add Source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 