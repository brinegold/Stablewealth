'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, ArrowUpRight, Calendar, DollarSign, CheckCircle, Clock, XCircle } from 'lucide-react'
import Link from 'next/link'
import DockNavbar from '@/components/DockNavbar'

interface DepositRecord {
  id: string
  user_id: string
  amount: number
  net_amount: number
  transaction_type: string
  status: 'pending' | 'completed' | 'failed'
  description: string
  created_at: string
  payment_method?: string
}

export default function DepositHistoryPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [deposits, setDeposits] = useState<DepositRecord[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all')
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchDepositHistory()
    }
  }, [user])

  const fetchDepositHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('transaction_type', 'deposit')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDeposits(data || [])
    } catch (error) {
      console.error('Error fetching deposit history:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-400" />
      case 'pending': return <Clock className="h-5 w-5 text-yellow-400" />
      case 'failed': return <XCircle className="h-5 w-5 text-red-400" />
      default: return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-500/20'
      case 'pending': return 'text-yellow-400 bg-yellow-500/20'
      case 'failed': return 'text-red-400 bg-red-500/20'
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

  const filteredDeposits = deposits.filter(deposit =>
    filter === 'all' || deposit.status === filter
  )

  const totalDeposited = deposits
    .filter(d => d.status === 'completed')
    .reduce((sum, deposit) => sum + deposit.amount, 0)

  const pendingAmount = deposits
    .filter(d => d.status === 'pending')
    .reduce((sum, deposit) => sum + deposit.amount, 0)

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
          <Link href="/dashboard/deposit" className="text-white hover:text-blue-300">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">Deposit History</h1>
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
                <p className="text-gray-300 text-sm">Total Deposited</p>
                <p className="text-xl font-bold text-white">${totalDeposited.toFixed(2)}</p>
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
              <ArrowUpRight className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-gray-300 text-sm">Total Transactions</p>
                <p className="text-xl font-bold text-white">{deposits.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'completed', 'pending', 'failed'].map((status) => (
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
                  {deposits.filter(d => d.status === status).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Deposit Records */}
        <div className="space-y-4">
          {filteredDeposits.length === 0 ? (
            <div className="jarvis-card rounded-xl p-8 text-center">
              <ArrowUpRight className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {filter === 'all' ? 'No Deposit History' : `No ${filter} deposits`}
              </h3>
              <p className="text-gray-300 mb-4">
                {filter === 'all'
                  ? "You haven't made any deposits yet."
                  : `No deposits with ${filter} status found.`
                }
              </p>
              {filter === 'all' && (
                <Link
                  href="/dashboard/deposit"
                  className="jarvis-button px-6 py-2 rounded-lg text-white font-semibold"
                >
                  Make Deposit
                </Link>
              )}
            </div>
          ) : (
            filteredDeposits.map((deposit) => (
              <div key={deposit.id} className="jarvis-card rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <ArrowUpRight className="h-6 w-6 text-blue-400" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          ${deposit.amount.toFixed(2)} USDT
                        </h3>
                        <p className="text-sm text-gray-300">
                          Net: ${deposit.net_amount.toFixed(2)}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(deposit.status)}`}>
                        {deposit.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Transaction ID</p>
                        <p className="text-white font-mono text-xs">{deposit.id.slice(0, 8)}...</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Date</p>
                        <p className="text-white">{formatDate(deposit.created_at)}</p>
                      </div>
                      {deposit.description && (
                        <div className="md:col-span-2">
                          <p className="text-gray-400">Description</p>
                          <p className="text-white">{deposit.description}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {getStatusIcon(deposit.status)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Action */}
        {deposits.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/dashboard/deposit"
              className="jarvis-button px-8 py-3 rounded-lg text-white font-semibold"
            >
              Make Another Deposit
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
