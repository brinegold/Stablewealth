'use client'

import { TrendingUp, Shield, Users } from 'lucide-react'

export default function FeatureSection() {
  return (
    <div className="grid md:grid-cols-3 gap-8">
      <div className="text-center">
        <div className="bg-green-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <TrendingUp className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Daily Profits</h3>
        <p className="text-gray-300">Earn consistent daily returns on your investment with automated profit distribution.</p>
      </div>

      <div className="text-center">
        <div className="bg-amber-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">6-Level Referrals</h3>
        <p className="text-gray-300">Earn up to 10% USDT commission from your referrals across 4 levels of depth.</p>
      </div>

      <div className="text-center">
        <div className="bg-purple-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Secure Platform</h3>
        <p className="text-gray-300">Built with enterprise-grade security and automated transaction processing.</p>
      </div>
    </div>
  )
}
