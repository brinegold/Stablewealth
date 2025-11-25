'use client'

import Image from 'next/image'

export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen jarvis-gradient">
      {/* Header Skeleton */}
      <header className="border-b border-white/20 p-3 sm:p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Image
                src="/logo_300x300.png"
                alt="Jarvis Staking Logo"
                width={128}
                height={128}
                className="!h-24 !w-24 sm:!h-32 sm:!w-32"
                style={{ width: '96px', height: '96px' }}
                priority
              />
              <span className="text-lg sm:text-2xl font-bold text-white">Stable Wealth</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="text-white text-right hidden sm:block">
              <div className="h-4 bg-white/20 rounded w-24 mb-1 animate-pulse"></div>
              <div className="h-5 bg-white/20 rounded w-32 mb-1 animate-pulse"></div>
              <div className="h-3 bg-white/20 rounded w-20 animate-pulse"></div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-3 sm:p-4">
        {/* Total Income Card Skeleton */}
        <div className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 sm:h-12 bg-white/20 rounded w-48 mb-2 animate-pulse"></div>
              <div className="h-4 bg-white/20 rounded w-24 animate-pulse"></div>
            </div>
            <div className="hidden sm:block">
              <div className="h-24 w-24 bg-white/20 rounded animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Staking Notice Skeleton */}
        <div className="bg-blue-600/20 border border-blue-500 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="h-4 bg-blue-400/30 rounded w-full animate-pulse"></div>
        </div>

        {/* Wallet Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
          <div className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500/30 rounded-full animate-pulse"></div>
              <div>
                <div className="h-4 bg-white/20 rounded w-20 mb-2 animate-pulse"></div>
                <div className="h-5 bg-white/20 rounded w-16 animate-pulse"></div>
              </div>
            </div>
          </div>

          <div className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500/30 rounded-full animate-pulse"></div>
              <div>
                <div className="h-4 bg-white/20 rounded w-20 mb-2 animate-pulse"></div>
                <div className="h-5 bg-white/20 rounded w-16 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Jarvis Tokens Card Skeleton */}
        <div className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-yellow-400/30 to-orange-500/30 rounded-full animate-pulse"></div>
              <div>
                <div className="h-4 bg-white/20 rounded w-24 mb-2 animate-pulse"></div>
                <div className="h-6 bg-yellow-400/30 rounded w-32 mb-2 animate-pulse"></div>
                <div className="h-8 bg-green-500/30 rounded w-20 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center">
              <div className="h-6 w-6 sm:h-8 sm:w-8 bg-white/20 rounded mx-auto mb-2 animate-pulse"></div>
              <div className="h-4 bg-white/20 rounded w-16 mx-auto animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Income Tracking Skeleton */}
        <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="jarvis-card rounded-xl p-3 sm:p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="h-5 w-5 sm:h-6 sm:w-6 bg-white/20 rounded animate-pulse"></div>
                <div>
                  <div className="h-4 bg-white/20 rounded w-24 mb-1 animate-pulse"></div>
                  <div className="h-3 bg-blue-400/30 rounded w-12 animate-pulse"></div>
                </div>
              </div>
              <div className="h-4 bg-white/20 rounded w-16 animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Team & Investment Info Skeleton */}
        <div className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="h-5 bg-white/20 rounded w-48 mb-3 sm:mb-4 animate-pulse"></div>
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <div className="space-y-3 sm:space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="text-center">
                  <div className="h-3 bg-white/20 rounded w-20 mx-auto mb-2 animate-pulse"></div>
                  <div className="h-6 bg-white/20 rounded w-16 mx-auto animate-pulse"></div>
                </div>
              ))}
            </div>
            <div className="space-y-3 sm:space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="text-center">
                  <div className="h-3 bg-white/20 rounded w-20 mx-auto mb-2 animate-pulse"></div>
                  <div className="h-6 bg-white/20 rounded w-16 mx-auto animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom padding for dock */}
      <div className="h-24"></div>
    </div>
  )
}
