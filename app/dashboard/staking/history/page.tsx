'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, Coins, Calendar, Clock, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import DockNavbar from '@/components/DockNavbar'

interface StakingRecord {
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
}

export default function StakingHistoryPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [stakingRecords, setStakingRecords] = useState<StakingRecord[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchStakingHistory()
    }
  }, [user])

  const fetchStakingHistory = async () => {
    try {
      // For now, we'll fetch from transactions table where description contains 'Staking'
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .ilike('description', '%staking%')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform transaction data to staking records format
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
        created_at: transaction.created_at
      }))

      setStakingRecords(transformedData)
    } catch (error) {
      console.error('Error fetching staking history:', error)
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
          <Link href="/dashboard/staking" className="text-white hover:text-blue-300">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">Staking History</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-4xl">
        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <Coins className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-gray-300 text-sm">Total Staked</p>
                <p className="text-xl font-bold text-white">
                  ${stakingRecords.reduce((sum, record) => sum + record.amount, 0).toFixed(2)}
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
                  ${stakingRecords.reduce((sum, record) => sum + record.total_earned, 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-gray-300 text-sm">Active Stakes</p>
                <p className="text-xl font-bold text-white">
                  {stakingRecords.filter(record => record.status === 'active').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Staking Records */}
        <div className="space-y-4">
          {stakingRecords.length === 0 ? (
            <div className="jarvis-card rounded-xl p-8 text-center">
              <Coins className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Staking History</h3>
              <p className="text-gray-300 mb-4">You haven't made any staking transactions yet.</p>
              <Link
                href="/dashboard/staking"
                className="jarvis-button px-6 py-2 rounded-lg text-white font-semibold"
              >
                Start Staking
              </Link>
            </div>
          ) : (
            stakingRecords.map((record) => (
              <div key={record.id} className="jarvis-card rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Coins className="h-6 w-6 text-yellow-400" />
                      <h3 className="text-lg font-semibold text-white">
                        ${record.amount.toFixed(2)} USDT
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(record.status)}`}>
                        {record.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Period</p>
                        <p className="text-white font-semibold">{record.staking_period} Days</p>
                      </div>
                      <div>
                        <p className="text-gray-400">APY</p>
                        <p className="text-green-400 font-semibold">{record.apy}%</p>
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
                  </div>

                  <div className="text-right">
                    <p className="text-gray-400 text-sm">Total Earned</p>
                    <p className="text-2xl font-bold text-green-400">
                      ${record.total_earned.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
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
