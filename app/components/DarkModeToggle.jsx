'use client'

import { useState, useEffect } from 'react'

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Check if user has a saved preference
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    const newTheme = !isDark
    setIsDark(newTheme)
    
    if (newTheme) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <button
      onClick={toggleDarkMode}
      className="px-4 py-3 bg-gray-200 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-[#2a2a2a] transition-colors flex items-center space-x-2 border border-gray-300 dark:border-0 focus:outline-none focus:ring-0"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <>
          <span>☀️</span>
          <span className="hidden sm:inline">Light</span>
        </>
      ) : (
        <>
          <span>🌙</span>
          <span className="hidden sm:inline">Dark</span>
        </>
      )}
    </button>
  )
} 