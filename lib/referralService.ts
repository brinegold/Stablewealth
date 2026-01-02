import { createSupabaseClient } from './supabase'

export interface ReferralCommissionRates {
  level: number
  usdtRate: number // Percentage for USDT commission
}

export interface ReferralTransaction {
  userId: string
  amount: number
  transactionType: 'staking' | 'investment' | 'deposit'
  planType?: string
}

export class ReferralService {
  private supabase = createSupabaseClient()

  // 6-level referral commission structure for USDT staking
  private readonly commissionRates: ReferralCommissionRates[] = [
    { level: 1, usdtRate: 10 },   // Level 1: 10% USDT
    { level: 2, usdtRate: 5 },    // Level 2: 5% USDT
    { level: 3, usdtRate: 3 },    // Level 3: 3% USDT
    { level: 4, usdtRate: 2 },    // Level 4: 2% USDT
    { level: 5, usdtRate: 1 },    // Level 5: 1% USDT
    { level: 6, usdtRate: 0.5 }   // Level 6: 0.5% USDT
  ]

  /**
   * Process referral commissions for a transaction
   */
  async processReferralCommissions(transaction: ReferralTransaction): Promise<void> {
    try {
      // Get user's referral chain
      const referralChain = await this.getReferralChain(transaction.userId)

      if (referralChain.length === 0) {
        return
      }

      // Process commissions for each level
      for (let i = 0; i < referralChain.length && i < this.commissionRates.length; i++) {
        const referrer = referralChain[i]
        const rates = this.commissionRates[i]

        await this.payCommission(
          referrer.id,
          transaction.userId,
          transaction.amount,
          rates,
          transaction.transactionType,
          transaction.planType
        )
      }
    } catch (error) {
      console.error('Error processing referral commissions:', error)
      throw error
    }
  }

  /**
   * Get the referral chain for a user (up to 4 levels)
   */
  private async getReferralChain(userId: string): Promise<any[]> {
    const chain: any[] = []
    let currentUserId = userId

    for (let level = 1; level <= 6; level++) {
      // Find who referred this user (using sponsor_id which contains the referrer's referral_code)
      const { data: referralData, error } = await this.supabase
        .from('profiles')
        .select('sponsor_id')
        .eq('id', currentUserId)
        .single()

      if (error || !referralData?.sponsor_id) {
        break
      }

      // Get referrer details by matching referral_code with sponsor_id
      const { data: referrer, error: referrerError } = await this.supabase
        .from('profiles')
        .select('id, full_name, referral_code, main_wallet_balance')
        .eq('referral_code', referralData.sponsor_id)
        .single()

      if (referrerError || !referrer) {
        break
      }

      chain.push({
        ...referrer,
        level
      })

      currentUserId = referrer.id
    }

    return chain
  }

  /**
   * Pay commission (USDT) to a referrer
   */
  private async payCommission(
    referrerId: string,
    referredUserId: string,
    transactionAmount: number,
    rates: ReferralCommissionRates,
    transactionType: string,
    planType?: string
  ): Promise<void> {
    try {
      // Calculate commission
      const usdtCommission = (transactionAmount * rates.usdtRate) / 100

      // Get current referrer balance
      const { data: referrer, error: referrerError } = await this.supabase
        .from('profiles')
        .select('main_wallet_balance')
        .eq('id', referrerId)
        .single()

      if (referrerError || !referrer) {
        throw new Error(`Failed to get referrer data: ${referrerError?.message}`)
      }

      // Update referrer balance
      const newUsdtBalance = referrer.main_wallet_balance + usdtCommission

      const { error: updateError } = await this.supabase
        .from('profiles')
        .update({
          main_wallet_balance: newUsdtBalance
        })
        .eq('id', referrerId)

      if (updateError) {
        throw new Error(`Failed to update referrer balance: ${updateError.message}`)
      }

      // Create USDT commission transaction
      await this.createCommissionTransaction(
        referrerId,
        referredUserId,
        usdtCommission,
        'USDT',
        rates.level,
        transactionType,
        planType
      )

      // Create referral commission record
      await this.createReferralCommissionRecord(
        referrerId,
        referredUserId,
        usdtCommission,
        rates.level,
        transactionType,
        planType,
        null // transaction_id - we'll handle this in the function
      )

    } catch (error) {
      console.error(`Error paying commission to ${referrerId}:`, error)
      throw error
    }
  }

  /**
   * Create a commission transaction record
   */
  private async createCommissionTransaction(
    referrerId: string,
    referredUserId: string,
    amount: number,
    currency: 'USDT',
    level: number,
    transactionType: string,
    planType?: string
  ): Promise<void> {
    const description = `Level ${level} ${currency} referral commission from ${transactionType}${planType ? ` (${planType})` : ''}`

    const { error } = await this.supabase
      .from('transactions')
      .insert({
        user_id: referrerId,
        transaction_type: 'referral_bonus',
        amount: amount,
        net_amount: amount,
        status: 'completed',
        description: description,
        created_at: new Date().toISOString()
      })

    if (error) {
      throw new Error(`Failed to create ${currency} commission transaction: ${error.message}`)
    }
  }

  /**
   * Create a referral commission record for tracking
   */
  private async createReferralCommissionRecord(
    referrerId: string,
    referredUserId: string,
    usdtAmount: number,
    level: number,
    transactionType: string,
    planType?: string,
    transactionId?: string | null
  ): Promise<void> {
    try {
      // Insert commission record
      const { error: insertError } = await this.supabase
        .from('referral_commissions')
        .insert({
          referrer_id: referrerId,
          referred_id: referredUserId,
          commission_amount: usdtAmount,
          commission_percentage: this.commissionRates[level - 1]?.usdtRate || 0,
          level: level,
          created_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('Failed to create referral commission record:', insertError)
        throw insertError
      }
    } catch (error) {
      console.error('Error in createReferralCommissionRecord:', error)
      throw error
    }
  }

  /**
   * Get direct referrals for a user
   */
  private async getDirectReferrals(userId: string): Promise<any[]> {
    // First get the user's referral code
    const { data: userProfile, error: userError } = await this.supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .single()

    if (userError || !userProfile?.referral_code) {
      console.error('Error fetching user referral code:', userError)
      return []
    }

    // Then find all users who have this referral code as their sponsor_id
    const { data: referrals, error } = await this.supabase
      .from('profiles')
      .select('id, full_name, referral_code')
      .eq('sponsor_id', userProfile.referral_code)

    if (error) {
      console.error('Error fetching direct referrals:', error)
      return []
    }

    return referrals || []
  }

  /**
   * Count referrals at a specific level
   */
  private async countReferralsAtLevel(userId: string, targetLevel: number): Promise<number> {
    if (targetLevel === 1) {
      const directReferrals = await this.getDirectReferrals(userId)
      return directReferrals.length
    }

    // For deeper levels, we need to recursively count
    // Get user's referral code first
    const { data: userProfile, error: userError } = await this.supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', userId)
      .single()

    if (userError || !userProfile?.referral_code) {
      return 0
    }

    // Count referrals at the target level using recursive SQL
    // This counts users who are exactly 'targetLevel' levels deep in the referral chain
    let count = 0
    const directReferrals = await this.getDirectReferrals(userId)

    if (targetLevel === 2) {
      // Count level 2: referrals of direct referrals
      for (const referral of directReferrals) {
        const level2Count = await this.getDirectReferrals(referral.id)
        count += level2Count.length
      }
    } else {
      // For levels 3+, we can use the commission records to count actual referrals
      // since commissions are only created when there are actual referrals
      const { data: commissions } = await this.supabase
        .from('referral_commissions')
        .select('referred_id')
        .eq('referrer_id', userId)
        .eq('level', targetLevel)

      // Count unique referred users at this level
      const uniqueReferrals = new Set(commissions?.map(c => c.referred_id) || [])
      count = uniqueReferrals.size
    }

    return count
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: string): Promise<{
    totalUsdtEarned: number
    totalReferrals: number
    levelStats: Array<{
      level: number
      count: number
      usdtEarned: number
      usdtRate: number
    }>
  }> {
    try {
      // Get all referral commissions for this user
      const { data: commissions, error } = await this.supabase
        .from('referral_commissions')
        .select('*')
        .eq('referrer_id', userId)

      if (error) {
        throw new Error(`Failed to get referral stats: ${error.message}`)
      }

      // Calculate total USDT earned
      const totalUsdtEarned = commissions?.reduce((sum, c) => {
        return sum + (c.commission_amount || 0)
      }, 0) || 0

      // Get actual referral counts by level
      const referralChain = await this.getReferralChain(userId)
      const directReferrals = await this.getDirectReferrals(userId)

      // Calculate level statistics with actual referral counts
      const levelStats = await Promise.all(this.commissionRates.map(async (rate) => {
        const levelCommissions = commissions?.filter(c => c.level === rate.level) || []

        // Count actual referrals at this level
        let referralCount = 0
        if (rate.level === 1) {
          referralCount = directReferrals.length
        } else {
          // For deeper levels, we need to count referrals at that depth
          referralCount = await this.countReferralsAtLevel(userId, rate.level)
        }

        return {
          level: rate.level,
          count: referralCount,
          usdtEarned: levelCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0),
          usdtRate: rate.usdtRate
        }
      }))

      // Get total referrals across all levels (unique referred_ids from commissions)
      const uniqueReferredUsers = new Set(commissions?.map(c => c.referred_id) || [])

      return {
        totalUsdtEarned,
        totalReferrals: uniqueReferredUsers.size,
        levelStats
      }
    } catch (error) {
      console.error('Error getting referral stats:', error)
      throw error
    }
  }
}

// Export singleton instance
export const referralService = new ReferralService()
