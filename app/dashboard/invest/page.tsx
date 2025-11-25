'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, TrendingUp, Star, Shield, Coins } from 'lucide-react'
import Link from 'next/link'
import { dualReferralService } from '@/lib/referralService'

interface Profile {
  fund_wallet_balance: number
}

export default function InvestPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<'A' | null>(null)
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createSupabaseClient()

  const plans = {
    A: {
      name: 'USDT Staking',
      minAmount: 10,
      maxAmount: 50000,
      dailyPercentage: 3,
      tokensPerDollar: 100, // 1000 tokens for $10 minimum
      icon: TrendingUp,
      color: 'from-green-400 to-blue-500'
    }
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('fund_wallet_balance')
        .eq('id', user?.id)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const handleInvest = async () => {
    if (!selectedPlan || !amount) return

    setIsSubmitting(true)
    setError('')
    setSuccess('')

    const investAmount = parseFloat(amount)
    const plan = plans[selectedPlan]

    // Validation
    if (investAmount < plan.minAmount || investAmount > plan.maxAmount) {
      setError(`Investment amount must be between $${plan.minAmount} and $${plan.maxAmount}`)
      setIsSubmitting(false)
      return
    }

    if (!profile || investAmount > profile.fund_wallet_balance) {
      setError('Insufficient fund wallet balance')
      setIsSubmitting(false)
      return
    }

    try {
      // Calculate coins earned - 100 JRC per $10 invested
      const coinsEarned = Math.floor(investAmount / 10) * 100

      // Create investment plan
      const { data: investmentPlan, error: planError } = await supabase
        .from('investment_plans')
        .insert({
          user_id: user?.id,
          plan_type: selectedPlan,
          investment_amount: investAmount,
          daily_percentage: plan.dailyPercentage,
          jarvis_tokens_earned: coinsEarned,
        })
        .select()
        .single()

      if (planError) throw planError

      // Get current profile data first
      const { data: currentProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('total_jarvis_tokens')
        .eq('id', user?.id)
        .single()

      if (fetchError) throw fetchError

      // Deduct from fund wallet and add tokens
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          fund_wallet_balance: profile.fund_wallet_balance - investAmount,
          total_jarvis_tokens: (currentProfile.total_jarvis_tokens || 0) + coinsEarned
        })
        .eq('id', user?.id)

      if (updateError) throw updateError

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user?.id,
          transaction_type: 'investment',
          amount: investAmount,
          net_amount: investAmount,
          status: 'completed',
          plan_id: investmentPlan.id,
          description: `Investment in ${plan.name}`
        })

      if (transactionError) throw transactionError

      // Process dual referral commissions (USDT + JRC)
      try {
        await dualReferralService.processDualReferralCommissions({
          userId: user?.id || '',
          amount: investAmount,
          jrcEarned: coinsEarned,
          transactionType: 'investment',
          planType: plan.name
        })
        console.log('Dual referral commissions processed successfully')
      } catch (referralError) {
        console.error('Error processing referral commissions:', referralError)
        // Don't fail the investment if referral processing fails
      }

      setSuccess(`Successfully invested $${investAmount} in ${plan.name}! You earned ${coinsEarned.toLocaleString()} Ton Coins.`)
      setAmount('')
      setSelectedPlan(null)

      // Redirect after success
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)

    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen jarvis-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
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
          <h1 className="text-xl font-bold text-white">User Invest</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-md">
        {/* Available Balance */}
        <div className="jarvis-card rounded-2xl p-6 mb-6 text-center">
          <h2 className="text-white text-lg mb-2">Available Fund Wallet</h2>
          <p className="text-3xl font-bold text-green-400">${profile?.fund_wallet_balance.toFixed(2) || '0.00'}</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        {/* Investment Plans */}
        <div className="space-y-4 mb-6">
          {Object.entries(plans).map(([key, plan]) => {
            const Icon = plan.icon
            const isSelected = selectedPlan === key

            return (
              <div
                key={key}
                onClick={() => setSelectedPlan(key as 'A')}
                className={`jarvis-card rounded-2xl p-6 cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-400 bg-white/20' : 'hover:bg-white/10'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 bg-gradient-to-r ${plan.color} rounded-full flex items-center justify-center`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">{plan.name}</h3>
                      <p className="text-gray-300">${plan.minAmount} to ${plan.maxAmount.toLocaleString()}</p>
                      <p className="text-green-400 font-semibold">{plan.dailyPercentage}% Daily</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold">
                      100 TON per $10
                    </p>
                    <p className="text-gray-400 text-sm">Coins</p>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-white/20">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={`Enter amount ($${plan.minAmount} - $${plan.maxAmount.toLocaleString()})`}
                      min={plan.minAmount}
                      max={plan.maxAmount}
                      step="0.01"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Token Information */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center">
            <Coins className="h-6 w-6 mr-2 text-yellow-400" />
            Ton Coin Information
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Current Price:</span>
              <span className="text-white font-semibold">$0.1 per TON</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Future Listing:</span>
              <span className="text-green-400 font-semibold">$3.0 per TON</span>
            </div>
            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg p-3 mt-4">
              <p className="text-center text-white text-sm">
                🚀 <strong>Potential 30x Growth!</strong> Secure your coins now at discounted price.
              </p>
            </div>
          </div>
        </div>

        {/* Investment Button */}
        {selectedPlan && amount && (
          <button
            onClick={handleInvest}
            disabled={isSubmitting}
            className="w-full jarvis-button py-4 rounded-lg text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Processing Investment...' : `Invest in ${plans[selectedPlan].name}`}
          </button>
        )}

        {/* Investment History */}
        <Link
          href="/dashboard/invest/history"
          className="jarvis-card rounded-xl p-4 flex items-center justify-center mt-4 hover:bg-white/10 transition-colors"
        >
          <span className="text-blue-400 font-semibold">TRADE HISTORY</span>
        </Link>

        {/* Information */}
        <div className="mt-6 jarvis-card rounded-xl p-4">
          <h3 className="text-white font-semibold mb-2">Investment Rules</h3>
          <ul className="text-gray-300 text-sm space-y-1">
            <li>• Daily profits are calculated automatically</li>
            <li>• Profits are added to your main wallet every hour</li>
            <li>• You can only withdraw profits, not principal</li>
            <li>• Multiple investments in different plans allowed</li>
            <li>• Ton Coins are awarded instantly</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
