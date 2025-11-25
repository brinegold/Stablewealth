'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, Send, ArrowRight, ArrowDown, CheckCircle, Clock, XCircle } from 'lucide-react'
import Link from 'next/link'
import DockNavbar from '@/components/DockNavbar'

interface TransferRecord {
  id: string
  user_id: string
  amount: number
  net_amount: number
  transaction_type: string
  status: 'pending' | 'completed' | 'failed'
  description: string
  created_at: string
  from_wallet?: string
  to_wallet?: string
  recipient_id?: string
}

export default function TransferHistoryPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [transfers, setTransfers] = useState<TransferRecord[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [filter, setFilter] = useState<'all' | 'sent' | 'received' | 'pending' | 'completed' | 'failed'>('all')
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchTransferHistory()
    }
  }, [user])

  const fetchTransferHistory = async () => {
    try {
      // Fetch both sent and received transfers
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .in('transaction_type', ['transfer_sent', 'transfer_received', 'wallet_transfer'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setTransfers(data || [])
    } catch (error) {
      console.error('Error fetching transfer history:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const getTransferType = (transaction: TransferRecord) => {
    if (transaction.transaction_type === 'transfer_received') return 'received'
    if (transaction.transaction_type === 'transfer_sent') return 'sent'
    if (transaction.description?.toLowerCase().includes('received')) return 'received'
    return 'sent'
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

  const getTransferIcon = (type: string) => {
    return type === 'received'
      ? <ArrowDown className="h-6 w-6 text-green-400" />
      : <Send className="h-6 w-6 text-blue-400" />
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

  const filteredTransfers = transfers.filter(transfer => {
    if (filter === 'all') return true
    if (filter === 'sent' || filter === 'received') {
      return getTransferType(transfer) === filter
    }
    return transfer.status === filter
  })

  const totalSent = transfers
    .filter(t => getTransferType(t) === 'sent' && t.status === 'completed')
    .reduce((sum, transfer) => sum + transfer.amount, 0)

  const totalReceived = transfers
    .filter(t => getTransferType(t) === 'received' && t.status === 'completed')
    .reduce((sum, transfer) => sum + transfer.amount, 0)

  const pendingTransfers = transfers.filter(t => t.status === 'pending').length

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
          <Link href="/dashboard/transfer" className="text-white hover:text-blue-300">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">Transfer History</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-4xl">
        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <Send className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-gray-300 text-sm">Total Sent</p>
                <p className="text-xl font-bold text-white">${totalSent.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <ArrowDown className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-gray-300 text-sm">Total Received</p>
                <p className="text-xl font-bold text-white">${totalReceived.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-gray-300 text-sm">Pending</p>
                <p className="text-xl font-bold text-white">{pendingTransfers}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'sent', 'received', 'completed', 'pending', 'failed'].map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === filterType
                ? 'bg-amber-800 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              {filterType !== 'all' && (
                <span className="ml-2 bg-white/20 px-2 py-1 rounded-full text-xs">
                  {filterType === 'sent' || filterType === 'received'
                    ? transfers.filter(t => getTransferType(t) === filterType).length
                    : transfers.filter(t => t.status === filterType).length
                  }
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Transfer Records */}
        <div className="space-y-4">
          {filteredTransfers.length === 0 ? (
            <div className="jarvis-card rounded-xl p-8 text-center">
              <Send className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {filter === 'all' ? 'No Transfer History' : `No ${filter} transfers`}
              </h3>
              <p className="text-gray-300 mb-4">
                {filter === 'all'
                  ? "You haven't made any transfers yet."
                  : `No ${filter} transfers found.`
                }
              </p>
              {filter === 'all' && (
                <Link
                  href="/dashboard/transfer"
                  className="jarvis-button px-6 py-2 rounded-lg text-white font-semibold"
                >
                  Make Transfer
                </Link>
              )}
            </div>
          ) : (
            filteredTransfers.map((transfer) => {
              const transferType = getTransferType(transfer)
              return (
                <div key={transfer.id} className="jarvis-card rounded-xl p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        {getTransferIcon(transferType)}
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-semibold text-white">
                              ${transfer.amount.toFixed(2)} USDT
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${transferType === 'received' ? 'bg-green-500/20 text-green-400' : 'bg-amber-800/20 text-amber-400'
                              }`}>
                              {transferType.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300">
                            Net: ${transfer.net_amount.toFixed(2)}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(transfer.status)}`}>
                          {transfer.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Transaction ID</p>
                          <p className="text-white font-mono text-xs">{transfer.id.slice(0, 8)}...</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Date</p>
                          <p className="text-white">{formatDate(transfer.created_at)}</p>
                        </div>
                        {transfer.from_wallet && (
                          <div>
                            <p className="text-gray-400">From Wallet</p>
                            <p className="text-white capitalize">{transfer.from_wallet}</p>
                          </div>
                        )}
                        {transfer.to_wallet && (
                          <div>
                            <p className="text-gray-400">To Wallet</p>
                            <p className="text-white capitalize">{transfer.to_wallet}</p>
                          </div>
                        )}
                        {transfer.description && (
                          <div className="md:col-span-2">
                            <p className="text-gray-400">Description</p>
                            <p className="text-white">{transfer.description}</p>
                          </div>
                        )}
                      </div>

                      {/* Status-specific information */}
                      {transfer.status === 'pending' && (
                        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <p className="text-yellow-400 text-sm">
                            ⏳ Transfer is being processed. This usually takes a few minutes.
                          </p>
                        </div>
                      )}

                      {transfer.status === 'failed' && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <p className="text-red-400 text-sm">
                            ❌ Transfer failed. Please check your balance and try again.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {getStatusIcon(transfer.status)}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Quick Action */}
        {transfers.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/dashboard/transfer"
              className="jarvis-button px-8 py-3 rounded-lg text-white font-semibold"
            >
              Make Another Transfer
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
