'use client'

import { useState, useEffect } from 'react'
import SimpleRefreshButton from './components/SimpleRefreshButton'
import DarkModeToggle from './components/DarkModeToggle'
import Sidebar from './components/Sidebar'
import PostChat from './components/PostChat'
import AddSourceForm from './components/AddSourceForm'

export default function Home() {
  const [content, setContent] = useState([])
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [postsPerPage] = useState(25) // Increased from 20 to 25 posts per page
  const [analysisPopup, setAnalysisPopup] = useState({ show: false, data: null, content: null })
  const [postChatOpen, setPostChatOpen] = useState(false)
  const [currentPost, setCurrentPost] = useState(null)
  const [postChatLoading, setPostChatLoading] = useState(false)
  const [chatPosition, setChatPosition] = useState(null)
  const [addSourceFormOpen, setAddSourceFormOpen] = useState(false)

  // Force stats update when content or sources change
  const forceStatsUpdate = () => {
    // This will trigger a re-render and recalculate stats
    setContent(prev => [...prev])
  }

  const fetchData = async (page = 1, refresh = false) => {
    try {
      setLoading(true)
      
      // If refreshing, reset to page 1
      if (refresh) {
        setCurrentPage(1)
        page = 1
        console.log('🔄 Refresh mode: fetching fresh content from page 1')
      }
      
      // Add timestamp to prevent caching
      const timestamp = Date.now()
      const response = await fetch(`/api/content?page=${page}&limit=${postsPerPage}&_t=${timestamp}`)
      const data = await response.json()
      
      if (refresh) {
        // For refresh, completely replace content
        setContent(data.content)
        console.log(`🔄 Refreshed feed with ${data.content.length} posts (sorted by download time)`)
        
        // Show which posts are newest
        if (data.content.length > 0) {
          const newestPost = data.content[0]
          console.log(`📰 Newest post: "${newestPost.title}" from ${newestPost.source}`)
        }
        
        // Force stats update for refresh
        setTimeout(() => forceStatsUpdate(), 100)
      } else {
        // For pagination, append to existing content
        setContent(prev => [...prev, ...data.content])
        console.log(`📄 Loaded ${data.content.length} more posts (page ${page})`)
      }
      
      setHasMore(data.pagination.hasNextPage)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching content:', error)
      setLoading(false)
    }
  }

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/sources')
      const data = await response.json()
      setSources(data.sources)
      
      // Force stats update after sources change
      setTimeout(() => forceStatsUpdate(), 100)
    } catch (error) {
      console.error('Error fetching sources:', error)
    }
  }

  useEffect(() => {
    fetchData()
    fetchSources()
    
    // Listen for add source form events
    const handleOpenAddSourceForm = () => setAddSourceFormOpen(true)
    const handleTriggerContentRefresh = () => refreshContent()
    
    window.addEventListener('openAddSourceForm', handleOpenAddSourceForm)
    window.addEventListener('triggerContentRefresh', handleTriggerContentRefresh)
    
    return () => {
      window.removeEventListener('openAddSourceForm', handleOpenAddSourceForm)
      window.removeEventListener('triggerContentRefresh', handleTriggerContentRefresh)
    }
  }, [])

  // Handle escape key to close popup
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && analysisPopup.show) {
        setAnalysisPopup({ show: false, data: null, content: null })
      }
    }

    if (analysisPopup.show) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [analysisPopup.show])

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      fetchData(nextPage)
    }
  }

  const refreshContent = async () => {
    console.log('🔄 Starting frontend refresh...')
    setRefreshing(true)
    
    // Immediately clear current content to show loading state
    setContent([])
    setCurrentPage(1)
    setHasMore(true)
    
    try {
      // Force a fresh fetch from the database
      const response = await fetch(`/api/content?page=1&limit=${postsPerPage}&_t=${Date.now()}`)
      const data = await response.json()
      
      if (data.content && data.content.length > 0) {
        setContent(data.content)
        console.log(`🔄 Refreshed feed with ${data.content.length} posts (sorted by download time)`)
        
        // Show which posts are newest
        const newestPost = data.content[0]
        console.log(`📰 Newest post: "${newestPost.title}" from ${newestPost.source} (created: ${newestPost.createdAt})`)
        
        // Force stats update
        setTimeout(() => forceStatsUpdate(), 100)
      } else {
        console.log('⚠️ No content found after refresh')
      }
      
      setHasMore(data.pagination.hasNextPage)
    } catch (error) {
      console.error('❌ Frontend refresh error:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const analyzeContent = async (id) => {
    setAnalyzing(prev => ({ ...prev, [id]: true }))
    
    try {
      console.log(`🔍 Starting comprehensive analysis for content ID: ${id}`)
      
      // Add artificial delay to show that something is happening
      const startTime = Date.now()
      
      const response = await fetch(`/api/content/${id}/analyze`, {
        method: 'POST'
      })
      const result = await response.json()
      
      // Ensure minimum 2 seconds loading time so user sees the process
      const elapsedTime = Date.now() - startTime
      if (elapsedTime < 2000) {
        await new Promise(resolve => setTimeout(resolve, 2000 - elapsedTime))
      }
      
      console.log('📊 Enhanced Analysis API response:', result)
      console.log('📊 Metadata:', result.metadata)
      
      if (result.success || result.analysis) {
        console.log('✅ Comprehensive analysis successful')
        console.log(`💬 Comments analyzed: ${result.metadata?.commentsCount || 0}`)
        console.log(`📄 Full content length: ${result.metadata?.fullContentLength || 0}`)
        
        // Find the content item to get additional context
        const contentItem = content.find(item => item._id === id)
        
        // Create enhanced analysis data with metadata
        const enhancedAnalysis = {
          ...result.analysis,
          // Add analysis metadata
          analysisMetadata: {
            commentsAnalyzed: result.metadata?.commentsCount || 0,
            fullContentLength: result.metadata?.fullContentLength || 0,
            hasComments: result.metadata?.hasComments || false,
            hasFullContent: result.metadata?.hasFullContent || false,
            analysisType: result.success ? 'AI-powered' : 'Enhanced fallback'
          },
          // Add trending indicators
          trending: contentItem?.metadata?.comments > 50
        }
        
        // Show the popup with analysis results
        setAnalysisPopup({
          show: true,
          data: enhancedAnalysis,
          content: contentItem
        })
        
      } else {
        console.log('❌ Analysis failed:', result.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Error analyzing content:', error)
    } finally {
      setAnalyzing(prev => ({ ...prev, [id]: false }))
    }
  }

  const handlePostChat = (post, event) => {
    // Calculate position relative to the clicked post card
    const rect = event.currentTarget.closest('.post-card').getBoundingClientRect()
    const chatWidth = 320 // w-80 = 320px
    const gap = 40 // Increased gap to prevent overlap
    
    // Always try to position to the right first
    let left = rect.right + gap
    
    // If it would go off-screen to the right, position to the left
    if (left + chatWidth > window.innerWidth - 40) {
      left = rect.left - chatWidth - gap
    }
    
    // If it would go off-screen to the left, position it at a safe distance
    if (left < 40) {
      left = 40
    }
    
    const position = {
      left: left,
      top: rect.top
    }
    
    setCurrentPost(post)
    setChatPosition(position)
    setPostChatOpen(true)
  }

  const handleSourceAdded = async (newSource) => {
    console.log('🆕 New source added:', newSource)
    
    // Refresh sources list
    await fetchSources()
    
    // Show success message
    console.log('✅ Source added successfully. It will be included in the next content refresh.')
  }

  const handlePostSearch = async (query, postContent, setMessages) => {
    setPostChatLoading(true)
    
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          postContent
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        const assistantMessage = { role: 'assistant', content: data.response }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        const errorMessage = { role: 'assistant', content: 'Sorry, I encountered an error while processing your query. Please try again.' }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Post search error:', error)
      const errorMessage = { role: 'assistant', content: 'Sorry, I encountered an error while processing your query. Please try again.' }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setPostChatLoading(false)
    }
  }

  // Helper function to generate content summary
  const generateContentSummary = (contentItem, analysis) => {
    const summary = []
    
    // Add source context and engagement
    if (contentItem?.source?.includes('reddit')) {
      summary.push(`Reddit post with ${contentItem.metadata?.comments || 0} comments`)
    } else if (contentItem?.source?.includes('hackernews')) {
      summary.push(`Hacker News discussion with ${contentItem.metadata?.comments || 0} comments`)
    } else {
      summary.push(`Content from ${contentItem?.source || 'tech platform'}`)
    }
    
    // Add content type and topic
    if (contentItem?.title?.toLowerCase().includes('how to') || contentItem?.title?.toLowerCase().includes('tutorial')) {
      summary.push('Tutorial/How-to content')
    } else if (contentItem?.title?.toLowerCase().includes('news') || contentItem?.title?.toLowerCase().includes('update')) {
      summary.push('News/Update content')
    } else if (contentItem?.title?.toLowerCase().includes('discussion') || contentItem?.title?.toLowerCase().includes('question')) {
      summary.push('Discussion/Question content')
    }
    
    // Add what people are talking about
    if (contentItem?.summary) {
      const keyTopics = extractKeyTopics(contentItem.title + ' ' + contentItem.summary)
      if (keyTopics.length > 0) {
        summary.push(`People are discussing: ${keyTopics.join(', ')}`)
      }
    }
    
    return summary.join('. ')
  }

  // Helper function to extract key topics from content
  const extractKeyTopics = (text) => {
    const topics = []
    const lowerText = text.toLowerCase()
    
    // Check for specific tech topics
    if (lowerText.includes('ai') || lowerText.includes('artificial intelligence') || lowerText.includes('machine learning')) {
      topics.push('AI/ML')
    }
    if (lowerText.includes('startup') || lowerText.includes('business') || lowerText.includes('entrepreneur')) {
      topics.push('Startups/Business')
    }
    if (lowerText.includes('programming') || lowerText.includes('coding') || lowerText.includes('development')) {
      topics.push('Programming/Development')
    }
    if (lowerText.includes('job') || lowerText.includes('career') || lowerText.includes('employment')) {
      topics.push('Jobs/Careers')
    }
    if (lowerText.includes('web') || lowerText.includes('frontend') || lowerText.includes('backend')) {
      topics.push('Web Development')
    }
    if (lowerText.includes('mobile') || lowerText.includes('app') || lowerText.includes('ios') || lowerText.includes('android')) {
      topics.push('Mobile Development')
    }
    if (lowerText.includes('data') || lowerText.includes('database') || lowerText.includes('analytics')) {
      topics.push('Data/Analytics')
    }
    if (lowerText.includes('cloud') || lowerText.includes('aws') || lowerText.includes('azure')) {
      topics.push('Cloud Computing')
    }
    if (lowerText.includes('security') || lowerText.includes('cybersecurity') || lowerText.includes('privacy')) {
      topics.push('Security/Privacy')
    }
    if (lowerText.includes('design') || lowerText.includes('ui') || lowerText.includes('ux')) {
      topics.push('Design/UX')
    }
    
    // If no specific topics found, add general tech
    if (topics.length === 0) {
      topics.push('Technology')
    }
    
    return topics
  }

  // Calculate stats whenever content or sources change
  const stats = {
    totalArticles: content.length,
    activeSources: sources.filter(s => s.isActive).length,
    totalSources: sources.length
  }

  // Deduplicate content to prevent duplicate keys
  const uniqueContent = content.filter((item, index, self) => 
    index === self.findIndex(t => t._id === item._id && t.url === item.url)
  )

  // Log stats changes for debugging
  useEffect(() => {
    console.log('📊 Stats updated:', stats)
    if (content.length !== uniqueContent.length) {
      console.log(`⚠️ Removed ${content.length - uniqueContent.length} duplicate content items`)
    }
  }, [stats, content.length, uniqueContent.length])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Sidebar */}
      <Sidebar stats={stats} />

      {/* Header */}
      <header className="bg-white dark:bg-[#0a0a0a] shadow-sm border-b border-gray-200 dark:border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">DevDigest</h1>
              <p className="text-base text-gray-600 dark:text-gray-300 mt-1 font-medium">Your curated tech news feed</p>
            </div>
            
            {/* Header Buttons */}
            <div className="flex items-center space-x-4">
              <DarkModeToggle />
              <SimpleRefreshButton onRefresh={refreshContent} />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content Feed */}
          <div className="lg:col-span-3">
            {/* Content Feed */}
            <div className="space-y-4">
              {refreshing && (
                <div className="text-center py-12 bg-white dark:bg-[#0a0a0a] rounded-xl border border-gray-200 dark:border-[#1a1a1a] shadow-sm">
                  <div className="animate-spin text-5xl mb-4">🔄</div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Refreshing Your Feed</h3>
                  <p className="text-gray-600 dark:text-gray-300">Fetching latest posts from all sources...</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">New posts will appear at the top</p>
                </div>
              )}
              
              {!refreshing && uniqueContent.length === 0 && !loading && (
                <div className="text-center py-12 bg-white dark:bg-[#0a0a0a] rounded-xl border border-gray-200 dark:border-[#1a1a1a] shadow-sm">
                  <div className="text-4xl mb-4">📰</div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">No Posts Found</h3>
                  <p className="text-gray-600 dark:text-gray-300">Try refreshing the feed to get the latest content</p>
                </div>
              )}
              
              {!refreshing && uniqueContent.map((item, index) => (
                <div key={`${item._id}-${item.url}-${index}`} className="post-card bg-white dark:bg-[#0a0a0a] rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-200 dark:border-[#1a1a1a] hover:border-gray-300 dark:hover:border-gray-700 overflow-hidden">
                  {/* Header Section with Source Badge and Metadata */}
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-[#1a1a1a]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/30 shadow-sm">
                          {item.source}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium bg-gray-50 dark:bg-[#1a1a1a] px-2 py-1 rounded-md">
                          {new Date(item.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        {item.metadata?.readingTime && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center bg-gray-50 dark:bg-[#1a1a1a] px-2 py-1 rounded-md">
                            <span className="mr-1.5">📖</span> {item.metadata.readingTime} min
                          </span>
                        )}
                        {item.metadata?.comments && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center bg-gray-50 dark:bg-[#1a1a1a] px-2 py-1 rounded-md">
                            <span className="mr-1.5">💬</span> {item.metadata.comments}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="px-6 py-5">
                    {/* Title and Link */}
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 block"
                      >
                        {item.title}
                      </a>
                    </h2>

                    {/* Summary */}
                    {item.summary && (
                      <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed text-sm line-clamp-3">
                        {item.summary}
                      </p>
                    )}

                    {/* Images */}
                    {item.metadata?.images && item.metadata.images.length > 0 && (
                      <div className="mb-5">
                        <div className="grid grid-cols-3 gap-3">
                          {item.metadata.images.slice(0, 3).map((image, index) => (
                            <div key={index} className="aspect-video overflow-hidden rounded-lg border border-gray-200 dark:border-[#1a1a1a] hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 hover:scale-105">
                              <img
                                src={image.url}
                                alt={`Post image ${index + 1}`}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags and Technologies */}
                    <div className="flex flex-wrap gap-2 mb-5">
                      {item.metadata?.tags && item.metadata.tags.map((tag, index) => (
                        <span key={index} className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-700/30 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all duration-200 font-medium shadow-sm">
                          {tag}
                        </span>
                      ))}
                      {item.technologies && item.technologies.map((tech, index) => (
                        <span key={index} className="px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-700/30 hover:bg-green-100 dark:hover:bg-green-900/30 transition-all duration-200 font-medium shadow-sm">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons Section */}
                  <div className="px-6 py-4 bg-gray-200 dark:bg-[#0f0f0f] border-t border-gray-300 dark:border-[#1a1a1a]">
                    <div className="flex justify-center space-x-12">
                      <button
                        onClick={() => analyzeContent(item._id)}
                        disabled={analyzing[item._id]}
                        className="px-6 py-2.5 bg-blue-600 dark:bg-[#1a1a1a] text-gray-50 text-sm font-semibold rounded-lg hover:bg-blue-600 dark:hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md shadow-sm border border-blue-500 dark:border-[#1a1a1a] hover:border-blue-600 dark:hover:border-gray-600 flex items-center space-x-2"
                      >
                        <span>{analyzing[item._id] ? '🤖' : '🔍'}</span>
                        <span>{analyzing[item._id] ? 'Analyzing...' : 'Analyze'}</span>
                      </button>
                      <button
                        onClick={(e) => handlePostChat(item, e)}
                        className="px-6 py-2.5 bg-green-600 dark:bg-[#1a1a1a] text-gray-50 text-sm font-semibold rounded-lg hover:bg-green-600 dark:hover:bg-black transition-all duration-200 hover:shadow-md shadow-sm border border-green-500 dark:border-[#1a1a1a] hover:border-green-600 dark:hover:border-gray-600 flex items-center space-x-2"
                      >
                        <span>💬</span>
                        <span>AI Chat</span>
                      </button>
                    </div>
                    {analyzing[item._id] && (
                      <div className="mt-3 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Processing your content...</p>
                        <div className="mt-2 w-16 h-1 bg-blue-200 dark:bg-blue-800 rounded-full mx-auto overflow-hidden">
                          <div className="h-full bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="text-center mt-10">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-10 py-4 bg-gray-600 dark:bg-[#1a1a1a] text-white rounded-xl hover:bg-gray-700 dark:hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg font-semibold text-lg border border-gray-200 dark:border-[#1a1a1a] hover:border-gray-300 dark:hover:border-gray-700"
                >
                  {loading ? 'Loading...' : 'Load More Posts'}
                </button>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="animate-spin text-5xl mb-6">🔄</div>
                <p className="text-lg text-gray-600 dark:text-gray-300 font-medium">Loading your tech feed...</p>
              </div>
            )}
          </div>

          {/* Sidebar - Empty for now */}
          <div className="lg:col-span-1">
            {/* Content can be added here later if needed */}
          </div>
        </div>
      </div>

      {/* Analysis Results Popup */}
      {analysisPopup.show && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setAnalysisPopup({ show: false, data: null, content: null })}
        >
          <div 
            className="bg-white dark:bg-[#0a0a0a] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-[#1a1a1a]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-[#1a1a1a]">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🤖 Content Analysis</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-1">Post summary and community discussion insights</p>
              </div>
              <button
                onClick={() => setAnalysisPopup({ show: false, data: null, content: null })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Content Info */}
            <div className="p-6 border-b border-gray-200 dark:border-[#1a1a1a]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {analysisPopup.content?.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
                {analysisPopup.content?.summary?.substring(0, 150)}...
              </p>
              <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                <span>📅 {new Date(analysisPopup.content?.publishedAt).toLocaleDateString()}</span>
                <span>📊 {analysisPopup.content?.source}</span>
                {analysisPopup.data?.trending && (
                  <span className="text-orange-600 dark:text-orange-400 font-medium">🔥 Trending</span>
                )}
              </div>
              
              {/* Analysis Metadata */}
              {analysisPopup.data?.analysisMetadata && (
                <div className="flex items-center space-x-4 text-xs text-blue-600 dark:text-white bg-blue-50 dark:bg-[#1a1a1a] px-3 py-2 rounded-md border border-blue-200 dark:border-[#1a1a1a]">
                  <span>🤖 {analysisPopup.data.analysisMetadata.analysisType}</span>
                  {analysisPopup.data.analysisMetadata.commentsAnalyzed > 0 && (
                    <span>💬 {analysisPopup.data.analysisMetadata.commentsAnalyzed} comments analyzed</span>
                  )}
                  {analysisPopup.data.analysisMetadata.fullContentLength > 0 && (
                    <span>📄 {Math.round(analysisPopup.data.analysisMetadata.fullContentLength / 1000)}k chars analyzed</span>
                  )}
                </div>
              )}
            </div>

            {/* Post Summary */}
            {analysisPopup.data?.postSummary && (
              <div className="p-6 border-b border-gray-200 dark:border-[#1a1a1a]">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">💬 Post Summary</h4>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {analysisPopup.data.postSummary}
                </p>
              </div>
            )}

            {/* Community Gist */}
            {analysisPopup.data?.communityGist && (
              <div className="p-6 border-b border-gray-200 dark:border-[#1a1a1a]">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">💬 What People Are Talking About</h4>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {analysisPopup.data.communityGist}
                </p>
              </div>
            )}

            {/* Key Topics */}
            {analysisPopup.data?.keyTopics && analysisPopup.data.keyTopics.length > 0 && (
              <div className="p-6 border-b border-gray-200 dark:border-[#1a1a1a]">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">🏷️ Key Topics</h4>
                <div className="flex flex-wrap gap-2">
                  {analysisPopup.data.keyTopics.map((topic, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-50 dark:bg-[#1a1a1a] text-blue-700 dark:text-white rounded-full text-sm border border-blue-200 dark:border-[#1a1a1a]">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Details */}
            <div className="p-6 border-b border-gray-200 dark:border-[#1a1a1a]">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">📊 Additional Info</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {analysisPopup.data?.readingTime && (
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500 dark:text-gray-400">📖 Reading time:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{analysisPopup.data.readingTime} min</span>
                  </div>
                )}
                {analysisPopup.data?.targetAudience && (
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500 dark:text-gray-400">👥 Audience:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{analysisPopup.data.targetAudience}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 dark:bg-[#1a1a1a] rounded-b-lg border-t border-gray-200 dark:border-[#1a1a1a]">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Comprehensive analysis of full content and community discussions
                </p>
                <button
                  onClick={() => setAnalysisPopup({ show: false, data: null, content: null })}
                  className="px-4 py-2 bg-gray-600 dark:bg-[#1a1a1a] text-white rounded-md hover:bg-gray-700 dark:hover:bg-black transition-colors border border-gray-200 dark:border-[#1a1a1a]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post Chat */}
      <PostChat 
        isOpen={postChatOpen}
        onClose={() => setPostChatOpen(false)}
        postContent={currentPost}
        loading={postChatLoading}
        onSearch={handlePostSearch}
        position={chatPosition}
        chatKey={currentPost?._id || 'default'}
      />

      {/* Add Source Form */}
      <AddSourceForm
        isOpen={addSourceFormOpen}
        onClose={() => setAddSourceFormOpen(false)}
        onSourceAdded={handleSourceAdded}
      />
    </div>
  )
}