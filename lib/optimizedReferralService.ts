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
    { level: 1, usdtRate: 10 },
    { level: 2, usdtRate: 5 },
    { level: 3, usdtRate: 3 },
    { level: 4, usdtRate: 2 },
    { level: 5, usdtRate: 1 },
    { level: 6, usdtRate: 0.5 }
  ]

  /**
   * Get optimized referral statistics using minimal database queries
   */
  async getReferralStats(userId: string): Promise<OptimizedReferralStats> {
    try {
      console.log('🚀 Starting optimized referral stats fetch for user:', userId)

      // Get user's referral code first
      const { data: userProfile, error: profileError } = await this.supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', userId)
        .single()

      if (profileError || !userProfile?.referral_code) {
        console.error('❌ Error fetching user profile:', profileError)
        return {
          totalUsdtEarned: 0,
          totalReferrals: 0,
          levelStats: this.commissionRates.map(rate => ({
            level: rate.level,
            count: 0,
            usdtEarned: 0,
            usdtRate: rate.usdtRate
          }))
        }
      }

      // Fetch all referral commissions
      const { data: commissions, error: commissionsError } = await this.supabase
        .from('referral_commissions')
        .select('level, commission_amount, referred_id')
        .eq('referrer_id', userId)

      if (commissionsError) {
        console.error('❌ Error fetching commissions:', commissionsError)
        throw commissionsError
      }

      // Calculate total USDT earned
      const totalUsdtEarned = commissions?.reduce((sum, c) => {
        return sum + (c.commission_amount || 0)
      }, 0) || 0

      // Count ALL referrals recursively across all levels
      const totalReferrals = await this.countAllReferralsRecursive(userProfile.referral_code)

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
          count: uniqueReferrals.size,
          usdtEarned: levelCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0),
          usdtRate: rate.usdtRate
        }
      })

      const result = {
        totalUsdtEarned,
        totalReferrals,
        levelStats
      }

      console.log('✅ Optimized referral stats completed:', result)
      return result

    } catch (error) {
      console.error('💥 Error in optimized referral stats:', error)
      throw error
    }
  }

  /**
   * Recursively count all referrals across all levels
   */
  private async countAllReferralsRecursive(referralCode: string, depth: number = 0, maxDepth: number = 6): Promise<number> {
    if (depth >= maxDepth) {
      return 0
    }

    // Get direct referrals
    const { data: directReferrals, error } = await this.supabase
      .from('profiles')
      .select('referral_code')
      .eq('sponsor_id', referralCode)

    if (error || !directReferrals || directReferrals.length === 0) {
      return 0
    }

    let totalCount = directReferrals.length

    // Recursively count referrals of each direct referral
    for (const referral of directReferrals) {
      if (referral.referral_code) {
        totalCount += await this.countAllReferralsRecursive(referral.referral_code, depth + 1, maxDepth)
      }
    }

    return totalCount
  }

  /**
   * Get referral chain efficiently using a single recursive query
   */
  async getReferralChainOptimized(userId: string): Promise<any[]> {
    try {
      // Use a recursive CTE (Common Table Expression) to get the entire chain in one query
      const { data, error } = await this.supabase.rpc('get_referral_chain_recursive', {
        start_user_id: userId,
        max_levels: 6
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
      .select('id, sponsor_id, referral_code, full_name, main_wallet_balance, created_at')

    if (error || !allProfiles) {
      console.error('Error fetching profiles for referral chain:', error)
      return []
    }

    // Create lookup maps for efficient processing
    const profileById = new Map(allProfiles.map(p => [p.id, p]))
    const profileByReferralCode = new Map(allProfiles.map(p => [p.referral_code, p]))

    let currentUserId = userId
    let level = 1

    while (level <= 6) {
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
