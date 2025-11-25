'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, Coins, History } from 'lucide-react'
import Link from 'next/link'
import DockNavbar from '@/components/DockNavbar'
import { dualReferralService } from '@/lib/referralService'

interface Profile {
  fund_wallet_balance: number
}

export default function StakingPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [amount, setAmount] = useState('')
  const [stakingPeriod, setStakingPeriod] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createSupabaseClient()

  const stakingPeriods = [
    { value: '30', label: '30 Days', apy: '8%' },
    { value: '60', label: '60 Days', apy: '12%' },
    { value: '90', label: '90 Days', apy: '15%' },
    { value: '180', label: '180 Days', apy: '20%' },
    { value: '365', label: '365 Days', apy: '25%' }
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
        .select('fund_wallet_balance')
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

    if (stakingAmount < 50) {
      setError('Minimum staking amount is $50')
      setIsSubmitting(false)
      return
    }

    if (!profile || stakingAmount > profile.fund_wallet_balance) {
      setError('Insufficient fund wallet balance')
      setIsSubmitting(false)
      return
    }

    if (!stakingPeriod) {
      setError('Please select a staking period')
      setIsSubmitting(false)
      return
    }

    try {
      // Create staking transaction
      const selectedPeriod = stakingPeriods.find(p => p.value === stakingPeriod)
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user?.id,
          transaction_type: 'staking',
          amount: stakingAmount,
          net_amount: stakingAmount,
          status: 'completed',
          description: `USD Staking - ${selectedPeriod?.label} at ${selectedPeriod?.apy} APY`
        })
        .select()
        .single()

      if (transactionError) throw transactionError

      // Deduct from fund wallet
      const { error: walletError } = await supabase
        .from('profiles')
        .update({
          fund_wallet_balance: profile.fund_wallet_balance - stakingAmount
        })
        .eq('id', user?.id)

      if (walletError) throw walletError

      // Process dual referral commissions (USDT + TON)
      try {
        await dualReferralService.processDualReferralCommissions({
          userId: user?.id || '',
          amount: stakingAmount,
          tonEarned: 0, // USDT staking doesn't earn TON coins
          transactionType: 'staking',
          planType: `${selectedPeriod?.label} at ${selectedPeriod?.apy} APY`
        })
        console.log('Dual referral commissions processed successfully')
      } catch (referralError) {
        console.error('Error processing referral commissions:', referralError)
        // Don't fail the staking if referral processing fails
      }

      setSuccess(`Successfully staked $${stakingAmount} for ${selectedPeriod?.label} at ${selectedPeriod?.apy} APY!`)
      setAmount('')
      setStakingPeriod('')

      // Update local profile state
      setProfile(prev => prev ? { ...prev, fund_wallet_balance: prev.fund_wallet_balance - stakingAmount } : null)

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
          <h1 className="text-xl font-bold text-white">User Staking</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-md">
        {/* Available Balance */}
        <div className="jarvis-card rounded-2xl p-6 mb-6 text-center">
          <h2 className="text-white text-lg mb-2">Available Fund Wallet</h2>
          <p className="text-3xl font-bold text-green-400">${profile?.fund_wallet_balance.toFixed(2) || '0.00'}</p>
          <p className="text-gray-300 text-sm mt-2">Amount in USDT</p>
        </div>

        {/* Staking Notice */}
        <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4 mb-6">
          <p className="text-white text-center">Staking has started from $50.</p>
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

        {/* Staking Form */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0 USDT"
                min="50"
                step="0.01"
                required
                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-lg text-white text-2xl text-center placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-center text-gray-300 text-sm mt-2">Amount in USD</p>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Staking Period
              </label>
              <select
                value={stakingPeriod}
                onChange={(e) => setStakingPeriod(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" className="bg-gray-800">--Select--</option>
                {stakingPeriods.map((period) => (
                  <option key={period.value} value={period.value} className="bg-gray-800">
                    {period.label} - {period.apy} APY
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Enter Password
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !amount || !stakingPeriod}
              className="w-full jarvis-button py-4 rounded-lg text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing...' : 'SUBMIT'}
            </button>
          </form>
        </div>

        {/* Staking Periods Info */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center">
            <Coins className="h-6 w-6 mr-2 text-yellow-400" />
            Staking Options
          </h3>
          <div className="space-y-3">
            {stakingPeriods.map((period) => (
              <div key={period.value} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="text-white font-semibold">{period.label}</p>
                  <p className="text-gray-300 text-sm">Lock period</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-bold">{period.apy}</p>
                  <p className="text-gray-400 text-sm">APY</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staking History Button */}
        <Link
          href="/dashboard/staking/history"
          className="jarvis-card rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <History className="h-6 w-6 text-blue-400" />
            <span className="text-white font-semibold">STAKING HISTORY</span>
          </div>
        </Link>

        {/* Information */}
        <div className="mt-6 space-y-4">
          <div className="jarvis-card rounded-xl p-4">
            <h3 className="text-white font-semibold mb-2">Staking Information</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Minimum staking: $50.00</li>
              <li>• Rewards paid daily</li>
              <li>• Early withdrawal penalties apply</li>
              <li>• Higher APY for longer lock periods</li>
              <li>• Compound your earnings automatically</li>
            </ul>
          </div>

          <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-4">
            <h4 className="text-yellow-400 font-semibold mb-2">Important Notice</h4>
            <p className="text-yellow-200 text-sm">
              Staked funds are locked for the selected period.
              Early withdrawal may result in penalty fees and loss of rewards.
            </p>
          </div>
        </div>
      </div>

      {/* Dock Navigation */}
      <DockNavbar onSignOut={async () => {
        await signOut()
        router.push('/')
      }} />
    </div>
  )
}
