import { NextRequest, NextResponse } from 'next/server'
import { triggerTonStakingProfitDistribution } from '@/lib/profit-distribution'

export async function GET(request: NextRequest) {
    try {
        console.log('Testing TON staking profit distribution...')

        // Trigger TON staking profit distribution
        await triggerTonStakingProfitDistribution()

        return NextResponse.json({
            success: true,
            message: 'TON staking profit distribution test completed',
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('Error testing TON staking profits:', error)
        return NextResponse.json({
            error: error.message || 'Failed to test TON staking profit distribution'
        }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    // Same as GET for flexibility
    return GET(request)
}
