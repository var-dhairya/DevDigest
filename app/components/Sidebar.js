'use client'

import { useState } from 'react'

export default function Sidebar({ stats }) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  return (
    <>
      {/* Sidebar with integrated drawer handle */}
      <div className={`fixed left-0 top-0 h-full w-80 bg-white dark:bg-[#1a1a1a] shadow-2xl transition-all duration-300 ease-in-out z-40 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Integrated drawer handle on the right edge */}
        <button
          onClick={toggleSidebar}
          className="absolute right-0 top-1/2 transform -translate-y-1/2 w-4 h-24 bg-gray-300 dark:bg-[#1a1a1a] hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors duration-200 flex items-center justify-center cursor-pointer"
        >
          <div className="w-1 h-16 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
        </button>
        
        <div className={`h-full overflow-y-auto ${
          isOpen ? 'pl-6 pr-6 pt-6 pb-6' : 'p-6'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">Dashboard</h2>
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#0a0a0a] transition-colors"
            >
              <span className="text-gray-600 dark:text-gray-300 text-lg">✕</span>
            </button>
          </div>

          {/* Stats Section */}
          <div className="space-y-5">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-5">Content Overview</h3>
            
            {/* Total Articles */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-[#1a1a1a] dark:to-[#2a2a2a] rounded-xl p-5 border border-blue-200 dark:border-[#1a1a1a] shadow-lg hover:shadow-xl transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-300 mb-1">Total Articles</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-white tracking-tight">{stats.totalArticles}</p>
                </div>
                <div className="text-3xl">📰</div>
              </div>
            </div>

            {/* Active Sources */}
            <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-[#1a1a1a] dark:to-[#2a2a2a] rounded-xl p-5 border border-green-200 dark:border-[#1a1a1a] shadow-lg hover:shadow-xl transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-300 mb-1">Active Sources</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-white tracking-tight">{stats.activeSources}</p>
                </div>
                <div className="text-3xl">🔗</div>
              </div>
            </div>

            {/* Total Sources */}
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-[#1a1a1a] dark:to-[#2a2a2a] rounded-xl p-5 border border-purple-200 dark:border-[#1a1a1a] shadow-lg hover:shadow-xl transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-300 mb-1">Total Sources</p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-white tracking-tight">{stats.totalSources}</p>
                </div>
                <div className="text-3xl">📡</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-5">Quick Actions</h3>
            <div className="space-y-3">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('openAddSourceForm'))}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#0a0a0a] transition-all duration-200 hover:shadow-md border border-gray-200 dark:border-[#1a1a1a] hover:border-gray-300 dark:hover:border-gray-700"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">➕</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Add New Source</span>
                </div>
              </button>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('triggerContentRefresh'))}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#0a0a0a] transition-all duration-200 hover:shadow-md border border-gray-200 dark:border-[#1a1a1a] hover:border-gray-300 dark:hover:border-gray-700"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">🔄</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Refresh Content</span>
                </div>
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#0a0a0a] transition-all duration-200 hover:shadow-md border border-gray-200 dark:border-[#1a1a1a] hover:border-gray-300 dark:hover:border-gray-700">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">⚙️</span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Settings</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Always visible drawer handle for opening the sidebar */}
      {!isOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed left-0 top-1/2 transform -translate-y-1/2 z-50 w-4 h-24 bg-gray-300 dark:bg-[#1a1a1a] hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors duration-200 flex items-center justify-center cursor-pointer shadow-lg"
        >
          <div className="w-1 h-16 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
        </button>
      )}

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={toggleSidebar}
        />
      )}
    </>
  )
} 