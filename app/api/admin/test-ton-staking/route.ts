import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseClient()

        console.log('Testing TON staking system...')

        // Check if ton_staking_plans table exists
        const { data: stakingPlans, error: stakingError } = await supabase
            .from('ton_staking_plans')
            .select('*')
            .limit(10)

        if (stakingError) {
            return NextResponse.json({
                error: 'TON staking table does not exist',
                details: stakingError.message,
                solution: 'Please run the add_staking_system.sql migration first'
            }, { status: 400 })
        }

        // Check for active staking plans
        const { data: activePlans, error: activeError } = await supabase
            .from('ton_staking_plans')
            .select('*')
            .eq('status', 'active')

        if (activeError) {
            return NextResponse.json({
                error: 'Error fetching active staking plans',
                details: activeError.message
            }, { status: 500 })
        }

        // Check recent TON staking transactions
        const { data: transactions, error: transError } = await supabase
            .from('transactions')
            .select('*')
            .ilike('description', '%TON%staking%')
            .order('created_at', { ascending: false })
            .limit(10)

        if (transError) {
            return NextResponse.json({
                error: 'Error fetching TON staking transactions',
                details: transError.message
            }, { status: 500 })
        }

        // Check for existing distributions
        const { data: distributions, error: distError } = await supabase
            .from('ton_staking_distributions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)

        return NextResponse.json({
            success: true,
            data: {
                totalStakingPlans: stakingPlans?.length || 0,
                activePlans: activePlans?.length || 0,
                recentTransactions: transactions?.length || 0,
                recentDistributions: distributions?.length || 0,
                stakingPlans: activePlans,
                transactions: transactions,
                distributions: distributions
            },
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('Error testing TON staking:', error)
        return NextResponse.json({
            error: error.message || 'Failed to test TON staking system'
        }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    // Same as GET for flexibility
    return GET(request)
}
