import { NextRequest, NextResponse } from 'next/server'
import { triggerProfitDistribution } from '@/lib/profit-distribution'

export async function GET(request: NextRequest) {
  try {
    console.log('Manual trigger: Starting profit distribution...')

    // Trigger profit distribution
    await triggerProfitDistribution()

    return NextResponse.json({
      success: true,
      message: 'Profit distribution completed successfully'
    })
  } catch (error) {
    console.error('Error in manual profit distribution:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to distribute profits'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Same as GET for flexibility
  return GET(request)
}
