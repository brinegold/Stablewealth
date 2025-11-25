'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, DollarSign, History, Coins, Copy, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function DepositPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [txHash, setTxHash] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState('USDT.BEP20')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [walletInfo, setWalletInfo] = useState<any>(null)
  const [loadingWallet, setLoadingWallet] = useState(true)
  const supabase = createSupabaseClient()

  // Deposit limits
  const MIN_DEPOSIT = 10
  const MAX_DEPOSIT = 50000

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchWalletInfo()
    }
  }, [user])

  const fetchWalletInfo = async () => {
    try {
      const response = await fetch(`/api/bsc/my-wallet?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setWalletInfo(data)
        console.log('✅ Wallet info loaded:', data)
      } else {
        const errorData = await response.json()
        console.error('❌ Failed to load wallet:', errorData)
        setError(`Failed to load wallet information: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('❌ Wallet fetch error:', error)
      setError('Failed to load wallet information')
    } finally {
      setLoadingWallet(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccess('')

    if (!depositAmount) {
      setError('Please enter the deposit amount')
      setIsSubmitting(false)
      return
    }

    const amount = parseFloat(depositAmount)
    if (isNaN(amount)) {
      setError('Please enter a valid deposit amount')
      setIsSubmitting(false)
      return
    }

    if (amount < MIN_DEPOSIT) {
      setError(`Minimum deposit amount is $${MIN_DEPOSIT} USDT`)
      setIsSubmitting(false)
      return
    }

    if (amount > MAX_DEPOSIT) {
      setError(`Maximum deposit amount is $${MAX_DEPOSIT.toLocaleString()} USDT`)
      setIsSubmitting(false)
      return
    }

    if (!txHash) {
      setError('Please enter the transaction hash')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/bsc/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ txHash, expectedAmount: amount, userId: user.id })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(`Deposit processed successfully! Amount: $${data.amount.toFixed(2)} (Fee: $${data.fee.toFixed(2)})`)
        setTxHash('')
        setDepositAmount('')

        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          router.push('/dashboard')
        }, 3000)
      } else {
        setError(data.error || 'Failed to process deposit')
      }

    } catch (error: any) {
      setError(error.message || 'Failed to process deposit')
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
          <h1 className="text-xl font-bold text-white">Deposit Amount</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-md">
        {/* Wallet Information */}
        {loadingWallet ? (
          <div className="jarvis-card rounded-2xl p-6 mb-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-white">Loading wallet...</p>
          </div>
        ) : walletInfo ? (
          <div className="jarvis-card rounded-2xl p-6 mb-6">
            <h3 className="text-white font-bold text-lg mb-4">Your BSC Deposit Wallet</h3>
            <div className="bg-white/10 rounded-lg p-4 mb-4">
              <p className="text-gray-300 text-sm mb-2">Wallet Address:</p>
              <p className="text-white font-mono text-sm break-all">{walletInfo.address}</p>
            </div>
            <div className="text-center">
              <img
                src={walletInfo.qrCode}
                alt="Wallet QR Code"
                className="mx-auto mb-2 rounded-lg"
                width={150}
                height={150}
              />
              <p className="text-gray-300 text-sm">Scan QR code to send USDT</p>
            </div>
          </div>
        ) : null}

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

        {/* Transaction Hash Input */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4">Submit Deposit Transaction</h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Deposit Currency
              </label>
              <div className="relative">
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                >
                  <option value="USDT.BEP20" className="bg-gray-800">USDT (BEP20)</option>
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Coins className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Deposit Amount (USDT)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Enter amount (10 - 50,000)"
                  min={MIN_DEPOSIT}
                  max={MAX_DEPOSIT}
                  step="0.01"
                  required
                  className="w-full px-4 py-3 pl-12 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Minimum: $10 USDT • Maximum: $50,000 USDT
              </p>
            </div>

            {depositAmount && parseFloat(depositAmount) >= MIN_DEPOSIT && (
              <div className="bg-green-600/20 border border-green-500 rounded-lg p-4">
                <div className="flex justify-between text-sm text-white mb-2">
                  <span>Deposit Amount:</span>
                  <span>${depositAmount || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm text-white mb-2">
                  <span>Deposit Fee (1%):</span>
                  <span>${depositAmount ? (parseFloat(depositAmount) * 0.01).toFixed(2) : '0.00'}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-white border-t border-white/20 pt-2">
                  <span>Net Amount (Credited):</span>
                  <span>${depositAmount ? (parseFloat(depositAmount) * 0.99).toFixed(2) : '0.00'}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Transaction Hash
              </label>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
                required
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-gray-400 text-sm mt-2">
                Enter the transaction hash after sending USDT to the wallet address above
              </p>
            </div>

            <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2">Fee Information</h4>
              <div className="text-sm text-gray-300 space-y-1">
                <p>• Deposit Fee: 1% of deposit amount</p>
                <p>• Minimum Deposit: $10.00 USDT</p>
                <p>• Maximum Deposit: $50,000.00 USDT</p>
                <p>• Network: BSC (Binance Smart Chain)</p>
                <p>• Processing: Automatic after verification</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !txHash || !depositAmount}
              className="w-full jarvis-button py-4 rounded-lg text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Verifying Transaction...' : 'VERIFY & PROCESS DEPOSIT'}
            </button>
          </form>
        </div>

        {/* Deposit History Button */}
        <Link
          href="/dashboard/deposit/history"
          className="jarvis-card rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <History className="h-6 w-6 text-blue-400" />
            <span className="text-white font-semibold">DEPOSIT HISTORY</span>
          </div>
        </Link>

        {/* Information */}
        <div className="mt-6 space-y-4">
          <div className="jarvis-card rounded-xl p-4">
            <h3 className="text-white font-semibold mb-2">Deposit Information</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Minimum deposit: $10.00</li>
              <li>• Maximum deposit: $50,000.00</li>
              <li>• Deposit fee: 1% of deposit amount</li>
              <li>• Processing time: Instant</li>
              <li>• Supported currency: USDT (BEP20)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
