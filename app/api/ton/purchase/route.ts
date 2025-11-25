import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import EmailService from '@/lib/email-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const supabase = createSupabaseServerClient()

        // Parse request body
        const { tonAmount, userId } = await request.json()

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
        }

        if (!tonAmount || parseFloat(tonAmount) <= 0) {
            return NextResponse.json({ error: 'Invalid TON amount' }, { status: 400 })
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()

        if (profileError || !profile) {
            return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
        }

        const coinsToBuy = parseFloat(tonAmount)
        const tonRate = 0.1 // $0.1 per TON coin
        const totalCost = coinsToBuy * tonRate

        // Validation
        if (totalCost > profile.fund_wallet_balance) {
            // TODO: Send failure email notification

            return NextResponse.json({
                error: `Insufficient fund wallet balance. You need $${totalCost.toFixed(2)} but only have $${profile.fund_wallet_balance.toFixed(2)}`
            }, { status: 400 })
        }

        // Update user balances
        const newFundBalance = profile.fund_wallet_balance - totalCost
        const newTonBalance = profile.total_jarvis_tokens + coinsToBuy

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                fund_wallet_balance: newFundBalance,
                total_jarvis_tokens: newTonBalance
            })
            .eq('id', userId)

        if (updateError) throw updateError

        // Create transaction record
        const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                transaction_type: 'ton_purchase',
                amount: totalCost,
                net_amount: totalCost,
                status: 'completed',
                description: `Purchased ${coinsToBuy.toLocaleString()} TON coins at $${tonRate} per coin`
            })

        if (transactionError) throw transactionError

        // TODO: Send success email notification

        return NextResponse.json({
            success: true,
            message: `Successfully purchased ${coinsToBuy.toLocaleString()} TON coins for $${totalCost.toFixed(2)}!`,
            coinsPurchased: coinsToBuy,
            totalCost: totalCost,
        })

    } catch (error: any) {
        console.error("Error processing TON purchase:", error)

        // TODO: Send failure email notification

        return NextResponse.json({ error: error.message || "Failed to purchase TON coins" }, { status: 500 })
    }
}
