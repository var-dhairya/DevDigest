'use client'

import { useState, useRef, useEffect } from 'react'

export default function PostChat({ isOpen, onClose, postContent, loading, onSearch, position, chatKey }) {
  const [messages, setMessages] = useState([])
  const [query, setQuery] = useState('')
  const chatRef = useRef(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Clear messages when chatKey changes (new post selected)
  useEffect(() => {
    setMessages([])
    setQuery('')
  }, [chatKey])

  // Clear messages when post content changes (new post selected)
  useEffect(() => {
    if (postContent) {
      setMessages([])
      setQuery('')
    }
  }, [postContent])

  // Close chat when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (chatRef.current && !chatRef.current.contains(event.target)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Close chat when scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [isOpen, onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (query.trim() && !loading) {
      const userMessage = { role: 'user', content: query }
      setMessages(prev => [...prev, userMessage])
      
      try {
        await onSearch(query.trim(), postContent, setMessages)
      } catch (error) {
        const errorMessage = { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
        setMessages(prev => [...prev, errorMessage])
      }
      
      setQuery('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div 
      ref={chatRef}
      className="fixed z-50 w-80 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#1a1a1a] rounded-lg shadow-xl max-h-[80vh] flex flex-col"
      style={{
        left: position ? `${position.left}px` : '24px',
        top: position ? `${position.top}px` : '96px'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-[#1a1a1a] bg-gray-50 dark:bg-[#0f0f0f]">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Assistant</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ask about this post</p>
          {postContent?.title && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-48 truncate">
              {postContent.title}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">Ask me anything about this post!</p>
            {postContent?.title && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 max-w-full truncate px-2">
                Post: {postContent.title}
              </p>
            )}
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-600 dark:bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-[#1a1a1a] text-gray-900 dark:text-white'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-3 rounded-lg bg-gray-100 dark:bg-[#1a1a1a]">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100 dark:border-[#1a1a1a] bg-gray-50 dark:bg-[#0f0f0f]">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this post..."
            disabled={loading}
            className="w-full px-4 py-2 pr-12 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#1a1a1a] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  )
} 