'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, Coins, Calendar, Clock, TrendingUp, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import DockNavbar from '@/components/DockNavbar'

interface JRCStakingRecord {
  id: string
  user_id: string
  amount: number
  staking_period: number
  apy: number
  start_date: string
  end_date: string
  status: 'active' | 'completed' | 'withdrawn'
  total_earned: number
  created_at: string
  rewards_claimed: number
}

export default function JRCStakingHistoryPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [stakingRecords, setStakingRecords] = useState<JRCStakingRecord[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'withdrawn'>('all')
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchJRCStakingHistory()
    }
  }, [user])

  const fetchJRCStakingHistory = async () => {
    try {
      // For now, we'll fetch from transactions table where description contains 'JRC Staking'
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .ilike('description', '%JRC%staking%')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform transaction data to JRC staking records format
      const transformedData = (data || []).map(transaction => ({
        id: transaction.id,
        user_id: transaction.user_id,
        amount: transaction.amount,
        staking_period: extractStakingPeriod(transaction.description),
        apy: extractAPY(transaction.description),
        start_date: transaction.created_at,
        end_date: calculateEndDate(transaction.created_at, extractStakingPeriod(transaction.description)),
        status: determineStatus(transaction.created_at, extractStakingPeriod(transaction.description)),
        total_earned: 0, // This would need to be calculated based on actual staking logic
        created_at: transaction.created_at,
        rewards_claimed: 0
      }))

      setStakingRecords(transformedData)
    } catch (error) {
      console.error('Error fetching JRC staking history:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const extractStakingPeriod = (description: string): number => {
    const match = description.match(/(\d+)\s*Days?/i)
    return match ? parseInt(match[1]) : 30
  }

  const extractAPY = (description: string): number => {
    const match = description.match(/(\d+)%\s*APY/i)
    return match ? parseInt(match[1]) : 0
  }

  const calculateEndDate = (startDate: string, period: number): string => {
    const start = new Date(startDate)
    const end = new Date(start.getTime() + (period * 24 * 60 * 60 * 1000))
    return end.toISOString()
  }

  const determineStatus = (startDate: string, period: number): 'active' | 'completed' | 'withdrawn' => {
    const start = new Date(startDate)
    const end = new Date(start.getTime() + (period * 24 * 60 * 60 * 1000))
    const now = new Date()

    if (now < end) return 'active'
    return 'completed'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Clock className="h-5 w-5 text-green-400" />
      case 'completed': return <CheckCircle className="h-5 w-5 text-blue-400" />
      case 'withdrawn': return <XCircle className="h-5 w-5 text-gray-400" />
      default: return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/20'
      case 'completed': return 'text-amber-400 bg-amber-800/20'
      case 'withdrawn': return 'text-gray-400 bg-gray-500/20'
      default: return 'text-gray-400 bg-gray-500/20'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const calculateProgress = (startDate: string, endDate: string) => {
    const start = new Date(startDate).getTime()
    const end = new Date(endDate).getTime()
    const now = Date.now()

    if (now >= end) return 100
    if (now <= start) return 0

    return ((now - start) / (end - start)) * 100
  }

  const filteredRecords = stakingRecords.filter(record =>
    filter === 'all' || record.status === filter
  )

  const totalStaked = stakingRecords.reduce((sum, record) => sum + record.amount, 0)
  const totalEarned = stakingRecords.reduce((sum, record) => sum + record.total_earned, 0)
  const activeStakes = stakingRecords.filter(record => record.status === 'active').length

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
          <Link href="/dashboard/bnx-staking" className="text-white hover:text-blue-300">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">JRC Staking History</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-4xl">
        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <Coins className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-gray-300 text-sm">Total Staked</p>
                <p className="text-xl font-bold text-white">
                  {totalStaked.toLocaleString()} JRV
                </p>
              </div>
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-gray-300 text-sm">Total Earned</p>
                <p className="text-xl font-bold text-white">
                  {totalEarned.toLocaleString()} JRV
                </p>
              </div>
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-gray-300 text-sm">Active Stakes</p>
                <p className="text-xl font-bold text-white">{activeStakes}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'active', 'completed', 'withdrawn'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === status
                ? 'bg-orange-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className="ml-2 bg-white/20 px-2 py-1 rounded-full text-xs">
                  {stakingRecords.filter(record => record.status === status).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Staking Records */}
        <div className="space-y-4">
          {filteredRecords.length === 0 ? (
            <div className="jarvis-card rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Coins className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {filter === 'all' ? 'No JRV Staking History' : `No ${filter} JRV stakes`}
              </h3>
              <p className="text-gray-300 mb-4">
                {filter === 'all'
                  ? "You haven't staked any JRV tokens yet."
                  : `No JRV stakes with ${filter} status found.`
                }
              </p>
              {filter === 'all' && (
                <Link
                  href="/dashboard/bnx-staking"
                  className="jarvis-button px-6 py-2 rounded-lg text-white font-semibold"
                >
                  Start JRV Staking
                </Link>
              )}
            </div>
          ) : (
            filteredRecords.map((record) => {
              const progress = calculateProgress(record.start_date, record.end_date)

              return (
                <div key={record.id} className="jarvis-card rounded-xl p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                          <Coins className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {record.amount.toLocaleString()} JRV
                          </h3>
                          <p className="text-sm text-gray-300">
                            {record.staking_period} Days • {record.apy}% APY
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(record.status)}`}>
                          {record.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-gray-400">Staked Amount</p>
                          <p className="text-yellow-400 font-semibold">{record.amount.toLocaleString()} JRV</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Period</p>
                          <p className="text-white font-semibold">{record.staking_period} Days</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Start Date</p>
                          <p className="text-white">{formatDate(record.start_date)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">End Date</p>
                          <p className="text-white">{formatDate(record.end_date)}</p>
                        </div>
                      </div>

                      {/* Progress Bar for Active Stakes */}
                      {record.status === 'active' && (
                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">Staking Progress</span>
                            <span className="text-white">{progress.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Status-specific information */}
                      {record.status === 'active' && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <p className="text-green-400 text-sm">
                            🚀 JRV staking is active and earning {record.apy}% APY. Rewards are distributed daily.
                          </p>
                        </div>
                      )}

                      {record.status === 'completed' && (
                        <div className="p-3 bg-amber-800/10 border border-amber-800/30 rounded-lg">
                          <p className="text-amber-400 text-sm">
                            ✅ Staking period completed. Total earned: {record.total_earned.toLocaleString()} JRV
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end space-y-2">
                      {getStatusIcon(record.status)}
                      <div className="text-right">
                        <p className="text-gray-400 text-sm">Rewards Earned</p>
                        <p className="text-2xl font-bold text-yellow-400">
                          {record.total_earned.toLocaleString()} JRV
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Performance Summary */}
        {stakingRecords.length > 0 && (
          <div className="mt-8 jarvis-card rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mr-3">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              JRV Staking Performance
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-gray-400 text-sm">Average APY</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {stakingRecords.length > 0
                    ? (stakingRecords.reduce((sum, r) => sum + r.apy, 0) / stakingRecords.length).toFixed(1)
                    : '0'
                  }%
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Total Portfolio</p>
                <p className="text-2xl font-bold text-white">
                  {(totalStaked + totalEarned).toLocaleString()} JRV
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Staking Yield</p>
                <p className="text-2xl font-bold text-green-400">
                  {totalStaked > 0 ? ((totalEarned / totalStaked) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Action */}
        {stakingRecords.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/dashboard/bnx-staking"
              className="jarvis-button px-8 py-3 rounded-lg text-white font-semibold"
            >
              Stake More JRV
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
