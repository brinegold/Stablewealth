'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, Coins, History } from 'lucide-react'
import Link from 'next/link'
import { dualReferralService } from '@/lib/referralService'

interface Profile {
  total_jarvis_tokens: number
}

export default function TonStakingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [amount, setAmount] = useState('')
  const [stakingPeriod, setStakingPeriod] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createSupabaseClient()

  const stakingPeriods = [
    { value: '30', label: '30 Days', apy: '3% Daily' },
    { value: '60', label: '60 Days', apy: '5% Daily' },
    { value: '90', label: '90 Days', apy: '6% Daily' },
    { value: '180', label: '180 Days', apy: '8% Daily' },
    { value: '365', label: '365 Days', apy: '10% Daily' }
  ]

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
        .select('total_jarvis_tokens')
        .eq('id', user?.id)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccess('')

    const stakingAmount = parseFloat(amount)

    if (stakingAmount < 100) {
      setError('Minimum TON staking amount is 100 TON')
      setIsSubmitting(false)
      return
    }

    if (!profile || stakingAmount > profile.total_jarvis_tokens) {
      setError('Insufficient Ton Coin balance')
      setIsSubmitting(false)
      return
    }

    if (!stakingPeriod) {
      setError('Please select a staking period')
      setIsSubmitting(false)
      return
    }

    try {
      // Create TON staking transaction
      const selectedPeriod = stakingPeriods.find(p => p.value === stakingPeriod)
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user?.id,
          transaction_type: 'deposit',
          amount: stakingAmount,
          net_amount: stakingAmount,
          status: 'completed',
          description: `TON Staking - ${stakingAmount} coins for ${selectedPeriod?.value} days at ${selectedPeriod?.apy} APY`
        })
        .select()
        .single()

      if (transactionError) throw transactionError

      // Create TON staking plan record
      const dailyPercentage = parseFloat(selectedPeriod?.apy.replace('% Daily', '') || '3')
      const stakingPeriodDays = parseInt(selectedPeriod?.value || '30')
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + stakingPeriodDays)

      const { data: stakingPlan, error: stakingError } = await supabase
        .from('ton_staking_plans')
        .insert({
          user_id: user?.id,
          amount: stakingAmount,
          staking_period: stakingPeriodDays,
          daily_percentage: dailyPercentage,
          end_date: endDate.toISOString(),
          transaction_id: transaction.id
        })
        .select()
        .single()

      if (stakingError) throw stakingError

      // Deduct from Ton coins
      const { error: tokenError } = await supabase
        .from('profiles')
        .update({
          total_jarvis_tokens: profile.total_jarvis_tokens - stakingAmount
        })
        .eq('id', user?.id)

      if (tokenError) throw tokenError

      // Process dual referral commissions (USDT + TON) - convert TON amount to USDT equivalent for calculation
      try {
        // Assuming 1 TON = $0.01 for referral calculation purposes
        const usdtEquivalent = stakingAmount * 0.01
        await dualReferralService.processDualReferralCommissions({
          userId: user?.id || '',
          amount: usdtEquivalent,
          jrcEarned: stakingAmount, // TON staking - the staked amount is the TON earned for referral calculation
          transactionType: 'staking',
          planType: `TON ${selectedPeriod?.label} at ${selectedPeriod?.apy} APY`
        })
        console.log('Dual referral commissions processed successfully for TON staking')
      } catch (referralError) {
        console.error('Error processing referral commissions:', referralError)
        // Don't fail the staking if referral processing fails
      }

      setSuccess(`Successfully staked ${stakingAmount} TON for ${selectedPeriod?.label} at ${selectedPeriod?.apy} APY!`)
      setAmount('')
      setStakingPeriod('')

      // Update local profile state
      setProfile(prev => prev ? { ...prev, total_jarvis_tokens: prev.total_jarvis_tokens - stakingAmount } : null)

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
          <h1 className="text-2xl font-bold text-white mb-4">Stable Wealth Staking</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-md">
        {/* Available Balance */}
        <div className="jarvis-card rounded-2xl p-6 mb-6 text-center">
          <h2 className="text-white text-lg mb-2">Available Ton Wallet</h2>
          <p className="text-3xl font-bold text-yellow-400">{profile?.total_jarvis_tokens.toLocaleString() || '0'} TON</p>
          <p className="text-gray-300 text-sm mt-2">Amount in TON</p>
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

        {/* TON Staking Form */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-2">TON Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter TON amount"
                min="100"
                step="1"
                required
                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-lg text-white text-2xl text-center placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">Staking Period</label>
              <select
                value={stakingPeriod}
                onChange={(e) => setStakingPeriod(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select staking period</option>
                {stakingPeriods.map((period) => (
                  <option key={period.value} value={period.value} className="bg-gray-800">
                    {period.label} - {period.apy} APY
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full jarvis-button py-4 rounded-lg text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing...' : 'Stake TON'}
            </button>
          </form>
        </div>

        {/* TON Staking Periods Info */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center">
            <Coins className="h-6 w-6 mr-2 text-yellow-400" />
            TON Staking Options
          </h3>
          <div className="space-y-3">
            {stakingPeriods.map((period) => (
              <div key={period.value} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="text-white font-semibold">{period.label}</p>
                  <p className="text-gray-300 text-sm">Lock period</p>
                </div>
                <div className="text-right">
                  <p className="text-yellow-400 font-bold">{period.apy}</p>
                  <p className="text-gray-400 text-sm">APY</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Token Value Info */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4">Token Value</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-300">Current Price:</span>
              <span className="text-white font-semibold">$0.1 per TON</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Future Listing:</span>
              <span className="text-green-400 font-semibold">$3.0 per TON</span>
            </div>
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg p-3 mt-4">
              <p className="text-center text-white text-sm">
                🚀 <strong>Stake TON coins and earn rewards while holding for future growth!</strong>
              </p>
            </div>
          </div>
        </div>

        {/* TON Staking History Button */}
        <Link
          href="/dashboard/bnx-staking/history"
          className="jarvis-card rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <History className="h-6 w-6 text-blue-400" />
            <span className="text-white font-semibold">TON STAKING HISTORY</span>
          </div>
        </Link>

        {/* Information */}
        <div className="mt-6 space-y-4">
          <div className="jarvis-card rounded-xl p-4">
            <h3 className="text-white font-semibold mb-2">TON Staking Information</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Minimum staking: 100 TON</li>
              <li>• Higher APY than USD staking</li>
              <li>• Rewards paid in TON coins</li>
              <li>• Longer periods = higher rewards</li>
              <li>• Participate in coin ecosystem growth</li>
            </ul>
          </div>

          <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4">
            <h4 className="text-amber-400 font-semibold mb-2">TON Staking Benefits</h4>
            <p className="text-amber-200 text-sm">
              Stake your TON coins to earn higher APY rewards while supporting the Jarvis Staking ecosystem.
              Your staked coins contribute to platform liquidity and governance.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
