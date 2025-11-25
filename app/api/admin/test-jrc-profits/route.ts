import { NextRequest, NextResponse } from 'next/server'
import { triggerTonStakingProfitDistribution } from '@/lib/profit-distribution'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing JRC staking profit distribution...')

    // Trigger JRC staking profit distribution
    await triggerTonStakingProfitDistribution()

    return NextResponse.json({
      success: true,
      message: 'JRC staking profit distribution test completed',
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error testing JRC staking profits:', error)
    return NextResponse.json({
      error: error.message || 'Failed to test JRC staking profit distribution'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Same as GET for flexibility
  return GET(request)
}
