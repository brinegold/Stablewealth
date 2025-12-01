import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { dualReferralService } from '@/lib/referralService'

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



interface DashboardData {
  profile: Profile | null
  plans: InvestmentPlan[]
  totalProfits: number
  referralCommissions: number
  referralUsdtEarned: number
  totalReferrals: number
  teamInvestment: number
}

const initialData: DashboardData = {
  profile: null,
  plans: [],
  totalProfits: 0,
  referralCommissions: 0,
  referralUsdtEarned: 0,
  totalReferrals: 0,
  teamInvestment: 0
}

export function useDashboardData(userId: string | undefined) {
  const [data, setData] = useState<DashboardData>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createSupabaseClient()

  const fetchDashboardData = useCallback(async () => {
    if (!userId) return

    try {
      setLoading(true)
      setError(null)

      // Fetch all data in parallel for better performance
      const [
        profileResult,
        plansResult,
        dualStatsResult
      ] = await Promise.allSettled([
        // Profile data
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),

        // Investment plans
        supabase
          .from('investment_plans')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true),

        // Dual referral stats
        dualReferralService.getReferralStats(userId)
      ])

      const newData: DashboardData = { ...initialData }

      // Process profile data
      if (profileResult.status === 'fulfilled' && profileResult.value.data) {
        newData.profile = profileResult.value.data
      }

      // Process investment plans
      if (plansResult.status === 'fulfilled' && plansResult.value.data) {
        newData.plans = plansResult.value.data
        newData.totalProfits = plansResult.value.data.reduce(
          (sum: number, plan: any) => sum + (plan.total_profit_earned || 0),
          0
        )
      }

      // Process dual referral stats
      if (dualStatsResult.status === 'fulfilled') {
        const dualStats = dualStatsResult.value
        newData.referralUsdtEarned = dualStats.totalUsdtEarned
        newData.totalReferrals = dualStats.totalReferrals
        newData.referralCommissions = dualStats.totalUsdtEarned
      }

      // Fetch team investment data if we have profile
      if (newData.profile?.referral_code) {
        try {
          const { data: directReferrals } = await supabase
            .from('profiles')
            .select('id')
            .eq('sponsor_id', newData.profile.referral_code)

          if (directReferrals && directReferrals.length > 0) {
            const referralIds = directReferrals.map(r => r.id)
            const { data: teamInvestments } = await supabase
              .from('investment_plans')
              .select('investment_amount')
              .in('user_id', referralIds)

            newData.teamInvestment = teamInvestments?.reduce(
              (sum, inv) => sum + inv.investment_amount,
              0
            ) || 0
          }
        } catch (teamError) {
          console.error('Error fetching team investment data:', teamError)
        }
      }

      setData(newData)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setError(error as Error)
    } finally {
      setLoading(false)
    }
  }, [userId, supabase])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const refetch = useCallback(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  return {
    ...data,
    loading,
    error,
    refetch
  }
}
