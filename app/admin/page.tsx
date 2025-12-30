'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import {
  Users,
  CreditCard,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Settings,
  LogOut,
  Coins,
  Wallet,
  Scan
} from 'lucide-react'
import Link from 'next/link'

interface AdminStats {
  totalUsers: number
  pendingWithdrawals: number
  totalWithdrawals: number
  totalInvestments: number
  totalJrcVolume: number
  totalTransactions: number
  dailyTransactions: number
}

interface PendingWithdrawal {
  id: string
  user_id: string
  amount: number
  wallet_address: string
  created_at: string
  user_email: string
  username: string
}

export default function AdminDashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    pendingWithdrawals: 0,
    totalWithdrawals: 0,
    totalInvestments: 0,
    totalJrcVolume: 0,
    totalTransactions: 0,
    dailyTransactions: 0
  })
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isCollecting, setIsCollecting] = useState(false)
  const [collectionResults, setCollectionResults] = useState<string>('')
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin')
    } else if (user) {
      checkAdminAccess()
    }
  }, [user, loading, router])

  const checkAdminAccess = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user?.id)
        .single()

      if (error) throw error

      if (!profile?.is_admin) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
      await fetchAdminData()
    } catch (error) {
      console.error('Error checking admin access:', error)
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAdminData = async () => {
    try {
      // Fetch stats
      const [usersCount, withdrawalsData, investmentsData, transactionsData, jrcTransactionsData] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('withdrawal_requests').select('*'),
        supabase.from('investment_plans').select('investment_amount'),
        supabase.from('transactions').select('created_at', { count: 'exact' }),
        supabase.from('transactions').select('amount, description').like('description', '%JRC Staking%')
      ])

      // Calculate daily transactions (today)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count: dailyTransactionsCount } = await supabase
        .from('transactions')
        .select('id', { count: 'exact' })
        .gte('created_at', today.toISOString())

      const pendingWithdrawalsCount = withdrawalsData.data?.filter(w => w.status === 'pending').length || 0
      const totalWithdrawalsAmount = withdrawalsData.data?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0
      const totalInvestmentsAmount = investmentsData.data?.reduce((sum, i) => sum + (i.investment_amount || 0), 0) || 0
      const totalJrcVolumeAmount = jrcTransactionsData.data?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0

      setStats({
        totalUsers: usersCount.count || 0,
        pendingWithdrawals: pendingWithdrawalsCount,
        totalWithdrawals: totalWithdrawalsAmount,
        totalInvestments: totalInvestmentsAmount,
        totalJrcVolume: totalJrcVolumeAmount,
        totalTransactions: transactionsData.count || 0,
        dailyTransactions: dailyTransactionsCount || 0
      })

      // Fetch pending withdrawals with user details
      const { data: pendingData, error: pendingError } = await supabase
        .from('withdrawal_requests')
        .select(`
          *,
          profiles!inner(username)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (pendingError) throw pendingError

      console.log('Main admin page - pending withdrawals:', pendingData) // Debug log

      // Fetch emails separately using the admin API
      let emailData: { emails?: Record<string, string> } = { emails: {} }
      try {
        const emailResponse = await fetch('/api/admin/get-user-emails')
        if (emailResponse.ok) {
          emailData = await emailResponse.json()
        }
      } catch (emailError) {
        console.error('Error fetching user emails:', emailError)
      }

      const formattedPending = pendingData?.map(w => ({
        id: w.id,
        user_id: w.user_id,
        amount: w.amount,
        wallet_address: w.wallet_address,
        created_at: w.created_at,
        user_email: emailData.emails?.[w.user_id] || w.user_id, // Use actual email or fallback to user_id
        username: w.profiles.username || 'Unknown User'
      })) || []

      console.log('Main admin page - formatted pending:', formattedPending) // Debug log
      setPendingWithdrawals(formattedPending)

    } catch (error) {
      console.error('Error fetching admin data:', error)
    }
  }

  const handleDistributeProfits = async () => {
    try {
      const response = await fetch('/api/admin/distribute-profits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const data = await response.json()

      if (response.ok) {
        alert(`✅ Profit distribution completed successfully!\n\nTimestamp: ${data.timestamp}`)
        // Refresh admin data to see updated stats
        await fetchAdminData()
      } else {
        throw new Error(data.error || 'Failed to distribute profits')
      }
    } catch (error: any) {
      console.error('Error distributing profits:', error)
      alert(`❌ Failed to distribute profits: ${error.message}`)
    }
  }

  const handleTokenCollection = async (action: 'scan_all' | 'collect_usdt' | 'collect_bnb', userId?: string) => {
    setIsCollecting(true)
    setCollectionResults('')

    try {
      const response = await fetch('/api/admin/collect-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, userId })
      })

      const data = await response.json()

      if (response.ok) {
        if (action === 'scan_all' || action === 'collect_usdt' || action === 'collect_bnb') {
          const results = data.results
          const summary = `✅ ${data.message}\n\n` +
            `📊 Scanned: ${results.scannedWallets} wallets\n` +
            `💰 USDT Collections: ${results.usdtCollections.length}\n` +
            `⛽ BNB Collections: ${results.bnbCollections.length}\n` +
            `❌ Errors: ${results.errors.length}\n\n` +
            (results.usdtCollections.length > 0 ?
              `USDT Collections:\n${results.usdtCollections.map((c: any) =>
                `• ${c.amount} USDT - TX: ${c.txHash?.slice(0, 10)}...`).join('\n')}\n\n` : '') +
            (results.bnbCollections.length > 0 ?
              `BNB Collections:\n${results.bnbCollections.map((c: any) =>
                `• ${c.amount} BNB - TX: ${c.txHash?.slice(0, 10)}...`).join('\n')}\n\n` : '') +
            (results.errors.length > 0 ?
              `Errors:\n${results.errors.slice(0, 5).map((e: any) =>
                `• ${e.error}`).join('\n')}` : '')

          setCollectionResults(summary)
        } else {
          setCollectionResults(`✅ ${data.message}\nTX: ${data.txHash}`)
        }
      } else {
        setCollectionResults(`❌ Error: ${data.error}`)
      }
    } catch (error: any) {
      console.error('Collection error:', error)
      setCollectionResults(`❌ Failed: ${error.message}`)
    } finally {
      setIsCollecting(false)
    }
  }

  const handleWithdrawalAction = async (withdrawalId: string, action: 'approve' | 'reject') => {
    let txHash = '';

    if (action === 'approve') {
      const input = window.prompt('Please enter the Transaction Hash for this manual withdrawal:');
      if (input === null) return; // User cancelled
      if (!input.trim()) {
        alert('Transaction Hash is required for approval.');
        return;
      }
      txHash = input.trim();
    }

    const loadingMessage = action === 'approve'
      ? 'Processing manual withdrawal approval...'
      : 'Rejecting withdrawal...';

    // Show loading state
    const originalAlert = window.alert;
    window.alert = () => { }; // Temporarily disable alerts

    try {
      // Show processing message
      if (action === 'approve') {
        // We can't use alert here as it blocks execution, but we can rely on the UI update after
      }

      const response = await fetch('/api/admin/approve-withdrawal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          withdrawalId,
          action,
          txHash
        })
      })

      const data = await response.json()

      // Restore alert function
      window.alert = originalAlert;

      if (response.ok) {
        if (action === 'approve') {
          alert(`✅ Withdrawal approved successfully!\n\n💰 Net Amount: $${data.netAmount?.toFixed(2)}\n💸 Withdrawal Fee: $${data.withdrawalFee?.toFixed(2)}\n🔗 Blockchain TX: ${data.txHash}\n\nThe withdrawal has been recorded manually.`)
        } else {
          alert('✅ Withdrawal rejected successfully!')
        }

        // Refresh data
        await fetchAdminData()
      } else {
        throw new Error(data.error || `Failed to ${action} withdrawal`)
      }
    } catch (error: any) {
      // Restore alert function
      window.alert = originalAlert;

      console.error(`Error ${action}ing withdrawal:`, error)
      alert(`❌ Failed to ${action} withdrawal: ${error.message}`)
    }
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen jarvis-gradient flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen jarvis-gradient flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-300">You don't have admin privileges.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen jarvis-gradient">
      {/* Header */}
      <header className="border-b border-white/20 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Settings className="h-8 w-8 text-white" />
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/dashboard"
              className="text-white hover:text-blue-300 flex items-center space-x-2"
            >
              <Eye className="h-5 w-5" />
              <span>User View</span>
            </Link>
            <button className="text-white hover:text-red-300 flex items-center space-x-2">
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
          <div className="jarvis-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Total Users</p>
                <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
              </div>
              <Users className="h-12 w-12 text-blue-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Pending Withdrawals</p>
                <p className="text-3xl font-bold text-yellow-400">{stats.pendingWithdrawals}</p>
              </div>
              <AlertCircle className="h-12 w-12 text-yellow-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Total Withdrawals</p>
                <p className="text-3xl font-bold text-green-400">${stats.totalWithdrawals.toFixed(2)}</p>
              </div>
              <CreditCard className="h-12 w-12 text-green-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Total Investments</p>
                <p className="text-3xl font-bold text-purple-400">${stats.totalInvestments.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-12 w-12 text-purple-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Total JRC Volume</p>
                <p className="text-3xl font-bold text-yellow-400">{stats.totalJrcVolume.toFixed(0)} JRC</p>
              </div>
              <Coins className="h-12 w-12 text-yellow-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Total Transactions</p>
                <p className="text-3xl font-bold text-cyan-400">{stats.totalTransactions.toLocaleString()}</p>
              </div>
              <CreditCard className="h-12 w-12 text-cyan-400" />
            </div>
          </div>

          <div className="jarvis-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Today's Transactions</p>
                <p className="text-3xl font-bold text-orange-400">{stats.dailyTransactions}</p>
              </div>
              <Coins className="h-12 w-12 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Link
            href="/admin/withdrawals"
            className="jarvis-button px-6 py-3 rounded-lg text-white font-semibold"
          >
            Manage Withdrawals
          </Link>
          <Link
            href="/admin/deposit-requests"
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg text-white font-semibold flex items-center space-x-2"
          >
            <CreditCard className="h-5 w-5" />
            <span>Deposit Requests</span>
          </Link>
          <Link
            href="/admin/users"
            className="jarvis-card px-6 py-3 rounded-lg text-white font-semibold hover:bg-white/10"
          >
            Manage Users
          </Link>
          <Link
            href="/admin/transactions"
            className="jarvis-card px-6 py-3 rounded-lg text-white font-semibold hover:bg-white/10"
          >
            View Transactions
          </Link>
          <Link
            href="/admin/investments"
            className="jarvis-card px-6 py-3 rounded-lg text-white font-semibold hover:bg-white/10"
          >
            Investment Plans
          </Link>
          <Link
            href="/admin/wallet-collection"
            className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg text-white font-semibold flex items-center space-x-2"
          >
            <Wallet className="h-5 w-5" />
            <span>Specific Wallet Collection</span>
          </Link>
          <button
            onClick={handleDistributeProfits}
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg text-white font-semibold"
          >
            Distribute Profits
          </button>
        </div>

        {/* Manual Deposit Information */}
        <div className="jarvis-card rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <CreditCard className="h-6 w-6" />
            <span>Manual Deposit System</span>
          </h2>

          <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">System Update</h3>
            <p className="text-gray-300 text-sm mb-3">
              The platform now uses a manual deposit approval system. Users submit deposit requests
              which require admin verification and approval.
            </p>
            <div className="flex gap-4">
              <Link
                href="/admin/deposit-requests"
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-white font-semibold text-sm"
              >
                Manage Deposit Requests
              </Link>
            </div>
          </div>
        </div>

        {/* Token Collection Section */}
        <div className="jarvis-card rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
            <Wallet className="h-6 w-6" />
            <span>Token Collection Management</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => handleTokenCollection('scan_all')}
              disabled={isCollecting}
              className="jarvis-button py-4 px-6 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Scan className="h-5 w-5" />
              <span>{isCollecting ? 'Scanning...' : 'Scan & Collect All'}</span>
            </button>

            <button
              onClick={() => handleTokenCollection('collect_usdt')}
              disabled={isCollecting}
              className="bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Coins className="h-5 w-5" />
              <span>{isCollecting ? 'Collecting...' : 'Collect All USDT'}</span>
            </button>

            <button
              onClick={() => handleTokenCollection('collect_bnb')}
              disabled={isCollecting}
              className="bg-yellow-600 hover:bg-yellow-700 text-white py-4 px-6 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wallet className="h-5 w-5" />
              <span>{isCollecting ? 'Collecting...' : 'Collect All BNB'}</span>
            </button>
          </div>

          {collectionResults && (
            <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">Collection Results:</h3>
              <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono">
                {collectionResults}
              </pre>
            </div>
          )}

          <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4 mt-4">
            <h4 className="text-white font-semibold mb-2">Collection Information</h4>
            <div className="text-sm text-gray-300 space-y-1">
              <p>• <strong>Scan & Collect All:</strong> Scans all user wallets and collects both USDT + BNB automatically</p>
              <p>• <strong>Collect All USDT:</strong> Collects USDT tokens from ALL user wallets to GLOBAL_ADMIN_WALLET</p>
              <p>• <strong>Collect All BNB:</strong> Recovers BNB gas fees from ALL user wallets to GLOBAL_ADMIN_WALLET</p>
              <p>• <strong>Minimum thresholds:</strong> USDT &gt; 0.01, BNB collection only if cost-effective</p>
            </div>
          </div>
        </div>

        {/* Pending Withdrawals */}
        <div className="jarvis-card rounded-2xl p-6">
          <h2 className="text-2xl font-bold text-white mb-6">Pending Withdrawals</h2>

          {pendingWithdrawals.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <p className="text-gray-300">No pending withdrawals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingWithdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <div>
                          <p className="text-white font-semibold">{withdrawal.username}</p>
                          <p className="text-gray-400 text-sm">{withdrawal.user_email}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Amount</p>
                          <p className="text-white font-semibold">${withdrawal.amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Wallet Address</p>
                          <p className="text-white font-mono text-xs">{withdrawal.wallet_address}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Requested</p>
                          <p className="text-white">{new Date(withdrawal.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleWithdrawalAction(withdrawal.id, 'approve')}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleWithdrawalAction(withdrawal.id, 'reject')}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Reject</span>
                      </button>
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
