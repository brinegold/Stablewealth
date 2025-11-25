import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
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

        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <h2 className="text-2xl font-bold text-white mb-4">Page Not Found - Stable Wealth</h2>
        <p className="text-gray-300 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="space-y-4">
          <Link
            href="/"
            className="jarvis-button px-6 py-3 rounded-full text-white font-semibold inline-block"
          >
            Go Home
          </Link>
          <br />
          <Link
            href="/dashboard"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
