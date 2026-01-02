'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, DollarSign, History, Coins, Copy, CheckCircle, Clock, AlertCircle, Wallet, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface DepositRequest {
  id: string
  tx_hash: string
  amount: number
  currency: string
  network: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string
  created_at: string
  processed_at?: string
}

export default function ManualDepositPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [txHash, setTxHash] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState('USDT')
  const [selectedNetwork, setSelectedNetwork] = useState('BEP20')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [globalWalletAddress, setGlobalWalletAddress] = useState('')
  const [loadingWallet, setLoadingWallet] = useState(true)
  const [recentRequests, setRecentRequests] = useState<DepositRequest[]>([])
  const [copied, setCopied] = useState(false)

  const supabase = createSupabaseClient()

  // Deposit limits
  const MIN_DEPOSIT = 10
  const MAX_DEPOSIT = 50000

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    } else if (user) {
      fetchGlobalWalletAddress()
      fetchRecentRequests()
    }
  }, [user, loading, router])

  const fetchGlobalWalletAddress = async () => {
    try {
      const response = await fetch('/api/admin/global-wallet-address')
      if (response.ok) {
        const data = await response.json()
        setGlobalWalletAddress(data.address)
      } else {
        setError('Failed to load deposit wallet address')
      }
    } catch (error) {
      console.error('Error fetching global wallet:', error)
      setError('Failed to load deposit wallet address')
    } finally {
      setLoadingWallet(false)
    }
  }

  const fetchRecentRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('deposit_requests')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      setRecentRequests(data || [])
    } catch (error) {
      console.error('Error fetching deposit requests:', error)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    console.log('🚀 handleSubmit function called!')
    e.preventDefault()
    console.log('🔄 Form submitted - starting validation...')
    setIsSubmitting(true)
    setError('')
    setSuccess('')

    if (!depositAmount) {
      console.log('❌ Validation failed: No deposit amount')
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
      console.log('❌ Validation failed: No transaction hash')
      setError('Please enter the transaction hash')
      setIsSubmitting(false)
      return
    }

    // Validate transaction hash format
    if (!txHash.startsWith('0x') || txHash.length !== 66) {
      console.log('❌ Validation failed: Invalid transaction hash format')
      console.log(`❌ TX Hash length: ${txHash.length}, Expected: 66`)
      setError(`Please enter a valid transaction hash (should start with 0x and be 66 characters long). Current length: ${txHash.length}`)
      setIsSubmitting(false)
      return
    }

    console.log('✅ All validations passed, making API call...')
    console.log('📝 Request data:', { txHash, amount, currency: selectedCurrency, network: selectedNetwork, userId: user?.id })

    try {
      const response = await fetch('/api/deposit/manual-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          txHash,
          amount,
          currency: selectedCurrency,
          network: selectedNetwork,
          userId: user?.id
        })
      })

      console.log('📡 API Response status:', response.status)
      const data = await response.json()
      console.log('📡 API Response data:', data)

      if (response.ok) {
        console.log('✅ Deposit request submitted successfully!')
        setSuccess(`Deposit request submitted successfully! Your request is now pending admin approval. Request ID: ${data.requestId}`)
        setTxHash('')
        setDepositAmount('')

        // Refresh recent requests
        fetchRecentRequests()

        // Scroll to top to show success message
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        console.log('❌ API Error:', data.error)
        setError(data.error || 'Failed to submit deposit request')
      }

    } catch (error: any) {
      console.log('❌ Network/Parse Error:', error)
      setError(error.message || 'Failed to submit deposit request')
    } finally {
      setIsSubmitting(false)
      console.log('🏁 Form submission completed')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-400" />
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-amber-400" />
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-400" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-amber-400'
      case 'approved':
        return 'text-amber-400'
      case 'rejected':
        return 'text-red-400'
      default:
        return 'text-gray-400'
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
          <h1 className="text-xl font-bold text-white">Deposit</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-md">
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

        {/* Global Wallet Information */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4 flex items-center space-x-2">
            <Wallet className="h-6 w-6 text-amber-300" />
            <span>Deposit Wallet Address</span>
          </h3>

          {loadingWallet ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <p className="text-white">Loading wallet address...</p>
            </div>
          ) : globalWalletAddress ? (
            <div className="space-y-4">
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-gray-300 text-sm mb-2">Send USDT (BEP20) to this address:</p>
                <div className="flex items-center justify-between bg-black/20 rounded-lg p-3">
                  <p className="text-white font-mono text-sm break-all flex-1 mr-2">{globalWalletAddress}</p>
                  <button
                    onClick={() => copyToClipboard(globalWalletAddress)}
                    className="text-amber-300 hover:text-amber-200 flex-shrink-0"
                  >
                    {copied ? <CheckCircle className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-2 flex items-center space-x-2">
                  <AlertCircle className="h-5 w-5" />
                  <span>Important Instructions</span>
                </h4>
                <div className="text-sm text-gray-300 space-y-1">
                  <p>• Send USDT on BEP20 network only</p>
                  <p>• Copy the transaction hash after sending</p>
                  <p>• Submit the form below with exact amount and tx hash</p>
                  <p>• Processing time: 1-5 minutes</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-red-200">Failed to load wallet address</p>
            </div>
          )}
        </div>

        {/* Deposit Request Form */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4">Submit Deposit Request</h3>

          <form
            onSubmit={(e) => {
              console.log('📝 Form onSubmit triggered!')
              handleSubmit(e)
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Currency
                </label>
                <div className="relative">
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none"
                  >
                    <option value="USDT" className="bg-gray-800">USDT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Network
                </label>
                <div className="relative">
                  <select
                    value={selectedNetwork}
                    onChange={(e) => setSelectedNetwork(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none"
                  >
                    <option value="BEP20" className="bg-gray-800">BEP20 (BSC)</option>
                  </select>
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
                  className="w-full px-4 py-3 pl-12 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <DollarSign className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                Minimum: $10 USDT • Maximum: $50,000 USDT
              </p>
            </div>

            {depositAmount && parseFloat(depositAmount) >= MIN_DEPOSIT && (
              <div className="bg-amber-700/20 border border-amber-600 rounded-lg p-4">
                <div className="flex justify-between text-sm text-white mb-2">
                  <span>Deposit Amount:</span>
                  <span>${depositAmount || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm text-white mb-2">
                  <span>Processing Fee (1%):</span>
                  <span>${depositAmount ? (parseFloat(depositAmount) * 0.01).toFixed(2) : '0.00'}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-white border-t border-white/20 pt-2">
                  <span>Net Amount (You'll Receive):</span>
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
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm"
              />
              <p className="text-gray-400 text-sm mt-2">
                Enter the transaction hash after sending USDT to the wallet address above. Make sure to copy the full hash (starts with 0x...).
              </p>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !txHash || !depositAmount}
              className="w-full jarvis-button py-4 rounded-lg text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={(e) => {
                console.log('🖱️ Submit button clicked!')
                console.log('🔍 isSubmitting:', isSubmitting)
                console.log('🔍 txHash:', txHash)
                console.log('🔍 depositAmount:', depositAmount)
                console.log('🔍 Button disabled?', isSubmitting || !txHash || !depositAmount)

                if (isSubmitting || !txHash || !depositAmount) {
                  console.log('❌ Button is disabled - form will not submit')
                  if (!txHash) console.log('❌ Missing transaction hash')
                  if (!depositAmount) console.log('❌ Missing deposit amount')
                  if (isSubmitting) console.log('❌ Already submitting')
                } else {
                  console.log('✅ Button should allow submission')
                }
              }}
            >
              {isSubmitting ? 'Submitting Request...' : 'SUBMIT DEPOSIT REQUEST'}
            </button>

          </form>
        </div>

        {/* Recent Deposit Requests */}
        {recentRequests.length > 0 && (
          <div className="jarvis-card rounded-2xl p-6 mb-6">
            <h3 className="text-white font-bold text-lg mb-4">Recent Requests</h3>
            <div className="space-y-3">
              {recentRequests.map((request) => (
                <div key={request.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(request.status)}
                      <span className={`font-semibold capitalize ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <span className="text-white font-semibold">${request.amount.toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>TX: {request.tx_hash.slice(0, 10)}...{request.tx_hash.slice(-8)}</p>
                    <p>Submitted: {new Date(request.created_at).toLocaleDateString()}</p>
                    {request.admin_notes && (
                      <p className="text-amber-300">Note: {request.admin_notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deposit History Button */}
        <Link
          href="/dashboard/deposit/history"
          className="jarvis-card rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors mb-6"
        >
          <div className="flex items-center space-x-3">
            <History className="h-6 w-6 text-amber-300" />
            <span className="text-white font-semibold">DEPOSIT HISTORY</span>
          </div>
          <ExternalLink className="h-5 w-5 text-gray-400" />
        </Link>
      </div>
    </div>
  )
}
