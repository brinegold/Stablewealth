import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase-server'
import EmailService from '@/lib/email-service'
import { referralService } from '@/lib/referralService'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement proper admin authentication
    const supabase = createSupabaseServerClient()

    const { requestId, adminNotes } = await request.json()

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 })
    }

    // Process the approval using the database function
    const { data: result, error: processError } = await supabase
      .rpc('process_manual_deposit_approval', {
        p_request_id: requestId,
        p_admin_id: null, // TODO: Get actual admin ID from session
        p_admin_notes: adminNotes || null
      })

    if (processError) {
      console.error('Error processing deposit approval:', processError)
      return NextResponse.json({
        error: 'Failed to process deposit approval'
      }, { status: 500 })
    }

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Failed to approve deposit'
      }, { status: 400 })
    }

    // Get the deposit request details for email notification
    const { data: depositRequest } = await supabase
      .from('deposit_requests')
      .select(`
        *,
        user_profile:profiles!deposit_requests_user_id_fkey(full_name, username)
      `)
      .eq('id', requestId)
      .single()

    // Process referral commissions for the deposit
    try {
      await referralService.processReferralCommissions({
        userId: depositRequest.user_id,
        amount: result.amount,
        transactionType: 'deposit',
        planType: 'deposit'
      })
    } catch (commissionError) {
      console.error('Error processing referral commissions:', commissionError)
      // Don't fail the deposit if commission processing fails
      // Admin can manually fix commissions later
    }

    // Send approval email to user
    try {
      const { data: authUser } = await (supabaseAdmin.auth as any).admin.getUserById(depositRequest.user_id)

      if (authUser.user?.email) {
        const emailService = new EmailService()
        await emailService.sendDepositNotification(
          authUser.user.email,
          depositRequest.user_profile?.full_name || 'User',
          result.net_amount,
          depositRequest.currency,
          'success',
          depositRequest.tx_hash,
          result.fee,
          result.net_amount
        )
        console.log("Deposit approval email sent")
      }
    } catch (emailError) {
      console.error("Failed to send deposit approval email:", emailError)
      // Don't fail the approval if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Deposit request approved successfully",
      transactionId: result.transaction_id,
      amount: result.amount,
      fee: result.fee,
      netAmount: result.net_amount
    })

  } catch (error: any) {
    console.error("Error approving deposit request:", error)
    return NextResponse.json({
      error: error.message || "Failed to approve deposit request"
    }, { status: 500 })
  }
}
