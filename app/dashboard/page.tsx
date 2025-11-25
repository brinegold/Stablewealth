'use client'

import { useEffect, useState, lazy, Suspense } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import {
  Wallet,
  TrendingUp,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Coins,
  Youtube,
  Mail,
  BookOpen,
  Send as Telegram
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import DockNavbar from '@/components/DockNavbar'
import { dualReferralService } from '@/lib/referralService'
import { useOptimizedData } from '@/hooks/useOptimizedData'

// Lazy load heavy components
const IncomeModal = lazy(() => import('@/components/dashboard/IncomeModal'))
const JrcPurchaseModal = lazy(() => import('@/components/dashboard/JrcPurchaseModal'))

interface Profile {
  id: string
  full_name: string
  referral_code: string
  total_jarvis_tokens: number
  main_wallet_balance: number
  fund_wallet_balance: number
}

interface InvestmentPlan {
  id: string
  plan_type: 'A' | 'B' | 'C'
  investment_amount: number
  daily_percentage: number
  jarvis_tokens_earned: number
  is_active: boolean
  created_at: string
}

interface JrcStakingPlan {
  id: string
  user_id: string
  amount: number
  staking_period: number
  daily_percentage: number
  start_date: string
  end_date: string
  status: 'active' | 'completed' | 'withdrawn'
  total_profit_earned: number
  rewards_claimed: number
  created_at: string
}

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [totalProfits, setTotalProfits] = useState(0)
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [selectedIncomeType, setSelectedIncomeType] = useState<string>('')
  const [incomeData, setIncomeData] = useState<any[]>([])
  const [referralCommissions, setReferralCommissions] = useState(0)
  const [referralUsdtEarned, setReferralUsdtEarned] = useState(0)
  const [referralJrcEarned, setReferralJrcEarned] = useState(0)
  const [totalReferrals, setTotalReferrals] = useState(0)
  const [teamInvestment, setTeamInvestment] = useState(0)
  const [totalJrcStaked, setTotalJrcStaked] = useState(0)
  const [plans, setPlans] = useState<InvestmentPlan[]>([])
  const [jrcStakingPlans, setJrcStakingPlans] = useState<JrcStakingPlan[]>([])
  const [totalJrcEarned, setTotalJrcEarned] = useState(0)
  const [stakingIncome, setStakingIncome] = useState(0)
  const [loadingData, setLoadingData] = useState(true)
  const [showSkeleton, setShowSkeleton] = useState(false) // Always false - no skeleton
  const [showJrcModal, setShowJrcModal] = useState(false)
  const [jrcAmount, setJrcAmount] = useState('')
  const [jrcPurchasing, setJrcPurchasing] = useState(false)
  const [jrcError, setJrcError] = useState('')
  const [jrcSuccess, setJrcSuccess] = useState('')
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchUserData()
    }
  }, [user])

  const fetchUserData = async () => {
    try {
      // Execute all queries in parallel for instant loading
      const [
        profileResult,
        plansResult,
        jrcStakingResult,
        profitDistributionsResult,
        legacyCommissionsResult
      ] = await Promise.allSettled([
        // Profile query
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user?.id)
          .single(),

        // Investment plans query
        supabase
          .from('investment_plans')
          .select('*')
          .eq('user_id', user?.id)
          .eq('is_active', true),

        // JRC staking plans query
        supabase
          .from('jrc_staking_plans')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false }),

        // Profit distributions query (for staking income)
        supabase
          .from('profit_distributions')
          .select('profit_amount')
          .eq('user_id', user?.id),

        // Legacy referral commissions query (fallback)
        supabase
          .from('referral_commissions')
          .select('commission_amount')
          .eq('referrer_id', user?.id)
      ])

      // Process profile data
      let profileData = null
      if (profileResult.status === 'fulfilled' && !profileResult.value.error) {
        profileData = profileResult.value.data
        setProfile(profileData)
      }

      // Process investment plans data
      let plansData: any[] = []
      if (plansResult.status === 'fulfilled' && !plansResult.value.error) {
        plansData = plansResult.value.data || []
        setPlans(plansData)

        // Calculate total profits from investment plans
        const calculatedProfits = plansData.reduce((sum: number, plan: any) => sum + (plan.total_profit_earned || 0), 0)
        setTotalProfits(calculatedProfits)
      }

      // Process profit distributions data (for staking income)
      if (profitDistributionsResult.status === 'fulfilled' && !profitDistributionsResult.value.error) {
        const distributionsData = profitDistributionsResult.value.data || []
        console.log('Profit distributions data:', distributionsData)
        const totalStakingIncome = distributionsData.reduce((sum: number, dist: any) => sum + (dist.profit_amount || 0), 0)
        console.log('Total staking income calculated:', totalStakingIncome)
        setStakingIncome(totalStakingIncome)

        // If no profit distributions yet, fallback to investment plan profits
        if (totalStakingIncome === 0 && plansData.length > 0) {
          const fallbackIncome = plansData.reduce((sum: number, plan: any) => sum + (plan.total_profit_earned || 0), 0)
          console.log('Using fallback staking income from investment plans:', fallbackIncome)
          setStakingIncome(fallbackIncome)
        }
      } else {
        console.error('Profit distributions query failed:', profitDistributionsResult)
        // Fallback to investment plan profits if query fails
        if (plansData.length > 0) {
          const fallbackIncome = plansData.reduce((sum: number, plan: any) => sum + (plan.total_profit_earned || 0), 0)
          console.log('Using fallback staking income due to query failure:', fallbackIncome)
          setStakingIncome(fallbackIncome)
        } else {
          setStakingIncome(0)
        }
      }

      // Process JRC staking data
      if (jrcStakingResult.status === 'fulfilled' && !jrcStakingResult.value.error) {
        const jrcStakingData = jrcStakingResult.value.data || []
        setJrcStakingPlans(jrcStakingData)

        // Calculate total JRC earned and staked
        const totalJrcEarned = jrcStakingData.reduce((sum: number, plan: JrcStakingPlan) =>
          sum + (plan.total_profit_earned || 0), 0)
        setTotalJrcEarned(totalJrcEarned)

        const totalStaked = jrcStakingData
          .filter((plan: JrcStakingPlan) => plan.status === 'active')
          .reduce((sum: number, plan: JrcStakingPlan) => sum + (plan.amount || 0), 0)
        setTotalJrcStaked(totalStaked)
      }

      // Process referral data in parallel after profile is available
      if (profileData?.referral_code) {
        const [
          referralStatsResult,
          directReferralsResult
        ] = await Promise.allSettled([
          // Optimized referral stats (simplified)
          supabase
            .from('referral_commissions')
            .select('commission_amount, jrc_commission, level, referred_id')
            .eq('referrer_id', user?.id),

          // Direct referrals for team investment
          supabase
            .from('profiles')
            .select('id')
            .eq('sponsor_id', profileData.referral_code)
        ])

        // Process referral stats
        if (referralStatsResult.status === 'fulfilled' && !referralStatsResult.value.error) {
          const commissions = referralStatsResult.value.data || []
          const totalUsdtEarned = commissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
          const totalJrcEarned = commissions.reduce((sum, c) => sum + (c.jrc_commission || 0), 0)

          setReferralCommissions(totalUsdtEarned)
          setReferralUsdtEarned(totalUsdtEarned)
          setReferralJrcEarned(totalJrcEarned)

          // Count unique referrals from commissions
          const uniqueReferrals = new Set(commissions.map(c => c.referred_id)).size
          setTotalReferrals(uniqueReferrals)
        } else {
          // Fallback to legacy commissions
          if (legacyCommissionsResult.status === 'fulfilled' && !legacyCommissionsResult.value.error) {
            const legacyCommissions = legacyCommissionsResult.value.data || []
            const legacyTotal = legacyCommissions.reduce((sum, c) => sum + parseFloat(c.commission_amount?.toString() || '0'), 0)
            setReferralCommissions(legacyTotal)
          }
        }

        // Process team investment
        if (directReferralsResult.status === 'fulfilled' && !directReferralsResult.value.error) {
          const directReferrals = directReferralsResult.value.data || []
          setTotalReferrals(directReferrals.length) // Set actual direct referrals count

          if (directReferrals.length > 0) {
            const referralIds = directReferrals.map(r => r.id)

            // Get team investments in parallel
            const { data: teamInvestments } = await supabase
              .from('investment_plans')
              .select('investment_amount')
              .in('user_id', referralIds)

            const totalTeamInvestment = teamInvestments?.reduce((sum, inv) => sum + inv.investment_amount, 0) || 0
            setTeamInvestment(totalTeamInvestment)
          }
        }
      }

    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const handleViewIncome = async (incomeType: string) => {
    setSelectedIncomeType(incomeType)
    setIncomeData([])

    try {
      switch (incomeType) {
        case 'trade':
          // Fetch investment profits
          const { data: investments, error: investError } = await supabase
            .from('investment_plans')
            .select('*')
            .eq('user_id', user?.id)
            .order('created_at', { ascending: false })

          if (!investError) {
            setIncomeData(investments || [])
          }
          break

        case 'referral':
          // Fetch referral commissions
          const { data: commissions, error: commError } = await supabase
            .from('referral_commissions')
            .select(`
              *,
              profiles!referral_commissions_referred_id_fkey(username, referral_code)
            `)
            .eq('referrer_id', user?.id)
            .order('created_at', { ascending: false })

          if (!commError) {
            setIncomeData(commissions || [])
          }
          break

        case 'tokens':
          // Fetch token transactions
          const { data: tokenTxs, error: tokenError } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user?.id)
            .in('transaction_type', ['referral_bonus', 'signup_bonus'])
            .order('created_at', { ascending: false })

          if (!tokenError) {
            setIncomeData(tokenTxs || [])
          }
          break

        case 'staking':
          // Fetch profit distributions (actual staking income)
          const { data: stakingIncome, error: stakingError } = await supabase
            .from('profit_distributions')
            .select(`
              *,
              investment_plans!inner(plan_type, investment_amount, daily_percentage)
            `)
            .eq('user_id', user?.id)
            .order('distribution_date', { ascending: false })

          if (!stakingError) {
            setIncomeData(stakingIncome || [])
          }
          break

        case 'staking-referral':
          // Fetch JRC staking plans and distributions
          const { data: stakingPlans, error: jrcStakingError } = await supabase
            .from('jrc_staking_plans')
            .select('*')
            .eq('user_id', user?.id)
            .order('created_at', { ascending: false })

          if (!jrcStakingError) {
            setIncomeData(stakingPlans || [])
          }
          break

        default:
          setIncomeData([])
      }
    } catch (error) {
      console.error('Error fetching income data:', error)
      setIncomeData([])
    }

    setShowIncomeModal(true)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  const handleJrcPurchase = async () => {
    if (!jrcAmount || !profile) return

    setJrcPurchasing(true)
    setJrcError('')
    setJrcSuccess('')

    const coinsToBuy = parseFloat(jrcAmount)

    // Validation
    if (coinsToBuy <= 0) {
      setJrcError('Please enter a valid amount of JRC coins to purchase')
      setJrcPurchasing(false)
      return
    }

    try {
      const response = await fetch('/api/jrc/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jrcAmount: jrcAmount,
          userId: user.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to purchase JRC coins')
      }

      // Update local state with response data
      setProfile((prev: any) => ({
        ...prev,
        fund_wallet_balance: data.newFundBalance,
        total_jarvis_tokens: data.newJrcBalance
      }))

      setJrcSuccess(data.message)
      setJrcAmount('')

      // Close modal after 2 seconds
      setTimeout(() => {
        setShowJrcModal(false)
        setJrcSuccess('')
      }, 2000)

    } catch (error: any) {
      setJrcError(error.message || 'Failed to purchase JRC coins')
    } finally {
      setJrcPurchasing(false)
    }
  }

  // Render dashboard immediately without loading states
  if (!user) {
    return null
  }

  // Show dashboard with default values while data loads
  if (!profile) {
    return (
      <div className="min-h-screen jarvis-gradient">
        <div className="container mx-auto p-3 sm:p-4 flex items-center justify-center">
          <div className="text-white text-center">
            <h2 className="text-xl font-semibold mb-2">Loading Dashboard...</h2>
            <p className="text-gray-300">Please wait a moment</p>
          </div>
        </div>
      </div>
    )
  }

  const totalInvestment = plans.reduce((sum, plan) => sum + plan.investment_amount, 0)

  return (
    <div className="min-h-screen jarvis-gradient">
      {/* Header */}
      <header className="border-b border-white/20 p-3 sm:p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Image
                src="/logo_300x300.png"
                alt="Stable Wealth Logo"
                width={128}
                height={128}
                className="!h-24 !w-24 sm:!h-32 sm:!w-32"
                style={{ width: '96px', height: '96px' }}
                priority
                quality={75}
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
              />
              <span className="text-lg sm:text-2xl font-bold text-white">Stable Wealth</span>
            </div>
            <div className="flex items-center">
              <Image
                src="/logo_300x300.png"
                alt="Stable Wealth Logo"
                width={64}
                height={64}
                className="!h-12 !w-12 sm:!h-16 sm:!w-16"
                style={{ width: '48px', height: '48px' }}
                unoptimized={process.env.NODE_ENV === 'development'}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="text-white text-right hidden sm:block">
              <p className="text-sm text-gray-300">Welcome back</p>
              <p className="font-semibold">{profile.full_name}</p>
              <p className="text-xs text-blue-300">User ID: {profile.referral_code}</p>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* Social Media Icons */}
              <a
                href="https://youtube.com/@jarvisstaking"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 sm:p-2 text-white hover:bg-red-600/20 hover:text-red-400 rounded-full transition-all duration-300"
                title="Follow us on YouTube"
              >
                <Youtube className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
              <a
                href="https://t.me/+vIW_s8xt3IdmNjg0"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 sm:p-2 text-white hover:bg-blue-500/20 hover:text-blue-400 rounded-full transition-all duration-300"
                title="Follow us on Telegram"
              >
                <Telegram className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
              {/* Existing buttons */}

              <a
                href="mailto:support@jarvisstaking.live"
                className="p-1.5 sm:p-2 text-white hover:bg-white/10 rounded-full"
                title="Email us"
              >
                <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-3 sm:p-4">
        {/* Total Income Card */}
        <div className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white">${profile.main_wallet_balance.toFixed(2)}</h2>
              <p className="text-gray-300 text-sm sm:text-base">Total Income</p>
            </div>
            <div className="text-right hidden sm:block">
              <div className="flex items-center space-x-2">
                <Image
                  src="/logo_300x300.png"
                  alt="Stable Wealth Logo"
                  width={128}
                  height={128}
                  className="!h-24 !w-24 sm:!h-32 sm:!w-32"
                  style={{ width: '96px', height: '96px' }}
                  priority
                  unoptimized={process.env.NODE_ENV === 'development'}
                />
              </div>

            </div>
          </div>
        </div>

        {/* Staking Notice */}
        <div className="bg-blue-600/20 border border-blue-500 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 overflow-hidden">
          <div className="whitespace-nowrap animate-marquee">
            <p className="text-white inline-block">Staking Started from 10 USDT: Earn 5% daily on USDT and JRC. Referral Commission up to 10 Levels</p>
          </div>
        </div>

        {/* Wallet Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
          <div className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm sm:text-base">Main Wallet</h3>
                  <p className="text-gray-300 text-xs sm:text-sm">${profile.main_wallet_balance.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-500 rounded-full flex items-center justify-center">
                  <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm sm:text-base">Fund Wallet</h3>
                  <p className="text-gray-300 text-xs sm:text-sm">${profile.fund_wallet_balance.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Jarvis Tokens Card */}
        <div className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <Coins className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm sm:text-base">Jarvis Coins</h3>
                <p className="text-lg sm:text-2xl font-bold text-yellow-400">{profile.total_jarvis_tokens.toLocaleString()} JRC</p>
                <p className="text-gray-300 text-xs sm:text-sm mb-2">$0.1 per JRC</p>
                <button
                  onClick={() => setShowJrcModal(true)}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 sm:px-4 rounded-full text-xs sm:text-sm font-semibold mt-2 transition-colors"
                >
                  BUY JRC
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Link href="/dashboard/deposit" className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center hover:scale-105 transition-transform">
            <ArrowUpRight className="h-6 w-6 sm:h-8 sm:w-8 text-red-400 mx-auto mb-2" />
            <p className="text-white font-semibold text-xs sm:text-sm">Deposit</p>
          </Link>

          <Link href="/dashboard/invest" className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center hover:scale-105 transition-transform">
            <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-purple-400 mx-auto mb-2" />
            <p className="text-white font-semibold text-xs sm:text-sm">Stake USDT</p>
          </Link>

          <Link href="/dashboard/transfer" className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center hover:scale-105 transition-transform">
            <Send className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400 mx-auto mb-2" />
            <p className="text-white font-semibold text-xs sm:text-sm">Transfer</p>
          </Link>

          <Link href="/dashboard/withdraw" className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center hover:scale-105 transition-transform">
            <ArrowDownLeft className="h-6 w-6 sm:h-8 sm:w-8 text-green-400 mx-auto mb-2" />
            <p className="text-white font-semibold text-xs sm:text-sm">Withdraw</p>
          </Link>

          <Link href="/dashboard/bnx-staking" className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center hover:scale-105 transition-transform">
            <Coins className="h-6 w-6 sm:h-8 sm:w-8 text-orange-400 mx-auto mb-2" />
            <p className="text-white font-semibold text-xs sm:text-sm">JRC Staking</p>
          </Link>

          <Link href="/dashboard/referral" className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center hover:scale-105 transition-transform">
            <Users className="h-6 w-6 sm:h-8 sm:w-8 text-pink-400 mx-auto mb-2" />
            <p className="text-white font-semibold text-xs sm:text-sm">Refer Link</p>
          </Link>

          <a href="/Guide.pdf" target="_blank" rel="noopener noreferrer" className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 text-center hover:scale-105 transition-transform">
            <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-cyan-400 mx-auto mb-2" />
            <p className="text-white font-semibold text-xs sm:text-sm">User Guide</p>
          </a>
        </div>

        {/* Income Tracking */}
        <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">

          <div className="jarvis-card rounded-xl p-3 sm:p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400" />
              <div>
                <p className="text-white font-semibold text-sm sm:text-base">JRC Referral Coin</p>
                <button
                  onClick={() => handleViewIncome('tokens')}
                  className="text-blue-400 text-xs sm:text-sm hover:text-blue-300"
                >
                  VIEW
                </button>
              </div>
            </div>
            <p className="text-white font-bold text-sm sm:text-base">{referralJrcEarned.toLocaleString()} JRC</p>
          </div>



          <div className="jarvis-card rounded-xl p-3 sm:p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
              <div>
                <p className="text-white font-semibold text-sm sm:text-base">Referral Income</p>
                <button
                  onClick={() => handleViewIncome('referral')}
                  className="text-blue-400 text-xs sm:text-sm hover:text-blue-300"
                >
                  VIEW
                </button>
              </div>
            </div>
            <p className="text-white font-bold text-sm sm:text-base">${referralCommissions.toFixed(2)}</p>
          </div>


          <div className="jarvis-card rounded-xl p-3 sm:p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
              <div>
                <p className="text-white font-semibold text-sm sm:text-base">Staking Income</p>
                <button
                  onClick={() => handleViewIncome('staking')}
                  className="text-blue-400 text-xs sm:text-sm hover:text-blue-300"
                >
                  VIEW
                </button>
              </div>
            </div>
            <p className="text-white font-bold text-sm sm:text-base">${stakingIncome.toFixed(2)}</p>
          </div>

          <div className="jarvis-card rounded-xl p-3 sm:p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-orange-400" />
              <div>
                <p className="text-white font-semibold text-sm sm:text-base">Jarvis Staking Reward</p>
                <button
                  onClick={() => handleViewIncome('staking-referral')}
                  className="text-blue-400 text-xs sm:text-sm hover:text-blue-300"
                >
                  VIEW
                </button>
              </div>
            </div>
            <p className="text-white font-bold text-sm sm:text-base">JRC {totalJrcEarned.toFixed(2)}</p>
          </div>
        </div>

        {/* Team & Investment Info */}
        <div className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
          <h3 className="text-white font-bold text-base sm:text-lg mb-3 sm:mb-4">Team & Investment Info</h3>
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <div className="space-y-3 sm:space-y-4">
              <div className="text-center">
                <p className="text-gray-300 text-xs sm:text-sm">My Investment</p>
                <p className="text-lg sm:text-2xl font-bold text-white">${totalInvestment.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-300 text-xs sm:text-sm">My Referrals</p>
                <p className="text-lg sm:text-2xl font-bold text-white">{totalReferrals || 0}</p>
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div className="text-center">
                <p className="text-gray-300 text-xs sm:text-sm">Team Investment</p>
                <p className="text-lg sm:text-2xl font-bold text-white">${(teamInvestment || 0).toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                <div className="text-center">
                  <p className="text-gray-300 text-xs sm:text-sm">Staking Progress</p>
                  <p className="text-lg sm:text-2xl font-bold text-white">${(totalProfits || 0).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-300 text-xs sm:text-sm">Stable Wealth</p>
                  <p className="text-lg sm:text-2xl font-bold text-white">{(totalJrcStaked || 0).toLocaleString()} JRC</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dock Navigation */}
      <DockNavbar onSignOut={handleSignOut} />

      {/* Income Details Modal - Lazy Loaded */}
      <Suspense fallback={null}>
        <IncomeModal
          showIncomeModal={showIncomeModal}
          setShowIncomeModal={setShowIncomeModal}
          selectedIncomeType={selectedIncomeType}
          incomeData={incomeData}
        />
      </Suspense>

      {/* JRC Purchase Modal - Lazy Loaded */}
      <Suspense fallback={null}>
        <JrcPurchaseModal
          showJrcModal={showJrcModal}
          setShowJrcModal={setShowJrcModal}
          jrcAmount={jrcAmount}
          setJrcAmount={setJrcAmount}
          jrcPurchasing={jrcPurchasing}
          jrcError={jrcError}
          jrcSuccess={jrcSuccess}
          handleJrcPurchase={handleJrcPurchase}
        />
      </Suspense>
    </div>
  )
}
