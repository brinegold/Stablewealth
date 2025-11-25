'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, Users, Copy, Share, Gift } from 'lucide-react'
import Link from 'next/link'
import { optimizedReferralService } from '@/lib/optimizedReferralService'

interface Profile {
  referral_code: string
  full_name: string
  sponsor_id: string | null
  sponsor_name?: string
}

interface ReferralStats {
  total_referrals: number
  total_commission: number
  total_usdt_earned: number
  total_ton_earned: number
  level_stats: Array<{
    level: number
    count: number
    usdtEarned: number
    tonEarned: number
    usdtRate: number
    tonRate: number
  }>
}

export default function ReferralPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [copied, setCopied] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const supabase = createSupabaseClient()

  const referralLevels = [
    { level: 1, percentage: 5 },
    { level: 2, percentage: 3 },
    { level: 3, percentage: 2 },
    { level: 4, percentage: 1 }
  ]

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && !hasLoaded && !isLoadingData) {
      fetchData()
    }
  }, [user, hasLoaded, isLoadingData])

  const fetchData = async () => {
    if (isLoadingData) return // Prevent duplicate requests

    setIsLoadingData(true)
    try {
      console.log('🚀 Starting optimized referral data fetch')
      const startTime = performance.now()

      // Use database function for optimized stats fetching
      const { data: optimizedStats, error: statsError } = await supabase
        .rpc('get_referral_stats_optimized', { user_id: user?.id })

      if (statsError) {
        console.warn('Database function not available, using fallback service')
        // Fallback to optimized service
        const fallbackStats = await optimizedReferralService.getReferralStats(user?.id || '')

        setStats({
          total_referrals: fallbackStats.totalReferrals,
          total_commission: fallbackStats.totalUsdtEarned, // For backward compatibility
          total_usdt_earned: fallbackStats.totalUsdtEarned,
          total_ton_earned: fallbackStats.totalTonEarned,
          level_stats: fallbackStats.levelStats
        })
      } else {
        // Use optimized database function results
        setStats({
          total_referrals: optimizedStats.totalReferrals,
          total_commission: optimizedStats.totalUsdtEarned,
          total_usdt_earned: optimizedStats.totalUsdtEarned,
          total_ton_earned: optimizedStats.totalTonEarned,
          level_stats: optimizedStats.levelStats
        })
      }

      // Fetch profile data in parallel
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          referral_code, 
          full_name, 
          sponsor_id,
          sponsor:profiles!profiles_sponsor_id_fkey(full_name)
        `)
        .eq('id', user?.id)
        .single()

      if (profileError) {
        console.warn('Profile join failed, using fallback method')
        // Fallback method
        const { data: basicProfile } = await supabase
          .from('profiles')
          .select('referral_code, full_name, sponsor_id')
          .eq('id', user?.id)
          .single()

        if (basicProfile?.sponsor_id) {
          const { data: sponsorData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('referral_code', basicProfile.sponsor_id)
            .single()

          if (sponsorData) {
            (basicProfile as any).sponsor_name = sponsorData.full_name
          }
        }
        setProfile(basicProfile)
      } else {
        // Use joined data
        const sponsor = Array.isArray(profileData.sponsor) ? profileData.sponsor[0] : profileData.sponsor
        const profileWithSponsor = {
          ...profileData,
          sponsor_name: sponsor?.full_name
        }
        setProfile(profileWithSponsor)
      }

      const endTime = performance.now()
      console.log(`✅ Optimized referral data loaded in ${(endTime - startTime).toFixed(2)}ms`)
      setHasLoaded(true)

    } catch (error) {
      console.error('❌ Error fetching referral data:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  const copyReferralLink = async () => {
    if (!profile) return

    const referralLink = `${window.location.origin}/auth/signup?ref=${profile.referral_code}`

    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = referralLink
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shareReferralLink = async () => {
    if (!profile) return

    const referralLink = `${window.location.origin}/auth/signup?ref=${profile.referral_code}`
    const shareText = `Join Jarvis Staking and start earning with smart crypto investments! Use my referral code: ${profile.referral_code}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Jarvis Staking',
          text: shareText,
          url: referralLink
        })
      } catch (error) {
        console.log('Share cancelled')
      }
    } else {
      copyReferralLink()
    }
  }

  if (loading || isLoadingData) {
    return (
      <div className="min-h-screen jarvis-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">
            {loading ? 'Loading...' : 'Fetching referral data...'}
          </p>
          {isLoadingData && (
            <p className="text-gray-300 text-sm mt-2">
              Using optimized queries for faster loading
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen jarvis-gradient">
      {/* Header */}
      <header className="border-b border-white/20 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-white hover:text-blue-300">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-2xl font-bold text-white mb-4">Stable Wealth Referral Program</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-md">
        {/* Referral Stats */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-white text-xl font-bold mb-2">Your Referral Stats</h2>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <p className="text-gray-300 text-sm">Total Referrals</p>
                <p className="text-2xl font-bold text-blue-400">{stats?.total_referrals || 0}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-500/10 rounded-lg p-3">
                <p className="text-gray-300 text-sm">USDT Earned</p>
                <p className="text-xl font-bold text-green-400">${stats?.total_usdt_earned?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-3">
                <p className="text-gray-300 text-sm">TON Earned</p>
                <p className="text-xl font-bold text-yellow-400">{stats?.total_ton_earned?.toLocaleString() || '0'} TON</p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral Code */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center">
            <Gift className="h-6 w-6 mr-2 text-yellow-400" />
            Your Referral Code
          </h3>

          <div className="bg-white/10 rounded-lg p-4 mb-4">
            <p className="text-center text-2xl font-bold text-yellow-400 tracking-wider">
              {profile?.referral_code || 'Loading...'}
            </p>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={copyReferralLink}
              className="flex-1 jarvis-button py-3 rounded-lg text-white font-semibold flex items-center justify-center"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={shareReferralLink}
              className="flex-1 bg-green-600 hover:bg-green-700 py-3 rounded-lg text-white font-semibold flex items-center justify-center transition-colors"
            >
              <Share className="h-4 w-4 mr-2" />
              Share
            </button>
          </div>
        </div>

        {/* Upline Information */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center">
            <Users className="h-6 w-6 mr-2 text-blue-400" />
            Your Upline
          </h3>

          {profile?.sponsor_id ? (
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4">
              <p className="text-center text-white font-semibold">
                Referred by: {(profile as any)?.sponsor_name || 'Loading...'}
              </p>
              <p className="text-center text-gray-300 text-sm mt-1">
                Sponsor ID: {profile.sponsor_id}
              </p>
            </div>
          ) : (
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <p className="text-gray-300">No upline (you are a top-level member)</p>
            </div>
          )}
        </div>

        {/* Commission Structure */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4">Dual Commission Structure</h3>
          <div className="space-y-3">
            {/* Always show all 4 levels with actual data when available */}
            {referralLevels.map((level) => {
              // Find matching level stat if it exists
              const levelStat = stats?.level_stats?.find(ls => ls.level === level.level)

              return (
                <div key={level.level} className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">{level.level}</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">Level {level.level}</p>
                        <p className="text-gray-300 text-sm">{levelStat?.count || 0} referrals</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="bg-green-500/10 rounded p-2">
                      <p className="text-green-400 font-bold text-sm">{level.percentage}% USDT</p>
                      <p className="text-gray-400 text-xs">Earned: ${levelStat?.usdtEarned?.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="bg-yellow-500/10 rounded p-2">
                      <p className="text-yellow-400 font-bold text-sm">{level.percentage + 5}% TON</p>
                      <p className="text-gray-400 text-xs">Earned: {levelStat?.tonEarned?.toLocaleString() || '0'} TON</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* How It Works */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4">How Referrals Work</h3>
          <div className="space-y-3 text-gray-300 text-sm">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">1</span>
              </div>
              <p>Share your referral code with friends and family</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">2</span>
              </div>
              <p>When they invest or stake, you earn dual commissions in both USDT and TON coins</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">3</span>
              </div>
              <p>Earn from 10 levels deep - build your network and maximize earnings</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">4</span>
              </div>
              <p>USDT commissions go to your main wallet, TON coins are added to your coin balance</p>
            </div>
          </div>
        </div>

        {/* Referral Benefits */}
        <div className="jarvis-card rounded-2xl p-6">
          <h3 className="text-white font-bold text-lg mb-4">Dual Referral Benefits</h3>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg p-4">
              <Users className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-white font-semibold">4 Levels</p>
              <p className="text-gray-300 text-sm">Deep Commission</p>
            </div>
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-4">
              <Gift className="h-8 w-8 text-purple-400 mx-auto mb-2" />
              <p className="text-white font-semibold">Dual Rewards</p>
              <p className="text-gray-300 text-sm">USDT + TON Coins</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/30">
            <p className="text-center text-yellow-400 font-semibold text-sm">
              🎉 Earn up to 5% USDT + 20% TON coins on Level 1 referrals!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
