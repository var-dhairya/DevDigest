'use client'

import { useState } from 'react'

export default function SimpleRefreshButton({ onRefresh }) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleRefresh = async () => {
    setIsLoading(true)
    setMessage('')
    
    try {
      console.log('🔄 Starting content refresh...')
      setMessage('🔄 Fetching new posts from all sources...')
      
      const response = await fetch('/api/refresh', { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        const newPostsCount = data.data?.totalFetched || 0
        setMessage(`✅ ${data.message}`)
        
        // Trigger content refresh in parent component
        if (onRefresh) {
          console.log('🔄 Triggering frontend refresh...')
          setMessage('🔄 Updating feed with new content...')
          await onRefresh()
          
          if (newPostsCount > 0) {
            setMessage(`✅ ${newPostsCount} new posts fetched! Feed updated with latest content at the top.`)
          } else {
            setMessage(`✅ Feed refreshed! No new posts found, showing latest content.`)
          }
        }
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error) {
      console.error('Refresh error:', error)
      setMessage(`❌ Error: ${error.message}`)
    } finally {
      setIsLoading(false)
      // Clear message after 8 seconds for refresh success
      setTimeout(() => setMessage(''), 8000)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 border ${
          isLoading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300'
            : 'bg-blue-600 dark:bg-[#1a1a1a] text-white hover:bg-blue-700 dark:hover:bg-black border-blue-600 dark:border-[#1a1a1a]'
        }`}
      >
        {isLoading ? (
          <>
            <span className="animate-spin">🔄</span>
            <span>Fetching...</span>
          </>
        ) : (
          <>
            <span>🔄</span>
            <span>Refresh Feed</span>
          </>
        )}
      </button>
      
      {message && (
        <div className={`absolute top-full right-0 mt-2 p-3 rounded-lg text-sm shadow-lg z-10 min-w-64 border ${
          message.includes('✅')
            ? 'bg-green-50 dark:bg-[#0a0a0a] border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-[#0a0a0a] border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
} 