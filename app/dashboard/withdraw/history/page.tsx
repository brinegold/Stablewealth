'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, ArrowDownLeft, Calendar, DollarSign, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import DockNavbar from '@/components/DockNavbar'

interface WithdrawRecord {
  id: string
  user_id: string
  amount: number
  net_amount: number
  transaction_type: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'rejected'
  description: string
  created_at: string
  wallet_address?: string
  transaction_hash?: string
}

export default function WithdrawHistoryPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [withdrawals, setWithdrawals] = useState<WithdrawRecord[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'rejected'>('all')
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchWithdrawHistory()
    }
  }, [user])

  const fetchWithdrawHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('transaction_type', 'withdrawal')
        .order('created_at', { ascending: false })

      if (error) throw error
      setWithdrawals(data || [])
    } catch (error) {
      console.error('Error fetching withdraw history:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-400" />
      case 'pending': return <Clock className="h-5 w-5 text-yellow-400" />
      case 'processing': return <AlertCircle className="h-5 w-5 text-blue-400" />
      case 'failed': return <XCircle className="h-5 w-5 text-red-400" />
      case 'rejected': return <XCircle className="h-5 w-5 text-red-400" />
      default: return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-500/20'
      case 'pending': return 'text-yellow-400 bg-yellow-500/20'
      case 'processing': return 'text-amber-400 bg-amber-800/20'
      case 'failed': return 'text-red-400 bg-red-500/20'
      case 'rejected': return 'text-red-400 bg-red-500/20'
      default: return 'text-gray-400 bg-gray-500/20'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredWithdrawals = withdrawals.filter(withdrawal =>
    filter === 'all' || withdrawal.status === filter
  )

  const totalWithdrawn = withdrawals
    .filter(w => w.status === 'completed')
    .reduce((sum, withdrawal) => sum + withdrawal.amount, 0)

  const pendingAmount = withdrawals
    .filter(w => w.status === 'pending' || w.status === 'processing')
    .reduce((sum, withdrawal) => sum + withdrawal.amount, 0)

  if (loading || loadingData) {
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
          <Link href="/dashboard/withdraw" className="text-white hover:text-blue-300">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">Withdrawal History</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-4xl">
        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <DollarSign className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-gray-300 text-sm">Total Withdrawn</p>
                <p className="text-xl font-bold text-white">${totalWithdrawn.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-gray-300 text-sm">Pending</p>
                <p className="text-xl font-bold text-white">${pendingAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <ArrowDownLeft className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-gray-300 text-sm">Total Requests</p>
                <p className="text-xl font-bold text-white">{withdrawals.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'completed', 'pending', 'processing', 'failed', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === status
                ? 'bg-amber-800 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className="ml-2 bg-white/20 px-2 py-1 rounded-full text-xs">
                  {withdrawals.filter(w => w.status === status).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Withdrawal Records */}
        <div className="space-y-4">
          {filteredWithdrawals.length === 0 ? (
            <div className="jarvis-card rounded-xl p-8 text-center">
              <ArrowDownLeft className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {filter === 'all' ? 'No Withdrawal History' : `No ${filter} withdrawals`}
              </h3>
              <p className="text-gray-300 mb-4">
                {filter === 'all'
                  ? "You haven't made any withdrawals yet."
                  : `No withdrawals with ${filter} status found.`
                }
              </p>
              {filter === 'all' && (
                <Link
                  href="/dashboard/withdraw"
                  className="jarvis-button px-6 py-2 rounded-lg text-white font-semibold"
                >
                  Make Withdrawal
                </Link>
              )}
            </div>
          ) : (
            filteredWithdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="jarvis-card rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <ArrowDownLeft className="h-6 w-6 text-red-400" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          ${withdrawal.amount.toFixed(2)} USDT
                        </h3>
                        <p className="text-sm text-gray-300">
                          Net: ${withdrawal.net_amount.toFixed(2)}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(withdrawal.status)}`}>
                        {withdrawal.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Transaction ID</p>
                        <p className="text-white font-mono text-xs">{withdrawal.id.slice(0, 8)}...</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Date</p>
                        <p className="text-white">{formatDate(withdrawal.created_at)}</p>
                      </div>
                      {withdrawal.wallet_address && (
                        <div>
                          <p className="text-gray-400">Wallet Address</p>
                          <p className="text-white font-mono text-xs">
                            {withdrawal.wallet_address.slice(0, 6)}...{withdrawal.wallet_address.slice(-6)}
                          </p>
                        </div>
                      )}
                      {withdrawal.transaction_hash && (
                        <div>
                          <p className="text-gray-400">Transaction Hash</p>
                          <p className="text-blue-400 font-mono text-xs">
                            {withdrawal.transaction_hash.slice(0, 6)}...{withdrawal.transaction_hash.slice(-6)}
                          </p>
                        </div>
                      )}
                      {withdrawal.description && (
                        <div className="md:col-span-2">
                          <p className="text-gray-400">Description</p>
                          <p className="text-white">{withdrawal.description}</p>
                        </div>
                      )}
                    </div>

                    {/* Status-specific information */}
                    {withdrawal.status === 'pending' && (
                      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-yellow-400 text-sm">
                          ⏳ Your withdrawal request is being reviewed. This usually takes 1-24 hours.
                        </p>
                      </div>
                    )}

                    {withdrawal.status === 'processing' && (
                      <div className="mt-4 p-3 bg-amber-800/10 border border-amber-800/30 rounded-lg">
                        <p className="text-amber-400 text-sm">
                          🔄 Your withdrawal is being processed. Funds will be sent to your wallet shortly.
                        </p>
                      </div>
                    )}

                    {withdrawal.status === 'failed' && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-red-400 text-sm">
                          ❌ Withdrawal failed. Please contact support for assistance.
                        </p>
                      </div>
                    )}

                    {withdrawal.status === 'rejected' && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-red-400 text-sm">
                          🚫 Withdrawal rejected. Please check your account status or contact support.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {getStatusIcon(withdrawal.status)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Action */}
        {withdrawals.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/dashboard/withdraw"
              className="jarvis-button px-8 py-3 rounded-lg text-white font-semibold"
            >
              Make Another Withdrawal
            </Link>
          </div>
        )}
      </div>

      {/* Dock Navigation */}
      <DockNavbar onSignOut={async () => {
        await signOut()
        router.push('/')
      }} />
    </div>
  )
}
