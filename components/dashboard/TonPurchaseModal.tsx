'use client'

import { XCircle } from 'lucide-react'

interface TonPurchaseModalProps {
    showTonModal: boolean
    setShowTonModal: (show: boolean) => void
    tonAmount: string
    setTonAmount: (amount: string) => void
    tonPurchasing: boolean
    tonError: string
    tonSuccess: string
    handleTonPurchase: () => void
}

export default function TonPurchaseModal({
    showTonModal,
    setShowTonModal,
    tonAmount,
    setTonAmount,
    tonPurchasing,
    tonError,
    tonSuccess,
    handleTonPurchase
}: TonPurchaseModalProps) {
    if (!showTonModal) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-lg sm:text-2xl font-bold text-white">Purchase TON Coins</h3>
                    <button
                        onClick={() => setShowTonModal(false)}
                        className="text-gray-400 hover:text-white"
                    >
                        <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-white text-sm font-semibold mb-2">
                            TON Amount
                        </label>
                        <input
                            type="number"
                            value={tonAmount}
                            onChange={(e) => setTonAmount(e.target.value)}
                            className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                            placeholder="Enter TON amount"
                            disabled={tonPurchasing}
                        />
                    </div>

                    {tonError && (
                        <div className="bg-red-500/20 border border-red-500 rounded-lg p-3">
                            <p className="text-red-400 text-sm">{tonError}</p>
                        </div>
                    )}

                    {tonSuccess && (
                        <div className="bg-green-500/20 border border-green-500 rounded-lg p-3">
                            <p className="text-green-400 text-sm">{tonSuccess}</p>
                        </div>
                    )}

                    <div className="flex space-x-3">
                        <button
                            onClick={() => setShowTonModal(false)}
                            className="flex-1 px-4 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 transition-colors"
                            disabled={tonPurchasing}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleTonPurchase}
                            disabled={tonPurchasing || !tonAmount}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {tonPurchasing ? 'Purchasing...' : 'Purchase'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
