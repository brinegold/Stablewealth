import { createSupabaseClient } from './supabase'

export interface ReferralCommissionRates {
  level: number
  usdtRate: number
}

export interface OptimizedReferralStats {
  totalUsdtEarned: number
  totalReferrals: number
  levelStats: Array<{
    level: number
    count: number
    usdtEarned: number
    usdtRate: number
  }>
}

export class OptimizedReferralService {
  private supabase = createSupabaseClient()

  private readonly commissionRates: ReferralCommissionRates[] = [
    { level: 1, usdtRate: 5 },
    { level: 2, usdtRate: 3 },
    { level: 3, usdtRate: 2 },
    { level: 4, usdtRate: 1 }
  ]

  /**
   * Get optimized referral statistics using minimal database queries
   */
  async getReferralStats(userId: string): Promise<OptimizedReferralStats> {
    try {
      console.log('🚀 Starting optimized referral stats fetch for user:', userId)

      // Single query to get all referral commissions with aggregation
      const { data: commissions, error: commissionsError } = await this.supabase
        .from('referral_commissions')
        .select('level, usdt_commission, ton_commission, commission_amount, referred_id')
        .eq('referrer_id', userId)

      if (commissionsError) {
        console.error('❌ Error fetching commissions:', commissionsError)
        throw commissionsError
      }

      // Single query to get user's referral code and direct referrals count
      const [userProfile, directReferralsCount] = await Promise.all([
        this.supabase
          .from('profiles')
          .select('referral_code')
          .eq('id', userId)
          .single(),
        this.supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('sponsor_id', (await this.supabase
            .from('profiles')
            .select('referral_code')
            .eq('id', userId)
            .single()).data?.referral_code || '')
      ])

      if (userProfile.error) {
        console.error('❌ Error fetching user profile:', userProfile.error)
        throw userProfile.error
      }

      // Calculate total USDT earned
      const totalUsdtEarned = commissions?.reduce((sum, c) => {
        return sum + (c.usdt_commission || c.commission_amount || 0)
      }, 0) || 0

      // Group commissions by level for efficient processing
      const commissionsByLevel = new Map<number, any[]>()
      const referralCountsByLevel = new Map<number, Set<string>>()

      commissions?.forEach(commission => {
        const level = commission.level

        // Group commissions
        if (!commissionsByLevel.has(level)) {
          commissionsByLevel.set(level, [])
        }
        commissionsByLevel.get(level)!.push(commission)

        // Count unique referrals per level
        if (!referralCountsByLevel.has(level)) {
          referralCountsByLevel.set(level, new Set())
        }
        referralCountsByLevel.get(level)!.add(commission.referred_id)
      })

      // Build level statistics efficiently
      const levelStats = this.commissionRates.map(rate => {
        const levelCommissions = commissionsByLevel.get(rate.level) || []
        const uniqueReferrals = referralCountsByLevel.get(rate.level) || new Set()

        return {
          level: rate.level,
          count: rate.level === 1 ? (directReferralsCount.count || 0) : uniqueReferrals.size,
          usdtEarned: levelCommissions.reduce((sum, c) => sum + (c.usdt_commission || c.commission_amount || 0), 0),
          usdtRate: rate.usdtRate
        }
      })

      const result = {
        totalUsdtEarned,
        totalReferrals: directReferralsCount.count || 0,
        levelStats
      }

      console.log('✅ Optimized referral stats completed in single batch:', result)
      return result

    } catch (error) {
      console.error('💥 Error in optimized referral stats:', error)
      throw error
    }
  }

  /**
   * Get referral chain efficiently using a single recursive query
   */
  async getReferralChainOptimized(userId: string): Promise<any[]> {
    try {
      // Use a recursive CTE (Common Table Expression) to get the entire chain in one query
      const { data, error } = await this.supabase.rpc('get_referral_chain_recursive', {
        start_user_id: userId,
        max_levels: 4
      })

      if (error) {
        console.warn('Recursive query not available, falling back to optimized iterative method')
        return this.getReferralChainIterative(userId)
      }

      return data || []
    } catch (error) {
      console.warn('Error in recursive query, using fallback:', error)
      return this.getReferralChainIterative(userId)
    }
  }

  /**
   * Fallback method: Get referral chain with batched queries
   */
  private async getReferralChainIterative(userId: string): Promise<any[]> {
    const chain: any[] = []
    const userIds = [userId]

    // Batch query to get all sponsor relationships
    const { data: allProfiles, error } = await this.supabase
      .from('profiles')
      .select('id, sponsor_id, referral_code, full_name, main_wallet_balance')

    if (error || !allProfiles) {
      console.error('Error fetching profiles for referral chain:', error)
      return []
    }

    // Create lookup maps for efficient processing
    const profileById = new Map(allProfiles.map(p => [p.id, p]))
    const profileByReferralCode = new Map(allProfiles.map(p => [p.referral_code, p]))

    let currentUserId = userId
    let level = 1

    while (level <= 4) {
      const currentProfile = profileById.get(currentUserId)
      if (!currentProfile?.sponsor_id) break

      const referrer = profileByReferralCode.get(currentProfile.sponsor_id)
      if (!referrer) break

      chain.push({
        ...referrer,
        level
      })

      currentUserId = referrer.id
      level++
    }

    return chain
  }

  /**
   * Get direct referrals count efficiently
   */
  async getDirectReferralsCount(userId: string): Promise<number> {
    try {
      // Get user's referral code first
      const { data: userProfile, error: userError } = await this.supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', userId)
        .single()

      if (userError || !userProfile?.referral_code) {
        return 0
      }

      // Count referrals efficiently
      const { count, error } = await this.supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('sponsor_id', userProfile.referral_code)

      if (error) {
        console.error('Error counting direct referrals:', error)
        return 0
      }

      return count || 0
    } catch (error) {
      console.error('Error in getDirectReferralsCount:', error)
      return 0
    }
  }
}

// Export singleton instance
export const optimizedReferralService = new OptimizedReferralService()
