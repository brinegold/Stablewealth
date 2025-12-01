import { supabaseAdmin } from './supabase-server'

export async function distributeProfits() {
  try {
    console.log('Starting profit distribution...')

    // Distribute regular investment profits
    await distributeInvestmentProfits()

  } catch (error) {
    console.error('Error in profit distribution:', error)
  }
}

// Function to distribute regular investment profits
async function distributeInvestmentProfits() {
  try {
    console.log('Starting regular investment profit distribution...')

    // Get all active investment plans
    const { data: plans, error: plansError } = await supabaseAdmin
      .from('investment_plans')
      .select(`
        id,
        user_id,
        plan_type,
        investment_amount,
        daily_percentage,
        created_at,
        profiles!inner(id)
      `)
      .eq('is_active', true)

    if (plansError) {
      console.error('Error fetching plans:', plansError)
      return
    }

    if (!plans || plans.length === 0) {
      console.log('No active investment plans found')
      return
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const profitDistributions = []
    const userUpdates = new Map()

    for (const plan of plans) {
      const planCreatedAt = new Date(plan.created_at)

      // Calculate the next distribution date (24 hours after creation, then daily)
      const creationDate = new Date(planCreatedAt.getTime())
      creationDate.setUTCHours(0, 0, 0, 0) // Normalize to start of day

      // First distribution should be 24 hours (1 day) after creation
      const firstDistributionDate = new Date(creationDate.getTime() + 24 * 60 * 60 * 1000)
      const firstDistributionDateStr = firstDistributionDate.toISOString().split('T')[0]

      // Check if we've reached the first distribution date
      if (today < firstDistributionDateStr) {
        const hoursUntilFirst = (firstDistributionDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        console.log(`Plan ${plan.id} needs to wait ${hoursUntilFirst.toFixed(2)} more hours for first distribution`)
        continue
      }

      // Check if profit already distributed for today
      const { data: existingDistribution } = await supabaseAdmin
        .from('profit_distributions')
        .select('id')
        .eq('plan_id', plan.id)
        .eq('distribution_date', today)

      if (existingDistribution && existingDistribution.length > 0) {
        console.log(`Profit already distributed today for plan ${plan.id}`)
        continue
      }

      // Get the last distribution date for this plan
      const { data: lastDistribution } = await supabaseAdmin
        .from('profit_distributions')
        .select('distribution_date')
        .eq('plan_id', plan.id)
        .order('distribution_date', { ascending: false })
        .limit(1)

      let nextDistributionDate: Date

      if (lastDistribution && lastDistribution.length > 0) {
        // Next distribution is the day after the last distribution
        const lastDistDate = new Date(lastDistribution[0].distribution_date + 'T00:00:00.000Z')
        nextDistributionDate = new Date(lastDistDate.getTime() + 24 * 60 * 60 * 1000)
      } else {
        // This is the first distribution
        nextDistributionDate = firstDistributionDate
      }

      const nextDistributionDateStr = nextDistributionDate.toISOString().split('T')[0]

      // Only distribute if today is the next distribution date or later
      if (today >= nextDistributionDateStr) {
        // Calculate daily profit
        const dailyProfitRate = plan.daily_percentage / 100
        const profitAmount = plan.investment_amount * dailyProfitRate

        // Add to profit distributions (distribute for today)
        profitDistributions.push({
          plan_id: plan.id,
          user_id: plan.user_id,
          profit_amount: profitAmount,
          distribution_date: today
        })

        // Accumulate user updates
        if (userUpdates.has(plan.user_id)) {
          userUpdates.set(plan.user_id, userUpdates.get(plan.user_id) + profitAmount)
        } else {
          userUpdates.set(plan.user_id, profitAmount)
        }

        console.log(`Queued profit distribution for plan ${plan.id} on ${today} at ${new Date().toLocaleTimeString()}: $${profitAmount.toFixed(8)}`)
      } else {
        console.log(`Plan ${plan.id} next distribution date is ${nextDistributionDateStr}, today is ${today}`)
      }
    }

    if (profitDistributions.length === 0) {
      console.log('No new profits to distribute')
      return
    }

    // Insert profit distributions
    const { error: distributionError } = await supabaseAdmin
      .from('profit_distributions')
      .insert(profitDistributions)

    if (distributionError) {
      console.error('Error inserting profit distributions:', distributionError)
      return
    }

    // Update user balances and plan totals
    for (const [userId, totalProfit] of Array.from(userUpdates.entries())) {
      // Get current balance first
      const { data: currentProfile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('main_wallet_balance')
        .eq('id', userId)
        .single()

      if (fetchError) {
        console.error(`Error fetching profile for user ${userId}:`, fetchError)
        continue
      }

      // Update user main wallet balance
      const { error: walletError } = await supabaseAdmin
        .from('profiles')
        .update({
          main_wallet_balance: (currentProfile.main_wallet_balance || 0) + totalProfit
        })
        .eq('id', userId)

      if (walletError) {
        console.error(`Error updating wallet for user ${userId}:`, walletError)
        continue
      }

      // Create profit transaction
      const { error: transactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: userId,
          transaction_type: 'profit',
          amount: totalProfit,
          net_amount: totalProfit,
          status: 'completed',
          description: 'Daily profit distribution'
        })

      if (transactionError) {
        console.error(`Error creating transaction for user ${userId}:`, transactionError)
      }

      console.log(`Updated wallet for user ${userId}: +$${totalProfit.toFixed(8)}`)
    }

    // Update investment plans total profit earned
    for (const distribution of profitDistributions) {
      // Get current total profit earned first
      const { data: currentPlan, error: fetchPlanError } = await supabaseAdmin
        .from('investment_plans')
        .select('total_profit_earned')
        .eq('id', distribution.plan_id)
        .single()

      if (fetchPlanError) {
        console.error(`Error fetching plan ${distribution.plan_id}:`, fetchPlanError)
        continue
      }

      const { error: planUpdateError } = await supabaseAdmin
        .from('investment_plans')
        .update({
          total_profit_earned: (currentPlan.total_profit_earned || 0) + distribution.profit_amount
        })
        .eq('id', distribution.plan_id)

      if (planUpdateError) {
        console.error(`Error updating plan ${distribution.plan_id}:`, planUpdateError)
      }
    }

    console.log(`Successfully distributed investment profits to ${userUpdates.size} users`)
    console.log(`Total investment distributions: ${profitDistributions.length}`)

  } catch (error) {
    console.error('Error in investment profit distribution:', error)
  }
}

// Profit distribution is now handled via:
// 1. External cron jobs calling /api/auto-profit-distribution
// 2. Manual admin button calling triggerProfitDistribution()

// Manual trigger function for testing
export async function triggerProfitDistribution() {
  console.log('Manually triggering daily profit distribution...')
  await distributeProfits()
}

// Manual trigger for investment profits only
export async function triggerInvestmentProfitDistribution() {
  console.log('Manually triggering investment profit distribution...')
  await distributeInvestmentProfits()
}
