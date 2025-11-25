'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import {
  ArrowLeft,
  Users,
  Search,
  Filter,
  Edit,
  Ban,
  CheckCircle,
  XCircle,
  Eye,
  Wallet,
  TrendingUp,
  Plus,
  DollarSign,
  Minus,
  Coins,
  UserMinus
} from 'lucide-react'
import Link from 'next/link'

interface UserProfile {
  id: string
  user_email: string // Changed from email to user_email
  full_name: string | null
  referral_code: string | null
  sponsor_id?: string
  main_wallet_balance: number
  fund_wallet_balance: number
  total_jarvis_tokens: number
  is_admin: boolean
  is_banned: boolean
  created_at: string
  last_sign_in_at?: string
  total_investments: number
  total_withdrawals: number
  referral_count: number
  usdt_team_volume: number
}

export default function UsersManagement() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned' | 'admin'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [showAddFundsModal, setShowAddFundsModal] = useState(false)
  const [addFundsUser, setAddFundsUser] = useState<UserProfile | null>(null)
  const [addFundsAmount, setAddFundsAmount] = useState('')
  const [addFundsNotes, setAddFundsNotes] = useState('')
  const [isAddingFunds, setIsAddingFunds] = useState(false)

  // Deduct Funds Modal State
  const [showDeductFundsModal, setShowDeductFundsModal] = useState(false)
  const [deductFundsUser, setDeductFundsUser] = useState<UserProfile | null>(null)
  const [deductFundsAmount, setDeductFundsAmount] = useState('')
  const [deductFundsNotes, setDeductFundsNotes] = useState('')
  const [isDeductingFunds, setIsDeductingFunds] = useState(false)

  // Jarvis Token Management Modal State
  const [showJarvisModal, setShowJarvisModal] = useState(false)
  const [jarvisUser, setJarvisUser] = useState<UserProfile | null>(null)
  const [jarvisAmount, setJarvisAmount] = useState('')
  const [jarvisNotes, setJarvisNotes] = useState('')
  const [jarvisAction, setJarvisAction] = useState<'add' | 'deduct'>('add')
  const [isManagingJarvis, setIsManagingJarvis] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [usersPerPage] = useState(50)

  const supabase = createSupabaseClient()

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

      await fetchUsers()
    } catch (error) {
      console.error('Error checking admin access:', error)
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, supabase, router])

  const fetchUsers = useCallback(async () => {
    try {
      // Fetch users with aggregated data
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (usersError) throw usersError

      // Fetch user emails from API endpoint
      const userIds = usersData?.map(user => user.id) || []
      let emailMap = new Map<string, { email?: string; last_sign_in_at?: string }>()

      try {
        const emailResponse = await fetch('/api/admin/get-user-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds })
        })

        if (emailResponse.ok) {
          const emailData = await emailResponse.json()
          emailMap = new Map(emailData.users?.map((user: any) => [
            user.id,
            { email: user.email, last_sign_in_at: user.last_sign_in_at }
          ]) || [])
        }
      } catch (error) {
        console.warn('Could not fetch user emails:', error)
      }

      // Fetch investment totals
      const { data: investmentData, error: investmentError } = await supabase
        .from('investment_plans')
        .select('user_id, investment_amount')

      if (investmentError) throw investmentError

      // Fetch withdrawal totals
      const { data: withdrawalData, error: withdrawalError } = await supabase
        .from('withdrawal_requests')
        .select('user_id, amount')
        .eq('status', 'approved')

      if (withdrawalError) throw withdrawalError

      // Create optimized lookup maps for investments and withdrawals
      const investmentMap = new Map()
      investmentData?.forEach(inv => {
        const userId = inv.user_id
        const currentTotal = investmentMap.get(userId) || 0
        investmentMap.set(userId, currentTotal + (inv.investment_amount || 0))
      })

      const withdrawalMap = new Map()
      withdrawalData?.forEach(wd => {
        const userId = wd.user_id
        const currentTotal = withdrawalMap.get(userId) || 0
        withdrawalMap.set(userId, currentTotal + (wd.amount || 0))
      })

      // Debug logging
      console.log('Investment data sample:', investmentData?.slice(0, 3))
      console.log('Investment map size:', investmentMap.size)
      console.log('Users data sample:', usersData?.slice(0, 3)?.map(u => ({ id: u.id, referral_code: u.referral_code, sponsor_id: u.sponsor_id })))
      console.log('Total users:', usersData?.length)

      // Fetch referral counts efficiently using RPC or aggregation
      const { data: referralCounts, error: referralError } = await supabase
        .rpc('get_referral_counts')

      // Calculate USDT team volume for each user
      const calculateTeamVolume = (userId: string, userReferralCode: string) => {
        if (!userReferralCode) return 0

        // Get all team members - try both possible relationships
        // Method 1: sponsor_id matches referral_code
        let teamMembers = usersData?.filter(u => u.sponsor_id === userReferralCode) || []

        // Method 2: If no results, try sponsor_id matches userId (fallback)
        if (teamMembers.length === 0) {
          teamMembers = usersData?.filter(u => u.sponsor_id === userId) || []
        }

        // Calculate total investments of team members
        let teamVolume = 0
        teamMembers.forEach(member => {
          const memberInvestment = investmentMap.get(member.id) || 0
          teamVolume += memberInvestment

          // Recursively calculate volume from sub-teams (multi-level)
          if (member.referral_code) {
            const subTeamVolume = calculateSubTeamVolume(member.id, member.referral_code)
            teamVolume += subTeamVolume
          }
        })

        // Debug logging for users with team members
        if (teamMembers.length > 0) {
          console.log(`User ${userId} (${userReferralCode}) has ${teamMembers.length} team members with total volume: $${teamVolume}`)
          console.log('Team members:', teamMembers.map(m => ({ id: m.id, referral_code: m.referral_code, investment: investmentMap.get(m.id) || 0 })))
        }

        return teamVolume
      }

      const calculateSubTeamVolume = (userId: string, userReferralCode: string): number => {
        if (!userReferralCode) return 0

        // Get sub-team members using referral_code
        let subTeamMembers = usersData?.filter(u => u.sponsor_id === userReferralCode) || []

        // Fallback to userId if no results
        if (subTeamMembers.length === 0) {
          subTeamMembers = usersData?.filter(u => u.sponsor_id === userId) || []
        }

        let subVolume = 0

        subTeamMembers.forEach(member => {
          const memberInvestment = investmentMap.get(member.id) || 0
          subVolume += memberInvestment
          // Recursive call for deeper levels
          if (member.referral_code) {
            subVolume += calculateSubTeamVolume(member.id, member.referral_code)
          }
        })

        return subVolume
      }

      if (referralError) {
        console.warn('RPC get_referral_counts not available, using fallback method')
        // Fallback: Create a map of referral counts
        const { data: referralData, error: fallbackError } = await supabase
          .from('profiles')
          .select('sponsor_id')
          .not('sponsor_id', 'is', null)

        if (fallbackError) throw fallbackError

        // Create referral count map
        const referralCountMap = new Map()
        referralData?.forEach(ref => {
          if (ref.sponsor_id) {
            referralCountMap.set(ref.sponsor_id, (referralCountMap.get(ref.sponsor_id) || 0) + 1)
          }
        })

        // Process data with optimized lookups
        var processedUsers = usersData?.map((user, index) => {
          const authData = emailMap.get(user.id)
          const teamVolume = calculateTeamVolume(user.id, user.referral_code)

          // Debug log for first few users
          if (index < 5) {
            console.log(`Processing user ${index + 1}:`, {
              id: user.id,
              referral_code: user.referral_code,
              sponsor_id: user.sponsor_id,
              own_investment: investmentMap.get(user.id) || 0,
              team_volume: teamVolume
            })
          }

          return {
            ...user,
            user_email: authData?.email || user.id, // Use email from auth.users or fallback to user_id
            last_sign_in_at: authData?.last_sign_in_at,
            total_investments: investmentMap.get(user.id) || 0,
            total_withdrawals: withdrawalMap.get(user.id) || 0,
            referral_count: referralCountMap.get(user.referral_code) || 0,
            usdt_team_volume: teamVolume
          }
        }) || []
      } else {
        // Use RPC result if available
        const referralCountMap = new Map(referralCounts?.map((rc: { referral_code: string; count: number }) => [rc.referral_code, rc.count]) || [])

        var processedUsers = usersData?.map((user, index) => {
          const authData = emailMap.get(user.id)
          const teamVolume = calculateTeamVolume(user.id, user.referral_code)

          // Debug log for first few users
          if (index < 5) {
            console.log(`Processing user ${index + 1} (RPC branch):`, {
              id: user.id,
              referral_code: user.referral_code,
              sponsor_id: user.sponsor_id,
              own_investment: investmentMap.get(user.id) || 0,
              team_volume: teamVolume
            })
          }

          return {
            ...user,
            user_email: authData?.email || user.id, // Use email from auth.users or fallback to user_id
            last_sign_in_at: authData?.last_sign_in_at,
            total_investments: investmentMap.get(user.id) || 0,
            total_withdrawals: withdrawalMap.get(user.id) || 0,
            referral_count: referralCountMap.get(user.referral_code) || 0,
            usdt_team_volume: teamVolume
          }
        }) || []
      }

      setUsers(processedUsers)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }, [supabase])

  // Check admin access and fetch users when component mounts or user changes
  useEffect(() => {
    if (!loading && user) {
      checkAdminAndFetch()
    }
  }, [loading, user, checkAdminAndFetch])

  // Filter users based on search and status
  useEffect(() => {
    let filtered = users

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.referral_code?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => {
        switch (statusFilter) {
          case 'active':
            return !user.is_banned && !user.is_admin
          case 'banned':
            return user.is_banned
          case 'admin':
            return user.is_admin
          default:
            return true
        }
      })
    }

    setFilteredUsers(filtered)
    // Reset to first page when filters change
    setCurrentPage(1)
  }, [users, searchTerm, statusFilter])

  const handleUserAction = async (userId: string, action: 'ban' | 'unban' | 'make_admin' | 'remove_admin') => {
    try {
      let updateData: any = {}

      switch (action) {
        case 'ban':
          updateData = { is_banned: true }
          break
        case 'unban':
          updateData = { is_banned: false }
          break
        case 'make_admin':
          updateData = { is_admin: true }
          break
        case 'remove_admin':
          updateData = { is_admin: false }
          break
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)

      if (error) throw error

      await fetchUsers()
      const actionText = action === 'remove_admin' ? 'removed admin privileges from' : action.replace('_', ' ') + 'ned'
      alert(`User ${actionText} successfully!`)
    } catch (error) {
      console.error(`Error ${action}ning user:`, error)
      alert(`Failed to ${action} user`)
    }
  }

  const openUserModal = (user: UserProfile) => {
    setSelectedUser(user)
    setShowUserModal(true)
  }

  const openAddFundsModal = (user: UserProfile) => {
    setAddFundsUser(user)
    setAddFundsAmount('')
    setAddFundsNotes('')
    setShowAddFundsModal(true)
  }

  const closeAddFundsModal = () => {
    setShowAddFundsModal(false)
    setAddFundsUser(null)
    setAddFundsAmount('')
    setAddFundsNotes('')
  }

  const handleAddFunds = async () => {
    if (!addFundsUser || !addFundsAmount) {
      alert('Please enter an amount')
      return
    }

    const amount = parseFloat(addFundsAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive amount')
      return
    }

    setIsAddingFunds(true)
    try {
      const response = await fetch('/api/admin/add-funds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: addFundsUser.id,
          amount: amount,
          adminNotes: addFundsNotes || `Manual fund addition of $${amount} by admin`
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        alert(`Successfully added $${amount} to ${addFundsUser.full_name || 'user'}'s wallet!`)
        closeAddFundsModal()
        await fetchUsers() // Refresh the users list
      } else {
        alert(`Failed to add funds: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error adding funds:', error)
      alert('Failed to add funds. Please try again.')
    } finally {
      setIsAddingFunds(false)
    }
  }

  // Deduct Funds Modal Functions
  const openDeductFundsModal = (user: UserProfile) => {
    setDeductFundsUser(user)
    setDeductFundsAmount('')
    setDeductFundsNotes('')
    setShowDeductFundsModal(true)
  }

  const closeDeductFundsModal = () => {
    setShowDeductFundsModal(false)
    setDeductFundsUser(null)
    setDeductFundsAmount('')
    setDeductFundsNotes('')
  }

  const handleDeductFunds = async () => {
    if (!deductFundsUser || !deductFundsAmount) {
      alert('Please enter an amount')
      return
    }

    const amount = parseFloat(deductFundsAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive amount')
      return
    }

    if (amount > deductFundsUser.main_wallet_balance) {
      alert('Cannot deduct more than the current wallet balance')
      return
    }

    setIsDeductingFunds(true)
    try {
      const response = await fetch('/api/admin/deduct-funds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: deductFundsUser.id,
          amount: amount,
          adminNotes: deductFundsNotes || `Manual fund deduction of $${amount} by admin`
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        alert(`Successfully deducted $${amount} from ${deductFundsUser.full_name || 'user'}'s wallet!`)
        closeDeductFundsModal()
        await fetchUsers() // Refresh the users list
      } else {
        alert(`Failed to deduct funds: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deducting funds:', error)
      alert('Failed to deduct funds. Please try again.')
    } finally {
      setIsDeductingFunds(false)
    }
  }

  // Jarvis Token Management Modal Functions
  const openJarvisModal = (user: UserProfile, action: 'add' | 'deduct') => {
    setJarvisUser(user)
    setJarvisAmount('')
    setJarvisNotes('')
    setJarvisAction(action)
    setShowJarvisModal(true)
  }

  const closeJarvisModal = () => {
    setShowJarvisModal(false)
    setJarvisUser(null)
    setJarvisAmount('')
    setJarvisNotes('')
    setJarvisAction('add')
  }

  const handleJarvisTokens = async () => {
    if (!jarvisUser || !jarvisAmount) {
      alert('Please enter an amount')
      return
    }

    const amount = parseInt(jarvisAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive amount')
      return
    }

    if (jarvisAction === 'deduct' && amount > (jarvisUser.total_jarvis_tokens || 0)) {
      alert('Cannot deduct more than the current token balance')
      return
    }

    setIsManagingJarvis(true)
    try {
      const response = await fetch('/api/admin/manage-jarvis-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: jarvisUser.id,
          amount: amount,
          action: jarvisAction,
          adminNotes: jarvisNotes || `Manual ${jarvisAction} of ${amount} JRV tokens by admin`
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        alert(`Successfully ${jarvisAction === 'add' ? 'added' : 'deducted'} ${amount} JRV tokens ${jarvisAction === 'add' ? 'to' : 'from'} ${jarvisUser.full_name || 'user'}!`)
        closeJarvisModal()
        await fetchUsers() // Refresh the users list
      } else {
        alert(`Failed to ${jarvisAction} tokens: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error managing jarvis tokens:', error)
      alert('Failed to manage tokens. Please try again.')
    } finally {
      setIsManagingJarvis(false)
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
            <h1 className="text-2xl font-bold text-white">User Management</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {/* Filters */}
        <div className="jarvis-card rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search by full name, email, or referral code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Filter className="text-gray-400 h-5 w-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white/10 border border-white/20 rounded-lg text-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Users</option>
                <option value="active">Active Users</option>
                <option value="banned">Banned Users</option>
                <option value="admin">Administrators</option>
              </select>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="jarvis-card rounded-xl p-4">
            <p className="text-gray-400 text-sm">Total Users</p>
            <p className="text-2xl font-bold text-white">{users.length}</p>
          </div>
          <div className="jarvis-card rounded-xl p-4">
            <p className="text-gray-400 text-sm">Active Users</p>
            <p className="text-2xl font-bold text-green-400">
              {users.filter(u => !u.is_banned && !u.is_admin).length}
            </p>
          </div>
          <div className="jarvis-card rounded-xl p-4">
            <p className="text-gray-400 text-sm">Banned Users</p>
            <p className="text-2xl font-bold text-red-400">
              {users.filter(u => u.is_banned).length}
            </p>
          </div>
          <div className="jarvis-card rounded-xl p-4">
            <p className="text-gray-400 text-sm">Administrators</p>
            <p className="text-2xl font-bold text-purple-400">
              {users.filter(u => u.is_admin).length}
            </p>
          </div>
        </div>

        {/* Users Table */}
        <div className="jarvis-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Users</h2>
            {filteredUsers.length > 0 && (
              <div className="text-gray-300 text-sm">
                Showing {((currentPage - 1) * usersPerPage) + 1}-{Math.min(currentPage * usersPerPage, filteredUsers.length)} of {filteredUsers.length} users
              </div>
            )}
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-300">No users found</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {filteredUsers
                  .slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage)
                  .map((userProfile) => (
                    <div key={userProfile.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4 mb-3">
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="text-white font-semibold">{userProfile.full_name || 'N/A'}</p>
                                {userProfile.is_admin && (
                                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full">Admin</span>
                                )}
                                {userProfile.is_banned && (
                                  <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">Banned</span>
                                )}
                              </div>
                              <p className="text-gray-400 text-sm">{userProfile.user_email || 'N/A'}</p>
                              <p className="text-gray-400 text-xs">ID: {userProfile.referral_code || 'N/A'}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                            <div>
                              <p className="text-gray-400">Main Wallet</p>
                              <p className="text-white font-semibold">${userProfile.main_wallet_balance.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Fund Wallet</p>
                              <p className="text-white">${userProfile.fund_wallet_balance.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">JRV Tokens</p>
                              <p className="text-yellow-400">{(userProfile.total_jarvis_tokens || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Investments</p>
                              <p className="text-green-400">${userProfile.total_investments.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Team Volume</p>
                              <p className="text-purple-400">${userProfile.usdt_team_volume.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Referrals</p>
                              <p className="text-blue-400">{userProfile.referral_count}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openUserModal(userProfile)}
                            className="bg-amber-900 hover:bg-amber-950 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                          >
                            <Eye className="h-4 w-4" />
                            <span>View</span>
                          </button>

                          <button
                            onClick={() => openAddFundsModal(userProfile)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Add Funds</span>
                          </button>

                          <button
                            onClick={() => openDeductFundsModal(userProfile)}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                          >
                            <Minus className="h-4 w-4" />
                            <span>Deduct Funds</span>
                          </button>

                          <button
                            onClick={() => openJarvisModal(userProfile, 'add')}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                          >
                            <Coins className="h-4 w-4" />
                            <span>Add JRV</span>
                          </button>

                          <button
                            onClick={() => openJarvisModal(userProfile, 'deduct')}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                          >
                            <Minus className="h-4 w-4" />
                            <span>Deduct JRV</span>
                          </button>

                          {userProfile.is_admin ? (
                            <button
                              onClick={() => handleUserAction(userProfile.id, 'remove_admin')}
                              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                            >
                              <UserMinus className="h-4 w-4" />
                              <span>Unadmin</span>
                            </button>
                          ) : (
                            <>
                              {userProfile.is_banned ? (
                                <button
                                  onClick={() => handleUserAction(userProfile.id, 'unban')}
                                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  <span>Unban</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUserAction(userProfile.id, 'ban')}
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                                >
                                  <Ban className="h-4 w-4" />
                                  <span>Ban</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleUserAction(userProfile.id, 'make_admin')}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg flex items-center space-x-1"
                              >
                                <Edit className="h-4 w-4" />
                                <span>Admin</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Pagination Controls */}
              {filteredUsers.length > usersPerPage && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>

                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.ceil(filteredUsers.length / usersPerPage) }, (_, i) => i + 1)
                        .filter(page => {
                          const totalPages = Math.ceil(filteredUsers.length / usersPerPage)
                          if (totalPages <= 7) return true
                          if (page === 1 || page === totalPages) return true
                          if (page >= currentPage - 2 && page <= currentPage + 2) return true
                          return false
                        })
                        .map((page, index, array) => {
                          const prevPage = array[index - 1]
                          const showEllipsis = prevPage && page - prevPage > 1

                          return (
                            <div key={page} className="flex items-center">
                              {showEllipsis && (
                                <span className="px-2 py-2 text-gray-400">...</span>
                              )}
                              <button
                                onClick={() => setCurrentPage(page)}
                                className={`px-3 py-2 rounded-lg transition-colors ${currentPage === page
                                    ? 'bg-amber-900 text-white'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                  }`}
                              >
                                {page}
                              </button>
                            </div>
                          )
                        })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredUsers.length / usersPerPage)))}
                      disabled={currentPage === Math.ceil(filteredUsers.length / usersPerPage)}
                      className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>

                  <div className="text-gray-300 text-sm">
                    Page {currentPage} of {Math.ceil(filteredUsers.length / usersPerPage)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="jarvis-card rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">User Details</h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Full Name</p>
                  <p className="text-white font-semibold">{selectedUser.full_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="text-white">{selectedUser.user_email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">User ID</p>
                  <p className="text-white font-mono text-sm">{selectedUser.id}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Referral Code</p>
                  <p className="text-white font-mono">{selectedUser.referral_code || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Sponsor ID</p>
                  <p className="text-white">{selectedUser.sponsor_id || 'None'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Joined</p>
                  <p className="text-white">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Last Login</p>
                  <p className="text-white">
                    {selectedUser.last_sign_in_at
                      ? new Date(selectedUser.last_sign_in_at).toLocaleDateString()
                      : 'Never'
                    }
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Wallet className="h-5 w-5 text-green-400" />
                    <p className="text-gray-400 text-sm">Main Wallet</p>
                  </div>
                  <p className="text-2xl font-bold text-white">${selectedUser.main_wallet_balance.toFixed(2)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Wallet className="h-5 w-5 text-blue-400" />
                    <p className="text-gray-400 text-sm">Fund Wallet</p>
                  </div>
                  <p className="text-2xl font-bold text-white">${selectedUser.fund_wallet_balance.toFixed(2)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-yellow-400" />
                    <p className="text-gray-400 text-sm">JRV Tokens</p>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">
                    {(selectedUser.total_jarvis_tokens || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Total Investments</p>
                  <p className="text-xl font-bold text-green-400">${selectedUser.total_investments.toFixed(2)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Total Withdrawals</p>
                  <p className="text-xl font-bold text-red-400">${selectedUser.total_withdrawals.toFixed(2)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Referrals</p>
                  <p className="text-xl font-bold text-blue-400">{selectedUser.referral_count}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-purple-400" />
                    <p className="text-gray-400 text-sm">USDT Team Volume</p>
                  </div>
                  <p className="text-xl font-bold text-purple-400">${selectedUser.usdt_team_volume.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFundsModal && addFundsUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="jarvis-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Add Funds</h3>
              <button
                onClick={closeAddFundsModal}
                className="text-gray-400 hover:text-white"
                disabled={isAddingFunds}
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm mb-2">User</p>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white font-semibold">{addFundsUser.full_name || 'N/A'}</p>
                  <p className="text-gray-400 text-sm">{addFundsUser.user_email || 'N/A'}</p>
                  <p className="text-gray-400 text-sm">Current Balance: ${addFundsUser.main_wallet_balance.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Amount to Add ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={addFundsAmount}
                    onChange={(e) => setAddFundsAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={isAddingFunds}
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Admin Notes (Optional)
                </label>
                <textarea
                  placeholder="Reason for adding funds..."
                  value={addFundsNotes}
                  onChange={(e) => setAddFundsNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  disabled={isAddingFunds}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={closeAddFundsModal}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold"
                  disabled={isAddingFunds}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddFunds}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2"
                  disabled={isAddingFunds || !addFundsAmount}
                >
                  {isAddingFunds ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      <span>Add Funds</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deduct Funds Modal */}
      {showDeductFundsModal && deductFundsUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="jarvis-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Deduct Funds</h3>
              <button
                onClick={closeDeductFundsModal}
                className="text-gray-400 hover:text-white"
                disabled={isDeductingFunds}
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm mb-2">User</p>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white font-semibold">{deductFundsUser.full_name || 'N/A'}</p>
                  <p className="text-gray-400 text-sm">{deductFundsUser.user_email || 'N/A'}</p>
                  <p className="text-gray-400 text-sm">Current Balance: ${deductFundsUser.main_wallet_balance.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Amount to Deduct ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={deductFundsUser.main_wallet_balance}
                    placeholder="0.00"
                    value={deductFundsAmount}
                    onChange={(e) => setDeductFundsAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    disabled={isDeductingFunds}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Maximum: ${deductFundsUser.main_wallet_balance.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Admin Notes (Optional)
                </label>
                <textarea
                  placeholder="Reason for deducting funds..."
                  value={deductFundsNotes}
                  onChange={(e) => setDeductFundsNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  disabled={isDeductingFunds}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={closeDeductFundsModal}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold"
                  disabled={isDeductingFunds}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeductFunds}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2"
                  disabled={isDeductingFunds || !deductFundsAmount}
                >
                  {isDeductingFunds ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Deducting...</span>
                    </>
                  ) : (
                    <>
                      <Minus className="h-5 w-5" />
                      <span>Deduct Funds</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Jarvis Token Management Modal */}
      {showJarvisModal && jarvisUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="jarvis-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">
                {jarvisAction === 'add' ? 'Add' : 'Deduct'} JRV Tokens
              </h3>
              <button
                onClick={closeJarvisModal}
                className="text-gray-400 hover:text-white"
                disabled={isManagingJarvis}
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm mb-2">User</p>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-white font-semibold">{jarvisUser.full_name || 'N/A'}</p>
                  <p className="text-gray-400 text-sm">{jarvisUser.user_email || 'N/A'}</p>
                  <p className="text-gray-400 text-sm">Current JRV Tokens: {(jarvisUser.total_jarvis_tokens || 0).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Amount to {jarvisAction === 'add' ? 'Add' : 'Deduct'}
                </label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="number"
                    min="1"
                    max={jarvisAction === 'deduct' ? (jarvisUser.total_jarvis_tokens || 0) : undefined}
                    placeholder="0"
                    value={jarvisAmount}
                    onChange={(e) => setJarvisAmount(e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-${jarvisAction === 'add' ? 'yellow' : 'amber'}-500`}
                    disabled={isManagingJarvis}
                  />
                </div>
                {jarvisAction === 'deduct' && (
                  <p className="text-xs text-gray-500 mt-1">Maximum: {(jarvisUser.total_jarvis_tokens || 0).toLocaleString()}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Admin Notes (Optional)
                </label>
                <textarea
                  placeholder={`Reason for ${jarvisAction === 'add' ? 'adding' : 'deducting'} tokens...`}
                  value={jarvisNotes}
                  onChange={(e) => setJarvisNotes(e.target.value)}
                  rows={3}
                  className={`w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-${jarvisAction === 'add' ? 'yellow' : 'amber'}-500 resize-none`}
                  disabled={isManagingJarvis}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={closeJarvisModal}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-semibold"
                  disabled={isManagingJarvis}
                >
                  Cancel
                </button>
                <button
                  onClick={handleJarvisTokens}
                  className={`flex-1 bg-${jarvisAction === 'add' ? 'yellow' : 'amber'}-600 hover:bg-${jarvisAction === 'add' ? 'yellow' : 'amber'}-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center space-x-2`}
                  disabled={isManagingJarvis || !jarvisAmount}
                >
                  {isManagingJarvis ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>{jarvisAction === 'add' ? 'Adding' : 'Deducting'}...</span>
                    </>
                  ) : (
                    <>
                      {jarvisAction === 'add' ? <Coins className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
                      <span>{jarvisAction === 'add' ? 'Add' : 'Deduct'} Tokens</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
