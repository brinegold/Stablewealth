'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, Users, Copy, Share, Gift, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { optimizedReferralService } from '@/lib/optimizedReferralService'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import { useCallback } from 'react'

interface Profile {
  referral_code: string
  full_name: string
  sponsor_id: string | null
  sponsor_name?: string
}

interface ReferralUser {
  id: string
  full_name: string
  referral_code: string
  level: number
  joined_at?: string
}

interface ReferralStats {
  total_referrals: number
  total_commission: number
  total_usdt_earned: number
  level_stats: Array<{
    level: number
    count: number
    usdtEarned: number
    usdtRate: number
  }>
  referrals_by_level?: Record<number, ReferralUser[]>
}

export default function ReferralPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [copied, setCopied] = useState(false)
  const [expandedLevels, setExpandedLevels] = useState<Record<number, boolean>>({})


  const supabase = createSupabaseClient()

  const referralLevels = [
    { level: 1, percentage: 10 },
    { level: 2, percentage: 5 },
    { level: 3, percentage: 3 },
    { level: 4, percentage: 2 },
    { level: 5, percentage: 1 },
    { level: 6, percentage: 0.5 }
  ]

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  const toggleLevel = (level: number) => {
    setExpandedLevels(prev => ({
      ...prev,
      [level]: !prev[level]
    }))
  }

  const fetchReferralData = useCallback(async () => {
    if (!user?.id) return null

    console.log('🚀 Starting optimized referral data fetch')
    const startTime = performance.now()

    // Use database function for optimized stats fetching
    const { data: optimizedStats, error: statsError } = await supabase
      .rpc('get_referral_stats_optimized', { user_id: user.id })

    // Fetch referrals with commissions (only those who have earned commissions)
    const { data: referralChain, error: chainError } = await supabase
      .rpc('get_referrals_with_commissions', { user_id: user.id })

    if (chainError) {
      console.warn('Error fetching referrals with commissions:', chainError)
    }

    // Group referrals by level
    const referralsByLevel: Record<number, ReferralUser[]> = {}
    if (referralChain) {
      referralChain.forEach((ref: any) => {
        if (!referralsByLevel[ref.level]) {
          referralsByLevel[ref.level] = []
        }
        referralsByLevel[ref.level].push({
          id: ref.id,
          full_name: ref.full_name,
          referral_code: ref.referral_code,
          level: ref.level,
          joined_at: ref.created_at
        })
      })
    }

    let statsData = null
    if (statsError) {
      console.warn('Database function not available, using fallback service')
      // Fallback to optimized service
      const fallbackStats = await optimizedReferralService.getReferralStats(user.id)

      // Calculate total referrals from the filtered list (only those with commissions)
      const totalReferralsWithCommissions = Object.values(referralsByLevel).reduce(
        (sum, refs) => sum + refs.length,
        0
      )

      statsData = {
        total_referrals: totalReferralsWithCommissions,
        total_commission: fallbackStats.totalUsdtEarned,
        total_usdt_earned: fallbackStats.totalUsdtEarned,
        level_stats: fallbackStats.levelStats,
        referrals_by_level: referralsByLevel
      }
    } else {
      // Use optimized database function results
      // Calculate total referrals from the filtered list (only those with commissions)
      const totalReferralsWithCommissions = Object.values(referralsByLevel).reduce(
        (sum, refs) => sum + refs.length,
        0
      )

      statsData = {
        total_referrals: totalReferralsWithCommissions,
        total_commission: optimizedStats.totalUsdtEarned,
        total_usdt_earned: optimizedStats.totalUsdtEarned,
        level_stats: optimizedStats.levelStats,
        referrals_by_level: referralsByLevel
      }
    }

    // Fetch profile data in parallel
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(`
        referral_code, 
        full_name, 
        sponsor_id,
        sponsor:profiles!sponsor_id(full_name)
      `)
      .eq('id', user.id)
      .single()

    let profileResult = null
    if (profileError) {
      console.warn('Profile join failed, using fallback method')
      // Fallback method
      const { data: basicProfile } = await supabase
        .from('profiles')
        .select('referral_code, full_name, sponsor_id')
        .eq('id', user.id)
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
      profileResult = basicProfile
    } else {
      // Use joined data
      const sponsor = Array.isArray(profileData.sponsor) ? profileData.sponsor[0] : profileData.sponsor
      const profileWithSponsor = {
        ...profileData,
        sponsor_name: sponsor?.full_name
      }
      profileResult = profileWithSponsor
    }

    const endTime = performance.now()
    console.log(`✅ Optimized referral data loaded in ${(endTime - startTime).toFixed(2)}ms`)
    console.log('📊 Stats Data:', statsData)
    console.log('👤 Profile Result:', profileResult)

    return { stats: statsData, profile: profileResult }
  }, [user?.id, supabase])

  const { data, loading: isLoadingData } = useOptimizedData(fetchReferralData, {
    cacheKey: `referral_data_${user?.id}`,
    enabled: !!user?.id,
    cacheExpiry: 5 * 60 * 1000 // 5 minutes
  })

  useEffect(() => {
    if (data) {
      console.log('🔄 Setting state from optimized data:', data)
      setStats(data.stats)
      setProfile(data.profile as any)

    }
  }, [data])

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
            <div className="bg-green-500/10 rounded-lg p-3">
              <p className="text-gray-300 text-sm">USDT Earned</p>
              <p className="text-xl font-bold text-green-400">${stats?.total_usdt_earned?.toFixed(2) || '0.00'}</p>
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

        {/* My Team Section */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center">
            <Users className="h-6 w-6 mr-2 text-blue-400" />
            My Team
          </h3>

          <div className="space-y-4">
            {referralLevels.map((level) => {
              const levelReferrals = stats?.referrals_by_level?.[level.level] || []
              if (levelReferrals.length === 0) return null

              return (
                <div key={level.level} className="bg-white/5 rounded-lg overflow-hidden">
                  <div className="bg-white/10 p-3 flex items-center justify-between">
                    <h4 className="text-white font-semibold flex items-center">
                      <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs mr-2">
                        {level.level}
                      </span>
                      Level {level.level}
                    </h4>
                    <span className="text-gray-400 text-sm">{levelReferrals.length} members</span>
                  </div>
                  <div className="divide-y divide-white/10">
                    {levelReferrals.map((ref) => (
                      <div key={ref.id} className="p-3 hover:bg-white/5 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-white font-medium">{ref.full_name}</p>
                            <p className="text-gray-400 text-xs">ID: {ref.referral_code}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-300 text-xs">
                              Joined: {ref.joined_at ? new Date(ref.joined_at).toLocaleDateString() : 'N/A'}
                            </p>
                            <span className="inline-block px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-full mt-1">
                              Active
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {(!stats?.referrals_by_level || Object.keys(stats.referrals_by_level).length === 0) && (
              <div className="text-center py-8 text-gray-400">
                <p>No team members found yet.</p>
                <p className="text-sm mt-2">Share your referral link to start building your team!</p>
              </div>
            )}
          </div>
        </div>

        {/* Commission Structure */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4">Commission Structure</h3>
          <div className="space-y-3">
            {/* Always show all 6 levels with actual data when available */}
            {referralLevels.map((level) => {
              // Find matching level stat if it exists
              const levelStat = stats?.level_stats?.find(ls => ls.level === level.level)
              const levelReferrals = stats?.referrals_by_level?.[level.level] || []
              const isExpanded = expandedLevels[level.level]

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
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    <div className="bg-green-500/10 rounded p-2">
                      <p className="text-green-400 font-bold text-sm">{level.percentage}% USDT</p>
                      <p className="text-gray-400 text-xs">Earned: ${levelStat?.usdtEarned?.toFixed(2) || '0.00'}</p>
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
              <div className="w-6 h-6 bg-amber-800 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">1</span>
              </div>
              <p>Share your referral code with friends and family</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-amber-800 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">3</span>
              </div>
              <p>Earn from 6 levels deep - build your network and maximize earnings</p>
            </div>
          </div>
        </div>

        {/* Referral Benefits */}
        <div className="jarvis-card rounded-2xl p-6">
          <h3 className="text-white font-bold text-lg mb-4">Referral Benefits</h3>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg p-4">
              <Users className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-white font-semibold">6 Levels</p>
              <p className="text-gray-300 text-sm">Deep Commission</p>
            </div>
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-4">
              <Gift className="h-8 w-8 text-purple-400 mx-auto mb-2" />
              <p className="text-white font-semibold">USDT Rewards</p>
              <p className="text-gray-300 text-sm">Commission</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/30">
            <p className="text-center text-yellow-400 font-semibold text-sm">
              🎉 Earn up to 10% USDT on Level 1 referrals!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
