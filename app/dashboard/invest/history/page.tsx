'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, TrendingUp, Calendar, DollarSign, CheckCircle, Clock, XCircle, Target } from 'lucide-react'
import Link from 'next/link'
import DockNavbar from '@/components/DockNavbar'

interface InvestmentRecord {
  id: string
  user_id: string
  plan_type: 'A' | 'B' | 'C'
  investment_amount: number
  daily_percentage: number
  total_profit_earned: number
  jarvis_tokens_earned: number
  is_active: boolean
  created_at: string
  maturity_date?: string
  status: 'active' | 'completed' | 'cancelled'
}

export default function InvestHistoryPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [investments, setInvestments] = useState<InvestmentRecord[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all')
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchInvestmentHistory()
    }
  }, [user])

  const fetchInvestmentHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('investment_plans')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform data to include status
      const transformedData = (data || []).map(investment => ({
        ...investment,
        status: investment.is_active ? 'active' : 'completed'
      }))

      setInvestments(transformedData)
    } catch (error) {
      console.error('Error fetching investment history:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const getPlanDetails = (planType: string) => {
    switch (planType) {
      case 'A':
        return { name: 'Starter Plan', color: 'text-green-400', bgColor: 'bg-green-500/20' }
      case 'B':
        return { name: 'Growth Plan', color: 'text-amber-400', bgColor: 'bg-amber-800/20' }
      case 'C':
        return { name: 'Premium Plan', color: 'text-purple-400', bgColor: 'bg-purple-500/20' }
      default:
        return { name: 'Unknown Plan', color: 'text-gray-400', bgColor: 'bg-gray-500/20' }
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Clock className="h-5 w-5 text-green-400" />
      case 'completed': return <CheckCircle className="h-5 w-5 text-blue-400" />
      case 'cancelled': return <XCircle className="h-5 w-5 text-red-400" />
      default: return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/20'
      case 'completed': return 'text-amber-400 bg-amber-800/20'
      case 'cancelled': return 'text-red-400 bg-red-500/20'
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

  const calculateROI = (investment: InvestmentRecord) => {
    if (investment.investment_amount === 0) return 0
    return ((investment.total_profit_earned / investment.investment_amount) * 100)
  }

  const filteredInvestments = investments.filter(investment =>
    filter === 'all' || investment.status === filter
  )

  const totalInvested = investments.reduce((sum, inv) => sum + inv.investment_amount, 0)
  const totalProfit = investments.reduce((sum, inv) => sum + (inv.total_profit_earned || 0), 0)
  const activeInvestments = investments.filter(inv => inv.status === 'active').length
  const totalTokensEarned = investments.reduce((sum, inv) => sum + (inv.jarvis_tokens_earned || 0), 0)

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
          <Link href="/dashboard/invest" className="text-white hover:text-blue-300">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold text-white">Trade History</h1>
          <div></div>
        </div>
      </header>

      <div className="container mx-auto p-4 max-w-4xl">
        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <DollarSign className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-gray-300 text-sm">Total Invested</p>
                <p className="text-xl font-bold text-white">${totalInvested.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <Target className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-gray-300 text-sm">Active Plans</p>
                <p className="text-xl font-bold text-white">{activeInvestments}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'active', 'completed', 'cancelled'].map((status) => (
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
                  {investments.filter(inv => inv.status === status).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Investment Records */}
        <div className="space-y-4">
          {filteredInvestments.length === 0 ? (
            <div className="jarvis-card rounded-xl p-8 text-center">
              <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {filter === 'all' ? 'No Investment History' : `No ${filter} investments`}
              </h3>
              <p className="text-gray-300 mb-4">
                {filter === 'all'
                  ? "You haven't made any investments yet."
                  : `No ${filter} investments found.`
                }
              </p>
              {filter === 'all' && (
                <Link
                  href="/dashboard/invest"
                  className="jarvis-button px-6 py-2 rounded-lg text-white font-semibold"
                >
                  Start Investing
                </Link>
              )}
            </div>
          ) : (
            filteredInvestments.map((investment) => {
              const planDetails = getPlanDetails(investment.plan_type)
              const roi = calculateROI(investment)

              return (
                <div key={investment.id} className="jarvis-card rounded-xl p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <TrendingUp className="h-6 w-6 text-blue-400" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-semibold text-white">
                              ${investment.investment_amount.toFixed(2)}
                            </h3>

                          </div>
                          <p className="text-sm text-gray-300">
                            Daily: {investment.daily_percentage}% • ROI: {roi.toFixed(1)}%
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(investment.status)}`}>
                          {investment.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Investment</p>
                          <p className="text-white font-semibold">${investment.investment_amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Profit Earned</p>
                          <p className="text-green-400 font-semibold">${(investment.total_profit_earned || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">JRC Coins</p>
                          <p className="text-yellow-400 font-semibold">{(investment.jarvis_tokens_earned || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Start Date</p>
                          <p className="text-white">{formatDate(investment.created_at)}</p>
                        </div>
                      </div>

                      {/* Progress Bar for Active Investments */}
                      {investment.status === 'active' && (
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">Progress</span>
                            <span className="text-white">{roi.toFixed(1)}% ROI</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(roi, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {/* Status-specific information */}
                      {investment.status === 'active' && (
                        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <p className="text-green-400 text-sm">
                            🚀 Investment is active and earning daily profits of {investment.daily_percentage}%
                          </p>
                        </div>
                      )}

                      {investment.status === 'completed' && (
                        <div className="mt-4 p-3 bg-amber-800/10 border border-amber-800/30 rounded-lg">
                          <p className="text-amber-400 text-sm">
                            ✅ Investment completed successfully. Total profit: ${(investment.total_profit_earned || 0).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end space-y-2">
                      {getStatusIcon(investment.status)}
                      <div className="text-right">
                        <p className="text-gray-400 text-sm">Total Return</p>
                        <p className="text-xl font-bold text-green-400">
                          ${(investment.investment_amount + (investment.total_profit_earned || 0)).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>


        {/* Quick Action */}
        {investments.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/dashboard/invest"
              className="jarvis-button px-8 py-3 rounded-lg text-white font-semibold"
            >
              Make New Investment
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
