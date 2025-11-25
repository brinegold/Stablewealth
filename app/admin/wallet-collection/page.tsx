'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import {
  Search,
  Wallet,
  Coins,
  ArrowLeft,
  User,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'
import Link from 'next/link'

interface UserProfile {
  id: string
  username: string
  email?: string
}

interface WalletBalance {
  address: string
  usdtBalance: number
  bnbBalance: number
}

interface CollectionResult {
  success: boolean
  message: string
  txHash?: string
  amount?: string
  error?: string
}

export default function WalletCollectionPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null)
  const [isCollecting, setIsCollecting] = useState(false)
  const [collectionResult, setCollectionResult] = useState<CollectionResult | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [manualWalletAddress, setManualWalletAddress] = useState('')
  const [collectionMode, setCollectionMode] = useState<'user' | 'manual'>('user')

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
      await fetchUsers()
    } catch (error) {
      console.error('Error checking admin access:', error)
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, username')
        .order('username')

      if (error) throw error

      // Fetch emails separately
      const emailResponse = await fetch('/api/admin/get-user-emails')
      const emailData = await emailResponse.json()

      const usersWithEmails = profiles.map(profile => ({
        ...profile,
        email: emailData.emails?.[profile.id] || profile.id
      }))

      setUsers(usersWithEmails)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const checkWalletBalance = async (userId: string) => {
    setIsLoadingBalance(true)
    setWalletBalance(null)
    setCollectionResult(null)

    try {
      const response = await fetch(`/api/admin/collect-tokens?userId=${userId}`)
      const data = await response.json()

      if (response.ok) {
        setWalletBalance({
          address: data.walletAddress,
          usdtBalance: data.usdtBalance,
          bnbBalance: data.bnbBalance
        })
      } else {
        throw new Error(data.error || 'Failed to fetch wallet balance')
      }
    } catch (error: any) {
      console.error('Error checking wallet balance:', error)
      setCollectionResult({
        success: false,
        message: `Error: ${error.message}`
      })
    } finally {
      setIsLoadingBalance(false)
    }
  }

  const checkWalletBalanceByAddress = async (walletAddress: string) => {
    setIsLoadingBalance(true)
    setWalletBalance(null)
    setCollectionResult(null)

    try {
      const response = await fetch(`/api/admin/collect-tokens?walletAddress=${encodeURIComponent(walletAddress)}`)
      const data = await response.json()

      if (response.ok) {
        setWalletBalance({
          address: data.walletAddress,
          usdtBalance: data.usdtBalance,
          bnbBalance: data.bnbBalance
        })
      } else {
        throw new Error(data.error || 'Failed to fetch wallet balance')
      }
    } catch (error: any) {
      console.error('Error checking wallet balance:', error)
      setCollectionResult({
        success: false,
        message: `Error: ${error.message}`
      })
    } finally {
      setIsLoadingBalance(false)
    }
  }

  const collectFromWallet = async (action: 'collect_specific_usdt' | 'collect_specific_bnb' | 'collect_specific_all') => {
    if (collectionMode === 'user' && !selectedUser) return
    if (collectionMode === 'manual' && !manualWalletAddress) return

    setIsCollecting(true)
    setCollectionResult(null)

    try {
      const requestBody = collectionMode === 'user'
        ? { action, userId: selectedUser!.id }
        : { action, walletAddress: manualWalletAddress }

      const response = await fetch('/api/admin/collect-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (response.ok) {
        setCollectionResult({
          success: true,
          message: data.message,
          txHash: data.txHash,
          amount: data.amount
        })

        // Refresh wallet balance after collection
        if (collectionMode === 'user' && selectedUser) {
          await checkWalletBalance(selectedUser.id)
        } else if (collectionMode === 'manual' && manualWalletAddress) {
          await checkWalletBalanceByAddress(manualWalletAddress)
        }
      } else {
        setCollectionResult({
          success: false,
          message: data.error || 'Collection failed'
        })
      }
    } catch (error: any) {
      console.error('Collection error:', error)
      setCollectionResult({
        success: false,
        message: `Failed: ${error.message}`
      })
    } finally {
      setIsCollecting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const openInBscScan = (txHash: string) => {
    window.open(`https://bscscan.com/tx/${txHash}`, '_blank')
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
            <Link
              href="/admin"
              className="text-white hover:text-blue-300 flex items-center space-x-2"
            >
              <ArrowLeft className="h-6 w-6" />
              <span>Back to Admin</span>
            </Link>
            <div className="flex items-center space-x-2">
              <Wallet className="h-8 w-8 text-white" />
              <h1 className="text-2xl font-bold text-white">Wallet Collection</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Selection Panel */}
          <div className="jarvis-card rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <User className="h-6 w-6" />
              <span>Collection Method</span>
            </h2>

            {/* Mode Selection */}
            <div className="flex space-x-2 mb-6">
              <button
                onClick={() => {
                  setCollectionMode('user')
                  setWalletBalance(null)
                  setCollectionResult(null)
                  setManualWalletAddress('')
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${collectionMode === 'user'
                    ? 'bg-amber-900 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
              >
                Select User
              </button>
              <button
                onClick={() => {
                  setCollectionMode('manual')
                  setWalletBalance(null)
                  setCollectionResult(null)
                  setSelectedUser(null)
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${collectionMode === 'manual'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
              >
                Manual Address
              </button>
            </div>

            {collectionMode === 'user' ? (
              <>
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Search by username, email, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* User List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user)
                        checkWalletBalance(user.id)
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedUser?.id === user.id
                          ? 'bg-amber-900/30 border border-amber-800'
                          : 'bg-white/5 hover:bg-white/10 border border-white/10'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-semibold">{user.username}</p>
                          <p className="text-gray-400 text-sm">{user.email}</p>
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {user.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Manual Wallet Address Input */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-300 text-sm font-semibold mb-2">
                      Wallet Address
                    </label>
                    <input
                      type="text"
                      placeholder="0x1234567890abcdef..."
                      value={manualWalletAddress}
                      onChange={(e) => setManualWalletAddress(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (manualWalletAddress.trim()) {
                        checkWalletBalanceByAddress(manualWalletAddress.trim())
                      }
                    }}
                    disabled={!manualWalletAddress.trim() || isLoadingBalance}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center space-x-2"
                  >
                    <Wallet className="h-5 w-5" />
                    <span>{isLoadingBalance ? 'Checking...' : 'Check Balance'}</span>
                  </button>

                  <div className="bg-yellow-600/20 border border-yellow-500 rounded-lg p-3">
                    <p className="text-sm text-gray-300">
                      <strong>Note:</strong> Enter a valid BSC wallet address (0x...) to check its USDT and BNB balances for collection.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Wallet Details & Collection Panel */}
          <div className="jarvis-card rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <Wallet className="h-6 w-6" />
              <span>Wallet Details</span>
            </h2>

            {(collectionMode === 'user' && !selectedUser) || (collectionMode === 'manual' && !manualWalletAddress) ? (
              <div className="text-center py-8">
                <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-300">
                  {collectionMode === 'user'
                    ? 'Select a user to view wallet details'
                    : 'Enter a wallet address to check balance'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Source Info */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h3 className="text-white font-semibold mb-2">
                    {collectionMode === 'user' ? 'Selected User' : 'Manual Wallet'}
                  </h3>
                  {collectionMode === 'user' && selectedUser ? (
                    <div className="space-y-1">
                      <p className="text-gray-300"><strong>Username:</strong> {selectedUser.username}</p>
                      <p className="text-gray-300"><strong>Email:</strong> {selectedUser.email}</p>
                      <p className="text-gray-300 font-mono text-sm"><strong>ID:</strong> {selectedUser.id}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-gray-300"><strong>Address:</strong></p>
                      <p className="text-white font-mono text-sm break-all">{manualWalletAddress}</p>
                    </div>
                  )}
                </div>

                {/* Wallet Balance */}
                {isLoadingBalance ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    <span className="ml-2 text-white">Loading wallet balance...</span>
                  </div>
                ) : walletBalance ? (
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <h3 className="text-white font-semibold mb-3">Wallet Balance</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">Address:</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-mono text-sm">{walletBalance.address.slice(0, 10)}...{walletBalance.address.slice(-8)}</span>
                          <button
                            onClick={() => copyToClipboard(walletBalance.address)}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">USDT Balance:</span>
                        <span className={`font-semibold ${walletBalance.usdtBalance > 0.01 ? 'text-green-400' : 'text-gray-400'}`}>
                          {walletBalance.usdtBalance.toFixed(4)} USDT
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300">BNB Balance:</span>
                        <span className={`font-semibold ${walletBalance.bnbBalance > 0.005 ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {walletBalance.bnbBalance.toFixed(6)} BNB
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Collection Actions */}
                {walletBalance && (
                  <div className="space-y-4">
                    <h3 className="text-white font-semibold">Collection Actions</h3>
                    <div className="grid grid-cols-1 gap-3">
                      <button
                        onClick={() => collectFromWallet('collect_specific_usdt')}
                        disabled={isCollecting || walletBalance.usdtBalance <= 0.01}
                        className="jarvis-button py-3 px-4 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Coins className="h-5 w-5" />
                        <span>{isCollecting ? 'Collecting...' : 'Collect USDT Only'}</span>
                      </button>

                      <button
                        onClick={() => collectFromWallet('collect_specific_bnb')}
                        disabled={isCollecting || walletBalance.bnbBalance <= 0.005}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Wallet className="h-5 w-5" />
                        <span>{isCollecting ? 'Collecting...' : 'Collect BNB Only'}</span>
                      </button>

                      <button
                        onClick={() => collectFromWallet('collect_specific_all')}
                        disabled={isCollecting || (walletBalance.usdtBalance <= 0.01 && walletBalance.bnbBalance <= 0.005)}
                        className="bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Wallet className="h-5 w-5" />
                        <span>{isCollecting ? 'Collecting...' : 'Collect All Tokens'}</span>
                      </button>
                    </div>

                    <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3">
                      <p className="text-sm text-gray-300">
                        <strong>Note:</strong> Minimum thresholds - USDT: 0.01, BNB: 0.005.
                        BNB collection only if cost-effective after gas fees.
                      </p>
                    </div>
                  </div>
                )}

                {/* Collection Result */}
                {collectionResult && (
                  <div className={`rounded-lg p-4 border ${collectionResult.success
                      ? 'bg-green-600/20 border-green-500'
                      : 'bg-red-600/20 border-red-500'
                    }`}>
                    <div className="flex items-start space-x-2">
                      {collectionResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-white font-semibold mb-1">
                          {collectionResult.success ? 'Success!' : 'Error'}
                        </p>
                        <p className="text-gray-300 text-sm mb-2">{collectionResult.message}</p>

                        {collectionResult.success && collectionResult.txHash && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-400 text-sm">TX:</span>
                            <span className="text-white font-mono text-sm">{collectionResult.txHash.slice(0, 10)}...{collectionResult.txHash.slice(-8)}</span>
                            <button
                              onClick={() => copyToClipboard(collectionResult.txHash!)}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openInBscScan(collectionResult.txHash!)}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
