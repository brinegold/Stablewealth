'use client'

import { XCircle } from 'lucide-react'

interface IncomeModalProps {
  showIncomeModal: boolean
  setShowIncomeModal: (show: boolean) => void
  selectedIncomeType: string
  incomeData: any[]
}

export default function IncomeModal({
  showIncomeModal,
  setShowIncomeModal,
  selectedIncomeType,
  incomeData
}: IncomeModalProps) {
  if (!showIncomeModal) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
      <div className="jarvis-card rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-2xl w-full max-h-[85vh] sm:max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-2xl font-bold text-white">
            {selectedIncomeType === 'trade' && 'Trade Income Details'}
            {selectedIncomeType === 'referral' && 'Referral Commission Details'}
            {selectedIncomeType === 'tokens' && 'Token Transaction Details'}
            {selectedIncomeType === 'rewards' && 'Reward Income Details'}
            {selectedIncomeType === 'staking' && 'Staking Income Details'}
            {selectedIncomeType === 'staking-referral' && 'TON Staking Reward Details'}
          </h3>
          <button
            onClick={() => setShowIncomeModal(false)}
            className="text-gray-400 hover:text-white"
          >
            <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {incomeData.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <p className="text-gray-300 text-sm sm:text-base">No data available for this income type</p>
            </div>
          ) : (
            incomeData.map((item, index) => (
              <div key={index} className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/10">
                {selectedIncomeType === 'trade' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <p className="text-gray-400">Plan Type</p>
                      <p className="text-white font-semibold">Plan {item.plan_type}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Investment Amount</p>
                      <p className="text-white">${item.investment_amount?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Daily Percentage</p>
                      <p className="text-green-400">{item.daily_percentage}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Date</p>
                      <p className="text-white">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}

                {selectedIncomeType === 'referral' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <p className="text-gray-400">Commission Amount</p>
                      <p className="text-white font-semibold">${item.commission_amount?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Level</p>
                      <p className="text-white">Level {item.level}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Commission %</p>
                      <p className="text-green-400">{item.commission_percentage}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Date</p>
                      <p className="text-white">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}

                {selectedIncomeType === 'staking' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <p className="text-gray-400">Profit Amount</p>
                      <p className="text-white font-semibold">${item.profit_amount?.toFixed(8)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Plan Type</p>
                      <p className="text-white">Plan {item.investment_plans?.plan_type}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Investment Amount</p>
                      <p className="text-white">${item.investment_plans?.investment_amount?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Daily Percentage</p>
                      <p className="text-green-400">{item.investment_plans?.daily_percentage}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Distribution Date</p>
                      <p className="text-white">{new Date(item.distribution_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Created At</p>
                      <p className="text-white">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}

                {selectedIncomeType === 'tokens' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <p className="text-gray-400">Transaction Type</p>
                      <p className="text-white font-semibold capitalize">{item.transaction_type?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Amount</p>
                      <p className="text-yellow-400">{item.amount} TON</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Status</p>
                      <p className="text-green-400 capitalize">{item.status}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Date</p>
                      <p className="text-white">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}

                {selectedIncomeType === 'staking-referral' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <p className="text-gray-400">Staking Amount</p>
                      <p className="text-white font-semibold">{item.amount} TON</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Staking Period</p>
                      <p className="text-white">{item.staking_period} days</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Daily Percentage</p>
                      <p className="text-green-400">{item.daily_percentage}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Total Earned</p>
                      <p className="text-yellow-400">{item.total_profit_earned?.toFixed(2)} TON</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Status</p>
                      <p className={`capitalize ${item.status === 'active' ? 'text-green-400' : item.status === 'completed' ? 'text-blue-400' : 'text-gray-400'}`}>
                        {item.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Start Date</p>
                      <p className="text-white">{new Date(item.start_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">End Date</p>
                      <p className="text-white">{new Date(item.end_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Rewards Claimed</p>
                      <p className="text-yellow-400">{item.rewards_claimed?.toFixed(2)} TON</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
