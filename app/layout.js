import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'DevDigest - Tech Feed Aggregator',
  description: 'A modern tech feed aggregator with AI-powered insights using Gemini API',
  keywords: 'tech news, programming, AI, machine learning, web development, software engineering',
  authors: [{ name: 'DevDigest Team' }],
  creator: 'DevDigest',
  openGraph: {
    title: 'DevDigest - Tech Feed Aggregator',
    description: 'Stay updated with the latest in technology with AI-powered insights',
    url: 'https://devdigest.com',
    siteName: 'DevDigest',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DevDigest - Tech Feed Aggregator',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevDigest - Tech Feed Aggregator',
    description: 'Stay updated with the latest in technology with AI-powered insights',
    images: ['/og-image.png'],
  },
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        {children}
      </body>
    </html>
  )
} 