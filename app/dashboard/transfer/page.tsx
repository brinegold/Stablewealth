'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, Wallet, ArrowRight, History } from 'lucide-react'
import Link from 'next/link'

interface Profile {
  main_wallet_balance: number
  fund_wallet_balance: number
}

export default function TransferPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [transferType, setTransferType] = useState<'main-to-fund' | 'fund-to-fund' | null>(null)
  const [amount, setAmount] = useState('')
  const [receiverId, setReceiverId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createSupabaseClient()

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
        .select('main_wallet_balance, fund_wallet_balance')
        .eq('id', user?.id)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccess('')

    const transferAmount = parseFloat(amount)
    
    if (transferAmount < 0.01) {
      setError('Minimum transfer amount is $0.01')
      setIsSubmitting(false)
      return
    }

    if (!profile) {
      setError('Profile not loaded')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transferType,
          amount: transferAmount,
          receiverId: transferType === 'fund-to-fund' ? receiverId : undefined,
          userId: user.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Transfer failed')
      }

      // Update local state based on transfer type
      if (transferType === 'main-to-fund') {
        setProfile(prev => prev ? {
          ...prev,
          main_wallet_balance: data.newMainBalance,
          fund_wallet_balance: data.newFundBalance
        } : null)
      } else if (transferType === 'fund-to-fund') {
        setProfile(prev => prev ? {
          ...prev,
          fund_wallet_balance: data.newFundBalance
        } : null)
      }

      setSuccess(data.message)
      setAmount('')
      setReceiverId('')
      setTransferType(null)

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
          <Link href="/dashboard" className="text-white hover:text-amber-200">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">Transfer</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-md">
        {!transferType ? (
          <>
            {/* Transfer Type Selection */}
            <div className="space-y-4 mb-6">
              <div 
                onClick={() => setTransferType('main-to-fund')}
                className="jarvis-card rounded-2xl p-6 cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center">
                      <Wallet className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold">Main Wallet Transfer</h3>
                      <p className="text-gray-300 text-sm">CLICK HERE</p>
                    </div>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => setTransferType('fund-to-fund')}
                className="jarvis-card rounded-2xl p-6 cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-r from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center">
                      <Wallet className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold">Fund Wallet Transfer</h3>
                      <p className="text-gray-300 text-sm">CLICK HERE</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Transfer Form */}
            <div className="jarvis-card rounded-2xl p-6 mb-6">
              <div className="text-center mb-6">
                <h2 className="text-white text-lg mb-4">
                  {transferType === 'main-to-fund' ? 'Main to Fund Transfer' : 'Fund to Fund Transfer'}
                </h2>
                
                {transferType === 'main-to-fund' ? (
                  <div className="flex items-center justify-center space-x-4">
                    <div className="text-center">
                      <p className="text-gray-300 text-sm">Main Wallet</p>
                      <p className="text-white font-bold">${profile?.main_wallet_balance.toFixed(2) || '0'}</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-amber-300" />
                    <div className="text-center">
                      <p className="text-gray-300 text-sm">Fund Wallet</p>
                      <p className="text-white font-bold">${profile?.fund_wallet_balance.toFixed(2) || '0'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-gray-300 text-sm">Available Fund Wallet</p>
                    <p className="text-white font-bold text-2xl">${profile?.fund_wallet_balance.toFixed(2) || '0'}</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-amber-600/20 border border-amber-600 text-amber-200 px-4 py-3 rounded-lg mb-4">
                  {success}
                </div>
              )}

              <form onSubmit={handleTransfer} className="space-y-6">
                <div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="$0.00"
                    min="0.01"
                    step="0.01"
                    required
                    className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-lg text-white text-2xl text-center placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-center text-gray-300 text-sm mt-2">Amount in USD</p>
                </div>

                {transferType === 'fund-to-fund' && (
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      Receiver ID
                    </label>
                    <input
                      type="text"
                      value={receiverId}
                      onChange={(e) => setReceiverId(e.target.value)}
                      placeholder="Enter receiver's referral code"
                      required
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

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

                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setTransferType(null)}
                    className="flex-1 bg-gray-600 py-3 rounded-lg text-white font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !amount}
                    className="flex-1 jarvis-button py-3 rounded-lg text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Processing...' : 'SUBMIT'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Transfer History Button */}
        <Link 
          href="/dashboard/transfer/history"
          className="jarvis-card rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <History className="h-6 w-6 text-amber-300" />
            <span className="text-white font-semibold">TRANSFER HISTORY</span>
          </div>
        </Link>

        {/* Information */}
        <div className="mt-6 jarvis-card rounded-xl p-4">
          <h3 className="text-white font-semibold mb-2">Transfer Information</h3>
          <ul className="text-gray-300 text-sm space-y-1">
            <li>• Main to Fund: Transfer profits to investment wallet</li>
            <li>• Fund to Fund: Send funds to other users</li>
            <li>• Transfers are processed instantly</li>
            <li>• No fees for internal transfers</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
