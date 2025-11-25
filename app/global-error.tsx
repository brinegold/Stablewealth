'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global error:', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen jarvis-gradient flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="mb-8">
              <Image
                src="/logo_300x300.png"
                alt="Jarvis Staking Logo"
                width={128}
                height={128}
                className="mx-auto mb-4"
                priority
              />
            </div>

            <h2 className="text-2xl font-bold text-white mb-4">Stable Wealth Error</h2>
            <h2 className="text-2xl font-semibold text-white mb-4">Something went wrong!</h2>
            <p className="text-gray-300 mb-8">
              We're sorry, but something unexpected happened. Please try again.
            </p>

            <div className="space-y-4">
              <button
                onClick={reset}
                className="jarvis-button px-6 py-3 rounded-full text-white font-semibold mr-4"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
