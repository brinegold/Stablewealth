'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import {
    ArrowLeft,
    Clock,
    CheckCircle,
    XCircle,
    Eye,
    ExternalLink,
    Search,
    Filter,
    DollarSign,
    User,
    Calendar,
    AlertCircle,
    Loader2,
    Wallet
} from 'lucide-react'
import Link from 'next/link'

interface WithdrawalRequest {
    id: string
    user_id: string
    amount: number
    wallet_address: string
    status: 'pending' | 'approved' | 'rejected'
    tx_hash?: string
    admin_notes?: string
    processed_by?: string
    processed_at?: string
    created_at: string
    updated_at: string
    user_profile?: {
        username: string
        full_name: string
        email: string
    }
}

export default function WithdrawalsPage() {
    const { user, loading } = useAuth()
    const router = useRouter()
    const [isAdmin, setIsAdmin] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [requests, setRequests] = useState<WithdrawalRequest[]>([])
    const [filteredRequests, setFilteredRequests] = useState<WithdrawalRequest[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null)
    const [showModal, setShowModal] = useState(false)
    const [modalAction, setModalAction] = useState<'approve' | 'reject' | 'view'>('view')
    const [adminNotes, setAdminNotes] = useState('')
    const [txHash, setTxHash] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [userEmails, setUserEmails] = useState<{ [key: string]: string }>({})

    const supabase = createSupabaseClient()

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth/signin')
        } else if (user) {
            checkAdminAccess()
        }
    }, [user, loading, router])

    useEffect(() => {
        filterRequests()
    }, [requests, searchTerm, statusFilter])

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

            console.log('✅ Admin access confirmed:', profile.is_admin)
            setIsAdmin(true)
            await fetchWithdrawalRequests()
            await fetchUserEmails()
        } catch (error) {
            console.error('Error checking admin access:', error)
            router.push('/dashboard')
        } finally {
            setIsLoading(false)
        }
    }

    const fetchUserEmails = async () => {
        try {
            const response = await fetch('/api/admin/get-user-emails')
            const data = await response.json()
            setUserEmails(data.emails || {})
        } catch (error) {
            console.error('Error fetching user emails:', error)
        }
    }

    const fetchWithdrawalRequests = async () => {
        try {
            console.log('🔍 Fetching withdrawal requests...')

            // First try a simple query without relationships
            console.log('📝 Trying simple query first...')
            const { data: simpleData, error: simpleError } = await supabase
                .from('withdrawal_requests')
                .select('*')
                .order('created_at', { ascending: false })

            console.log('📊 Simple query result:', {
                count: simpleData?.length || 0,
                error: simpleError,
                sample: simpleData?.[0]
            })

            if (simpleError) {
                console.error('❌ Simple query failed:', simpleError)
                throw simpleError
            }

            // If simple query works, try the complex one with relationships
            console.log('📝 Trying query with relationships...')
            const { data, error } = await supabase
                .from('withdrawal_requests')
                .select(`
          *,
          user_profile:profiles!withdrawal_requests_user_id_fkey(full_name, username)
        `)
                .order('created_at', { ascending: false })

            console.log('📡 Complex query result:', { data, error })

            if (error) {
                console.error('❌ Complex query error:', error)
                // Fall back to simple data if relationships fail
                console.log('🔄 Falling back to simple query data')
                const requestsWithEmails = simpleData.map(request => ({
                    ...request,
                    user_profile: {
                        username: request.user_id,
                        full_name: 'Unknown User',
                        email: userEmails[request.user_id] || request.user_id
                    }
                }))
                setRequests(requestsWithEmails)
                return
            }

            console.log('✅ Complex query successful, data length:', data?.length || 0)

            // Add email information to requests
            const requestsWithEmails = data.map(request => ({
                ...request,
                user_profile: {
                    ...request.user_profile,
                    email: userEmails[request.user_id] || request.user_id
                }
            }))

            console.log('📋 Processed requests:', requestsWithEmails.length)
            setRequests(requestsWithEmails)
        } catch (error) {
            console.error('❌ Error fetching withdrawal requests:', error)
        }
    }

    const filterRequests = () => {
        let filtered = requests

        if (statusFilter !== 'all') {
            filtered = filtered.filter(request => request.status === statusFilter)
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            filtered = filtered.filter(request =>
                request.wallet_address.toLowerCase().includes(term) ||
                request.user_profile?.full_name?.toLowerCase().includes(term) ||
                request.user_profile?.username?.toLowerCase().includes(term) ||
                request.user_profile?.email?.toLowerCase().includes(term) ||
                request.amount.toString().includes(term) ||
                request.tx_hash?.toLowerCase().includes(term)
            )
        }

        setFilteredRequests(filtered)
    }

    const openModal = (request: WithdrawalRequest, action: 'approve' | 'reject' | 'view') => {
        setSelectedRequest(request)
        setModalAction(action)
        setAdminNotes(request.admin_notes || '')
        setTxHash(request.tx_hash || '')
        setShowModal(true)
    }

    const closeModal = () => {
        setShowModal(false)
        setSelectedRequest(null)
        setAdminNotes('')
        setTxHash('')
        setIsProcessing(false)
    }

    const processRequest = async () => {
        if (!selectedRequest) return

        // Validate tx_hash for approval
        if (modalAction === 'approve' && !txHash.trim()) {
            alert('Transaction Hash is required for approval.')
            return
        }

        setIsProcessing(true)

        try {
            const response = await fetch('/api/admin/approve-withdrawal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    withdrawalId: selectedRequest.id,
                    action: modalAction,
                    txHash: modalAction === 'approve' ? txHash.trim() : undefined,
                    adminNotes: adminNotes.trim() || undefined
                })
            })

            const data = await response.json()

            if (response.ok) {
                // Refresh the requests list
                await fetchWithdrawalRequests()
                closeModal()

                // Show success message
                if (modalAction === 'approve') {
                    alert(`✅ Withdrawal approved successfully!\n\n💰 Net Amount: $${data.netAmount?.toFixed(2)}\n💸 Withdrawal Fee: $${data.withdrawalFee?.toFixed(2)}\n🔗 Blockchain TX: ${data.txHash}`)
                } else {
                    alert(`✅ Withdrawal rejected successfully!`)
                }
            } else {
                alert(`Error: ${data.error}`)
            }
        } catch (error) {
            console.error(`Error ${modalAction}ing request:`, error)
            alert(`Failed to ${modalAction} request`)
        } finally {
            setIsProcessing(false)
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return <Clock className="h-4 w-4 text-yellow-400" />
            case 'approved':
                return <CheckCircle className="h-4 w-4 text-green-400" />
            case 'rejected':
                return <XCircle className="h-4 w-4 text-red-400" />
            default:
                return <Clock className="h-4 w-4 text-gray-400" />
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'text-yellow-400 bg-yellow-400/20'
            case 'approved':
                return 'text-green-400 bg-green-400/20'
            case 'rejected':
                return 'text-red-400 bg-red-400/20'
            default:
                return 'text-gray-400 bg-gray-400/20'
        }
    }

    const stats = {
        total: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        approved: requests.filter(r => r.status === 'approved').length,
        rejected: requests.filter(r => r.status === 'rejected').length,
        totalAmount: requests.reduce((sum, r) => sum + r.amount, 0),
        pendingAmount: requests.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0)
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
                        <h1 className="text-2xl font-bold text-white">Withdrawal Requests</h1>
                    </div>
                </div>
            </header>

            <div className="container mx-auto p-6">
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="jarvis-card rounded-xl p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-300 text-sm">Total Requests</p>
                                <p className="text-2xl font-bold text-white">{stats.total}</p>
                            </div>
                            <Wallet className="h-8 w-8 text-blue-400" />
                        </div>
                    </div>

                    <div className="jarvis-card rounded-xl p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-300 text-sm">Pending</p>
                                <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                                <p className="text-sm text-gray-400">${stats.pendingAmount.toFixed(2)}</p>
                            </div>
                            <Clock className="h-8 w-8 text-yellow-400" />
                        </div>
                    </div>

                    <div className="jarvis-card rounded-xl p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-300 text-sm">Approved</p>
                                <p className="text-2xl font-bold text-green-400">{stats.approved}</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-400" />
                        </div>
                    </div>

                    <div className="jarvis-card rounded-xl p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-300 text-sm">Total Amount</p>
                                <p className="text-2xl font-bold text-white">${stats.totalAmount.toFixed(2)}</p>
                            </div>
                            <DollarSign className="h-8 w-8 text-green-400" />
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="jarvis-card rounded-xl p-6 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                                <input
                                    type="text"
                                    placeholder="Search by name, email, wallet address, or amount..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="md:w-48">
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                >
                                    <option value="all" className="bg-gray-800">All Status</option>
                                    <option value="pending" className="bg-gray-800">Pending</option>
                                    <option value="approved" className="bg-gray-800">Approved</option>
                                    <option value="rejected" className="bg-gray-800">Rejected</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Requests Table */}
                <div className="jarvis-card rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                        Amount
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                        Wallet Address
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {filteredRequests.map((request) => (
                                    <tr key={request.id} className="hover:bg-white/5">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <User className="h-8 w-8 text-gray-400 mr-3" />
                                                <div>
                                                    <div className="text-sm font-medium text-white">
                                                        {request.user_profile?.full_name || 'Unknown User'}
                                                    </div>
                                                    <div className="text-sm text-gray-400">
                                                        {request.user_profile?.email || request.user_id}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-white">
                                                ${request.amount.toFixed(2)}
                                            </div>
                                            <div className="text-sm text-gray-400">
                                                USDT (BSC)
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-mono text-white">
                                                {request.wallet_address.slice(0, 10)}...{request.wallet_address.slice(-8)}
                                            </div>
                                            {request.tx_hash && (
                                                <a
                                                    href={`https://bscscan.com/tx/${request.tx_hash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center mt-1"
                                                >
                                                    View TX <ExternalLink className="h-3 w-3 ml-1" />
                                                </a>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                                                {getStatusIcon(request.status)}
                                                <span className="ml-1 capitalize">{request.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-white">
                                                {new Date(request.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="text-sm text-gray-400">
                                                {new Date(request.created_at).toLocaleTimeString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => openModal(request, 'view')}
                                                    className="text-blue-400 hover:text-blue-300"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                {request.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => openModal(request, 'approve')}
                                                            className="text-green-400 hover:text-green-300"
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => openModal(request, 'reject')}
                                                            className="text-red-400 hover:text-red-300"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredRequests.length === 0 && (
                        <div className="text-center py-12">
                            <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-300">No withdrawal requests found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && selectedRequest && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="jarvis-card rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white">
                                {modalAction === 'view' ? 'View' : modalAction === 'approve' ? 'Approve' : 'Reject'} Withdrawal Request
                            </h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-white"
                            >
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">User</label>
                                <p className="text-white">{selectedRequest.user_profile?.full_name || 'Unknown User'}</p>
                                <p className="text-sm text-gray-400">{selectedRequest.user_profile?.email || selectedRequest.user_id}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Amount</label>
                                <p className="text-white font-semibold">${selectedRequest.amount.toFixed(2)} USDT</p>
                                <p className="text-sm text-gray-400">Network: BSC</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Wallet Address</label>
                                <p className="text-white font-mono text-sm break-all">{selectedRequest.wallet_address}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedRequest.status)}`}>
                                    {getStatusIcon(selectedRequest.status)}
                                    <span className="ml-1 capitalize">{selectedRequest.status}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Submitted</label>
                                <p className="text-white">{new Date(selectedRequest.created_at).toLocaleString()}</p>
                            </div>

                            {selectedRequest.processed_at && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Processed</label>
                                    <p className="text-white">{new Date(selectedRequest.processed_at).toLocaleString()}</p>
                                </div>
                            )}

                            {selectedRequest.tx_hash && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Transaction Hash</label>
                                    <p className="text-white font-mono text-sm break-all">{selectedRequest.tx_hash}</p>
                                    <a
                                        href={`https://bscscan.com/tx/${selectedRequest.tx_hash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 text-sm flex items-center mt-1"
                                    >
                                        View on BSCScan <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                </div>
                            )}

                            {modalAction === 'approve' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Transaction Hash *</label>
                                    <input
                                        type="text"
                                        value={txHash}
                                        onChange={(e) => setTxHash(e.target.value)}
                                        placeholder="Enter blockchain transaction hash..."
                                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">Required: Enter the TX hash from BSCScan after manual withdrawal</p>
                                </div>
                            )}

                            {(modalAction !== 'view' || selectedRequest.admin_notes) && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Admin Notes</label>
                                    {modalAction === 'view' ? (
                                        <p className="text-white">{selectedRequest.admin_notes || 'No notes'}</p>
                                    ) : (
                                        <textarea
                                            value={adminNotes}
                                            onChange={(e) => setAdminNotes(e.target.value)}
                                            placeholder="Add notes for this decision..."
                                            rows={3}
                                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        {modalAction !== 'view' && (
                            <div className="flex space-x-3">
                                <button
                                    onClick={closeModal}
                                    disabled={isProcessing}
                                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={processRequest}
                                    disabled={isProcessing}
                                    className={`flex-1 px-4 py-2 rounded-lg text-white flex items-center justify-center space-x-2 ${modalAction === 'approve'
                                            ? 'bg-green-600 hover:bg-green-700'
                                            : 'bg-red-600 hover:bg-red-700'
                                        } disabled:opacity-50`}
                                >
                                    {isProcessing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : modalAction === 'approve' ? (
                                        <CheckCircle className="h-4 w-4" />
                                    ) : (
                                        <XCircle className="h-4 w-4" />
                                    )}
                                    <span>{isProcessing ? 'Processing...' : modalAction === 'approve' ? 'Approve' : 'Reject'}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
