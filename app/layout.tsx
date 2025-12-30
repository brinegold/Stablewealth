import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ServerInitializer } from '@/components/ServerInitializer'
import DashboardPreloader from '@/components/DashboardPreloader'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: 'StableWealth - Smart Crypto Growth Platform',
  description: 'Invest in Future Smart Crypto Growth with StableWealth. Revolutionary cryptocurrency investment platform offering secure, decentralized alternatives to traditional money.',
  keywords: ['crypto', 'staking', 'investment', 'blockchain', 'USDT', 'cryptocurrency'],
  authors: [{ name: 'StableWealth Team' }],
  creator: 'StableWealth',
  publisher: 'StableWealth',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/logo_32x32.png',
    shortcut: '/logo_32x32.png',
    apple: '/logo_32x32.png',
  },
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a1a2e',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ServerInitializer />
        <AuthProvider>
          <DashboardPreloader />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
