import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get the global admin wallet address from environment variables
    const globalWalletAddress = "0x93888070e168617deb78670d00211eaf10899a28"

    if (!globalWalletAddress) {
      return NextResponse.json({
        error: 'Global wallet address not configured'
      }, { status: 500 })
    }

    // Validate the address format
    if (!globalWalletAddress.startsWith('0x') || globalWalletAddress.length !== 42) {
      return NextResponse.json({
        error: 'Invalid global wallet address format'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      address: globalWalletAddress,
      network: 'BEP20',
      currency: 'USDT'
    })

  } catch (error: any) {
    console.error('Error fetching global wallet address:', error)
    return NextResponse.json({
      error: error.message || 'Failed to fetch global wallet address'
    }, { status: 500 })
  }
}
