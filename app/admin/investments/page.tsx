'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import {
  ArrowLeft,
  TrendingUp,
  Search,
  Filter,
  Eye,
  DollarSign,
  Calendar,
  Users
} from 'lucide-react'
import Link from 'next/link'

interface InvestmentPlan {
  id: string
  user_id: string
  plan_type: 'A' | 'B' | 'C'
  investment_amount: number
  daily_percentage: number
  jarvis_tokens_earned: number
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  maturity_date?: string
  total_earned: number
  user_email: string
  full_name: string
  is_expected_profit?: boolean
}

interface InvestmentStats {
  totalInvestments: number
  totalAmount: number
  activePlans: number
  completedPlans: number
  planACount: number
  planBCount: number
  planCCount: number
}

export default function InvestmentsManagement() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [investments, setInvestments] = useState<InvestmentPlan[]>([])
  const [filteredInvestments, setFilteredInvestments] = useState<InvestmentPlan[]>([])
  const [stats, setStats] = useState<InvestmentStats>({
    totalInvestments: 0,
    totalAmount: 0,
    activePlans: 0,
    completedPlans: 0,
    planACount: 0,
    planBCount: 0,
    planCCount: 0
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [planFilter, setPlanFilter] = useState<'all' | 'A' | 'B' | 'C'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all')
  const supabase = createSupabaseClient()
  const [isLoading, setIsLoading] = useState(true)

  const checkAdminAndFetch = useCallback(async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user?.id)
        .single()

      if (error || !profile?.is_admin) {
        router.push('/dashboard')
        return
      }

      await fetchInvestments()
    } catch (error) {
      console.error('Error checking admin access:', error)
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, supabase, router])

  const fetchInvestments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('investment_plans')
        .select(`
          *,
          profiles!inner(full_name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      console.log('Investment plans data:', data)

      // Fetch profit distributions for all investments
      const { data: profitData, error: profitError } = await supabase
        .from('profit_distributions')
        .select('plan_id, profit_amount')

      if (profitError) throw profitError

      console.log('Profit distributions data:', profitData)

      // Fetch user emails
      const userIds = data?.map(inv => inv.user_id) || []
      let emailMap: { [key: string]: string } = {}

      if (userIds.length > 0) {
        try {
          const emailResponse = await fetch('/api/admin/get-user-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds })
          })
          const emailData = await emailResponse.json()
          if (emailData.success) {
            emailMap = emailData.users.reduce((acc: any, user: any) => {
              acc[user.id] = user.email
              return acc
            }, {})
          }
        } catch (error) {
          console.error('Error fetching emails:', error)
        }
      }

      const formattedInvestments = data?.map(inv => {
        // Calculate total earned from profit_distributions table
        const investmentProfits = profitData?.filter(profit => profit.plan_id === inv.id) || []
        const totalEarnedFromProfits = investmentProfits.reduce((sum, profit) => sum + (profit.profit_amount || 0), 0)

        // Calculate expected profits based on time elapsed (for display purposes)
        const createdAt = new Date(inv.created_at)
        const now = new Date()
        const daysSinceCreation = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))
        const dailyProfitRate = inv.daily_percentage / 100
        const expectedTotalProfit = daysSinceCreation * inv.investment_amount * dailyProfitRate

        // Use the maximum of: distributed profits, stored total, or expected profit
        const actualProfit = Math.max(totalEarnedFromProfits, inv.total_profit_earned || 0)
        const displayProfit = Math.max(actualProfit, expectedTotalProfit)
        const isExpectedProfit = displayProfit > actualProfit

        console.log(`Investment ${inv.id}: days since creation: ${daysSinceCreation}, expected: $${expectedTotalProfit.toFixed(2)}, actual: $${actualProfit.toFixed(2)}, display: $${displayProfit.toFixed(2)}, isExpected: ${isExpectedProfit}`)

        return {
          id: inv.id,
          user_id: inv.user_id,
          plan_type: inv.plan_type,
          investment_amount: inv.investment_amount,
          daily_percentage: inv.daily_percentage,
          jarvis_tokens_earned: inv.jarvis_tokens_earned || 0,
          status: inv.is_active ? 'active' : 'completed',
          created_at: inv.created_at,
          maturity_date: inv.maturity_date,
          total_earned: displayProfit,
          user_email: emailMap[inv.user_id] || inv.user_id,
          full_name: inv.profiles.full_name,
          is_expected_profit: isExpectedProfit
        } as InvestmentPlan
      }) || []

      setInvestments(formattedInvestments)

      // Calculate stats
      const totalInvestments = formattedInvestments.length
      const totalAmount = formattedInvestments.reduce((sum, inv) => sum + inv.investment_amount, 0)
      const activePlans = formattedInvestments.filter(inv => inv.status === 'active').length
      const completedPlans = formattedInvestments.filter(inv => inv.status === 'completed').length
      const planACount = formattedInvestments.filter(inv => inv.plan_type === 'A').length
      const planBCount = formattedInvestments.filter(inv => inv.plan_type === 'B').length
      const planCCount = formattedInvestments.filter(inv => inv.plan_type === 'C').length

      setStats({
        totalInvestments,
        totalAmount,
        activePlans,
        completedPlans,
        planACount,
        planBCount,
        planCCount
      })

    } catch (error) {
      console.error('Error fetching investments:', error)
    }
  }, [supabase])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    } else if (user) {
      checkAdminAndFetch()
    }
  }, [user, loading, checkAdminAndFetch])

  useEffect(() => {
    filterInvestments()
  }, [investments, searchTerm, planFilter, statusFilter])

  const filterInvestments = () => {
    let filtered = investments

    if (planFilter !== 'all') {
      filtered = filtered.filter(inv => inv.plan_type === planFilter)
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(inv =>
        (inv.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (inv.user_email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      )
    }

    setFilteredInvestments(filtered)
  }

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'A': return 'text-green-400 bg-green-400/20'
      case 'B': return 'text-blue-400 bg-blue-400/20'
      case 'C': return 'text-purple-400 bg-purple-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/20'
      case 'completed': return 'text-blue-400 bg-blue-400/20'
      case 'cancelled': return 'text-red-400 bg-red-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  if (loading || isLoading) {
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
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="text-white hover:text-blue-300">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-2xl font-bold text-white">Investment Management</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Investments</p>
                <p className="text-2xl font-bold text-white">{stats.totalInvestments}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Amount</p>
                <p className="text-2xl font-bold text-green-400">${stats.totalAmount.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Plans</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.activePlans}</p>
              </div>
              <Calendar className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Completed</p>
                <p className="text-2xl font-bold text-purple-400">{stats.completedPlans}</p>
              </div>
              <Users className="h-8 w-8 text-purple-400" />
            </div>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              <p className="text-white font-semibold">Plan A</p>
            </div>
            <p className="text-gray-400 text-sm">$1 - $50 • 2% Daily</p>
            <p className="text-xl font-bold text-green-400">{stats.planACount} investments</p>
            <p className="text-gray-400 text-xs mt-1">1,000 JRV tokens per investment</p>
          </div>
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
              <p className="text-white font-semibold">Plan B</p>
            </div>
            <p className="text-gray-400 text-sm">$51 - $500 • 4% Daily</p>
            <p className="text-xl font-bold text-blue-400">{stats.planBCount} investments</p>
            <p className="text-gray-400 text-xs mt-1">10,000 JRV tokens per investment</p>
          </div>
          <div className="jarvis-card rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
              <p className="text-white font-semibold">Plan C</p>
            </div>
            <p className="text-gray-400 text-sm">$500 - $50,000 • 3% Daily</p>
            <p className="text-xl font-bold text-purple-400">{stats.planCCount} investments</p>
            <p className="text-gray-400 text-xs mt-1">100,000 JRV tokens per investment</p>
          </div>
        </div>

        {/* Investment Plan Details */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4">Investment Plan Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-400 rounded-full"></div>
                <h4 className="text-white font-semibold">Plan A - Starter</h4>
              </div>
              <div className="text-sm space-y-1">
                <p className="text-gray-300"><span className="text-white">Range:</span> $1 - $50</p>
                <p className="text-gray-300"><span className="text-white">Daily ROI:</span> 2%</p>
                <p className="text-gray-300"><span className="text-white">JRV Tokens:</span> 1,000 per investment</p>
                <p className="text-gray-300"><span className="text-white">Duration:</span> Unlimited</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
                <h4 className="text-white font-semibold">Plan B - Growth</h4>
              </div>
              <div className="text-sm space-y-1">
                <p className="text-gray-300"><span className="text-white">Range:</span> $51 - $500</p>
                <p className="text-gray-300"><span className="text-white">Daily ROI:</span> 4%</p>
                <p className="text-gray-300"><span className="text-white">JRV Tokens:</span> 10,000 per investment</p>
                <p className="text-gray-300"><span className="text-white">Duration:</span> Unlimited</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-purple-400 rounded-full"></div>
                <h4 className="text-white font-semibold">Plan C - Premium</h4>
              </div>
              <div className="text-sm space-y-1">
                <p className="text-gray-300"><span className="text-white">Range:</span> $500 - $50,000</p>
                <p className="text-gray-300"><span className="text-white">Daily ROI:</span> 3%</p>
                <p className="text-gray-300"><span className="text-white">JRV Tokens:</span> 100,000 per investment</p>
                <p className="text-gray-300"><span className="text-white">Duration:</span> Unlimited</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search by full name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Filter className="text-gray-400 h-5 w-5" />
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value as any)}
                className="bg-white/10 border border-white/20 rounded-lg text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Plans</option>
                <option value="A">Plan A</option>
                <option value="B">Plan B</option>
                <option value="C">Plan C</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white/10 border border-white/20 rounded-lg text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Investments Table */}
        <div className="jarvis-card rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Investment Plans</h2>

          {filteredInvestments.length === 0 ? (
            <div className="text-center py-8">
              <Eye className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-300">No investments found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvestments.map((investment) => (
                <div key={investment.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-3">
                        <div>
                          <p className="text-white font-semibold">{investment.full_name || 'N/A'}</p>
                          <p className="text-gray-400 text-sm">{investment.user_email}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getPlanColor(investment.plan_type)}`}>
                          Plan {investment.plan_type}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(investment.status)}`}>
                          {investment.status}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Investment</p>
                          <p className="text-white font-semibold">${investment.investment_amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Daily %</p>
                          <p className="text-green-400">{investment.daily_percentage}%</p>
                        </div>
                        <div>
                          <p className="text-gray-400">JRV Tokens</p>
                          <p className="text-yellow-400">{investment.jarvis_tokens_earned.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Total Earned</p>
                          <div className="flex items-center space-x-2">
                            <p className="text-blue-400">${investment.total_earned.toFixed(2)}</p>
                            {investment.is_expected_profit && (
                              <span className="text-xs text-yellow-400 bg-yellow-400/20 px-2 py-1 rounded" title="Expected profit based on time elapsed">
                                Est.
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-400">Started</p>
                          <p className="text-white">{new Date(investment.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
