import { createSupabaseClient } from './supabase'

export interface ReferralCommissionRates {
  level: number
  usdtRate: number // Percentage for USDT commission
  jrcRate: number  // Percentage for JRC coin commission
}

export interface ReferralTransaction {
  userId: string
  amount: number
  jrcEarned?: number // JRC coins earned by the user (for calculating JRC commission)
  transactionType: 'staking' | 'investment' | 'deposit'
  planType?: string
}

export class DualReferralService {
  private supabase = createSupabaseClient()

  // 6-level referral commission structure for USDT staking
  private readonly commissionRates: ReferralCommissionRates[] = [
    { level: 1, usdtRate: 10, jrcRate: 0 },   // Level 1: 10% USDT
    { level: 2, usdtRate: 5, jrcRate: 0 },    // Level 2: 5% USDT
    { level: 3, usdtRate: 3, jrcRate: 0 },    // Level 3: 3% USDT
    { level: 4, usdtRate: 2, jrcRate: 0 },    // Level 4: 2% USDT
    { level: 5, usdtRate: 1, jrcRate: 0 },    // Level 5: 1% USDT
    { level: 6, usdtRate: 0.5, jrcRate: 0 }   // Level 6: 0.5% USDT
  ]

  /**
   * Process dual referral commissions for a transaction
   */
  async processDualReferralCommissions(transaction: ReferralTransaction): Promise<void> {
    try {
      console.log(`Processing dual referral commissions for user ${transaction.userId}, amount: ${transaction.amount}`)

      // Get user's referral chain
      const referralChain = await this.getReferralChain(transaction.userId)

      if (referralChain.length === 0) {
        console.log(`No referral chain found for user ${transaction.userId}`)
        return
      }

      // Process commissions for each level
      for (let i = 0; i < referralChain.length && i < this.commissionRates.length; i++) {
        const referrer = referralChain[i]
        const rates = this.commissionRates[i]

        await this.payDualCommission(
          referrer.id,
          transaction.userId,
          transaction.amount,
          transaction.jrcEarned || 0,
          rates,
          transaction.transactionType,
          transaction.planType
        )
      }
    } catch (error) {
      console.error('Error processing dual referral commissions:', error)
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
        .select('id, full_name, referral_code, main_wallet_balance, total_jarvis_tokens')
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
   * Pay dual commission (USDT + JRC) to a referrer
   */
  private async payDualCommission(
    referrerId: string,
    referredUserId: string,
    transactionAmount: number,
    jrcEarned: number,
    rates: ReferralCommissionRates,
    transactionType: string,
    planType?: string
  ): Promise<void> {
    try {
      // Calculate commissions
      const usdtCommission = (transactionAmount * rates.usdtRate) / 100
      const jrcCommission = (jrcEarned * rates.jrcRate) / 100 // JRC coins based on actual JRC earned

      console.log(`🧮 Commission Calculation for Level ${rates.level}:`)
      console.log(`   Transaction Amount: $${transactionAmount}`)
      console.log(`   JRC Earned: ${jrcEarned}`)
      console.log(`   USDT Rate: ${rates.usdtRate}%`)
      console.log(`   JRC Rate: ${rates.jrcRate}%`)
      console.log(`   USDT Commission: $${usdtCommission}`)
      console.log(`   JRC Commission: ${jrcCommission} JRC`)
      console.log(`   Paying to referrer: ${referrerId}`)

      // Get current referrer balances
      const { data: referrer, error: referrerError } = await this.supabase
        .from('profiles')
        .select('main_wallet_balance, total_jarvis_tokens')
        .eq('id', referrerId)
        .single()

      if (referrerError || !referrer) {
        throw new Error(`Failed to get referrer data: ${referrerError?.message}`)
      }

      // Update referrer balances
      const newUsdtBalance = referrer.main_wallet_balance + usdtCommission
      const newJrcBalance = referrer.total_jarvis_tokens + jrcCommission

      const { error: updateError } = await this.supabase
        .from('profiles')
        .update({
          main_wallet_balance: newUsdtBalance,
          total_jarvis_tokens: newJrcBalance
        })
        .eq('id', referrerId)

      if (updateError) {
        throw new Error(`Failed to update referrer balances: ${updateError.message}`)
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

      // Create JRC commission transaction
      await this.createCommissionTransaction(
        referrerId,
        referredUserId,
        jrcCommission,
        'JRC',
        rates.level,
        transactionType,
        planType
      )

      // Create referral commission record (we'll create one record for USDT, JRC info will be in additional columns)
      await this.createReferralCommissionRecord(
        referrerId,
        referredUserId,
        usdtCommission,
        jrcCommission,
        rates.level,
        transactionType,
        planType,
        null // transaction_id - we'll handle this in the function
      )

    } catch (error) {
      console.error(`Error paying dual commission to ${referrerId}:`, error)
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
    currency: 'USDT' | 'JRC',
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
    jrcAmount: number,
    level: number,
    transactionType: string,
    planType?: string,
    transactionId?: string | null
  ): Promise<void> {
    try {
      console.log(`💾 Saving referral commission: Level ${level}, USDT: ${usdtAmount}, JRC: ${jrcAmount}`)

      // Insert with dual commission format
      const { error: insertError } = await this.supabase
        .from('referral_commissions')
        .insert({
          referrer_id: referrerId,
          referred_id: referredUserId,
          transaction_id: transactionId, // May be null
          commission_amount: usdtAmount, // Legacy field for backward compatibility
          usdt_commission: usdtAmount,
          jrc_commission: jrcAmount,
          level: level,
          commission_percentage: this.commissionRates[level - 1]?.usdtRate || 0,
          jrc_percentage: this.commissionRates[level - 1]?.jrcRate || 0,
          transaction_type: transactionType,
          plan_type: planType || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('❌ Failed to create referral commission record:', insertError)
        throw insertError // Throw error to see what's wrong
      } else {
        console.log('✅ Referral commission saved successfully with dual format')
        console.log(`📊 Saved: ${usdtAmount} USDT + ${jrcAmount} JRC for Level ${level}`)
      }
    } catch (error) {
      console.error('💥 Error in createReferralCommissionRecord:', error)
      // Don't throw error here as the main commission payment succeeded, but log it clearly
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
    totalJrcEarned: number
    totalReferrals: number
    levelStats: Array<{
      level: number
      count: number
      usdtEarned: number
      jrcEarned: number
      usdtRate: number
      jrcRate: number
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

      // Handle both old and new commission formats
      const totalUsdtEarned = commissions?.reduce((sum, c) => {
        return sum + (c.usdt_commission || c.commission_amount || 0)
      }, 0) || 0
      const totalJrcEarned = commissions?.reduce((sum, c) => sum + (c.jrc_commission || 0), 0) || 0

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
          usdtEarned: levelCommissions.reduce((sum, c) => sum + (c.usdt_commission || c.commission_amount || 0), 0),
          jrcEarned: levelCommissions.reduce((sum, c) => sum + (c.jrc_commission || 0), 0),
          usdtRate: rate.usdtRate,
          jrcRate: rate.jrcRate
        }
      }))

      // Get total referrals using the direct referrals method
      const allReferrals = await this.getDirectReferrals(userId)

      return {
        totalUsdtEarned,
        totalJrcEarned,
        totalReferrals: allReferrals?.length || 0,
        levelStats
      }
    } catch (error) {
      console.error('Error getting referral stats:', error)
      throw error
    }
  }
}

// Export singleton instance
export const dualReferralService = new DualReferralService()
