'use client'

import { useState, useEffect } from 'react'

export default function SourcesPage() {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSources()
    fetchDebugInfo()
  }, [])

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/sources')
      const data = await response.json()
      setSources(data.sources || [])
    } catch (error) {
      console.error('Error fetching sources:', error)
      setError('Failed to fetch sources')
    } finally {
      setLoading(false)
    }
  }

  const fetchDebugInfo = async () => {
    try {
      const response = await fetch('/api/debug')
      const data = await response.json()
      setDebugInfo(data)
    } catch (error) {
      console.error('Error fetching debug info:', error)
    }
  }

  const toggleSourceStatus = async (sourceId, currentStatus) => {
    try {
      const response = await fetch('/api/sources', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: sourceId,
          isActive: !currentStatus
        })
      })
      
      if (response.ok) {
        fetchSources() // Refresh the list
      }
    } catch (error) {
      console.error('Error toggling source:', error)
    }
  }

  const deleteSource = async (sourceId) => {
    if (!confirm('Are you sure you want to delete this source?')) return
    
    try {
      const response = await fetch(`/api/sources?id=${sourceId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        fetchSources() // Refresh the list
      }
    } catch (error) {
      console.error('Error deleting source:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Sources Management</h1>
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Sources Management</h1>
        
        {/* Debug Information */}
        {debugInfo && (
          <div className="bg-white dark:bg-[#0a0a0a] rounded-lg shadow-sm border border-gray-200 dark:border-[#1a1a1a] p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">🔍 Debug Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Environment</h3>
                <div className="space-y-1 text-sm">
                  <div>Node Env: {debugInfo.environment?.nodeEnv}</div>
                  <div>Vercel URL: {debugInfo.environment?.vercelUrl}</div>
                  <div>MongoDB URI: {debugInfo.environment?.hasMongoUri ? '✅ Set' : '❌ Missing'}</div>
                  <div>Reddit Client ID: {debugInfo.environment?.hasRedditClientId ? '✅ Set' : '❌ Missing'}</div>
                  <div>Reddit Client Secret: {debugInfo.environment?.hasRedditClientSecret ? '✅ Set' : '❌ Missing'}</div>
                  <div>Reddit Redirect URI: {debugInfo.environment?.hasRedditRedirectUri ? '✅ Set' : '❌ Missing'}</div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Database</h3>
                <div className="space-y-1 text-sm">
                  <div>Connected: {debugInfo.database?.connected ? '✅ Yes' : '❌ No'}</div>
                  {debugInfo.database?.error && (
                    <div className="text-red-600 dark:text-red-400">Error: {debugInfo.database.error}</div>
                  )}
                  <div>Active Sources: {debugInfo.database?.sources?.total || 0}</div>
                  <div>Total Content: {debugInfo.database?.content?.total || 0}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sources List */}
        <div className="bg-white dark:bg-[#0a0a0a] rounded-lg shadow-sm border border-gray-200 dark:border-[#1a1a1a]">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-[#1a1a1a]">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">📰 Sources ({sources.length})</h2>
          </div>
          
          {sources.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <p>No sources found. Add sources through the main app.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-[#1a1a1a]">
              {sources.map((source) => (
                <div key={source._id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{source.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Type: {source.type} • URL: {source.url}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          source.isActive 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                        }`}>
                          {source.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          Last fetched: {source.lastFetched ? new Date(source.lastFetched).toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleSourceStatus(source._id, source.isActive)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                          source.isActive
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {source.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      
                      <button
                        onClick={() => deleteSource(source._id)}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
