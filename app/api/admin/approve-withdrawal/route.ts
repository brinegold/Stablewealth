import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase-server'
import BSCService from '@/lib/bsc-service'
import EmailService from '@/lib/email-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const BSC_CONFIG = {
  rpcUrl: process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org/",
  contractAddress: process.env.PAYMENT_CONTRACT_ADDRESS || "",
  usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || "0x55d398326f99059fF775485246999027B3197955",
  adminFeeWallet: process.env.ADMIN_FEE_WALLET || "",
  globalAdminWallet: process.env.GLOBAL_ADMIN_WALLET || "",
  privateKey: process.env.BSC_PRIVATE_KEY || ""
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement proper admin authentication
    const supabase = createSupabaseServerClient()

    const { withdrawalId, action, txHash } = await request.json()

    if (!withdrawalId || !action) {
      return NextResponse.json({ error: 'Withdrawal ID and action are required' }, { status: 400 })
    }

    // Get withdrawal request details
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('withdrawal_requests')
      .select(`
        *,
        profiles!inner(username, main_wallet_balance)
      `)
      .eq('id', withdrawalId)
      .eq('status', 'pending')
      .single()

    if (withdrawalError || !withdrawal) {
      return NextResponse.json({ error: 'Withdrawal request not found or already processed' }, { status: 404 })
    }

    if (action === 'approve') {
      if (!txHash) {
        return NextResponse.json({ error: 'Transaction Hash is required for approval' }, { status: 400 })
      }

      try {
        console.log('Processing manual withdrawal approval:', {
          withdrawalId,
          amount: withdrawal.amount,
          walletAddress: withdrawal.wallet_address,
          userId: withdrawal.user_id,
          txHash
        })

        // Calculate fee amount (10% fee)
        const withdrawalFee = withdrawal.amount * 0.10

        // Use database function to approve withdrawal with manual blockchain hash
        const { error: approvalError } = await supabase.rpc('approve_withdrawal_request', {
          p_request_id: withdrawalId,
          p_admin_notes: `Approved manually. User TX: ${txHash}`
        })

        if (approvalError) throw approvalError

        // Update the withdrawal request with blockchain transaction hash
        await supabase
          .from('withdrawal_requests')
          .update({
            admin_notes: `User TX: ${txHash}`
          })
          .eq('id', withdrawalId)

        const netAmount = withdrawal.amount - withdrawalFee;

        // Send approval success email notification
        try {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', withdrawal.user_id)
            .single()

          // Get user email from auth - with debugging
          console.log("Attempting to get user email for ID:", withdrawal.user_id)

          let userEmail = null
          try {
            const { data: authUser } = await (supabaseAdmin.auth as any).admin.getUserById(withdrawal.user_id)
            console.log("Auth user data:", authUser)
            userEmail = authUser?.user?.email
          } catch (authError) {
            console.error("Failed to get user from auth:", authError)

            // Fallback: try to get email from profiles table if it exists
            const { data: profileWithEmail } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', withdrawal.user_id)
              .single()

            userEmail = profileWithEmail?.email
            console.log("Fallback email from profiles:", userEmail)
          }

          if (userProfile) {
            // Use found email or skip if no email available
            if (userEmail) {
              const emailService = new EmailService()
              console.log("Sending email to:", userEmail)
              await emailService.sendWithdrawalNotification(
                userEmail,
                userProfile.full_name || 'User',
                withdrawal.amount,
                'USDT',
                'success',
                withdrawal.wallet_address,
                `Your withdrawal of ${withdrawal.amount} USDT has been approved and processed successfully. Net amount: ${netAmount} USDT (after 10% fee). Transaction Hash: ${txHash}`
              )
              console.log("Withdrawal approval email sent successfully")
            } else {
              console.log("No email found for user:", withdrawal.user_id, "- skipping email notification")
            }
          }
        } catch (emailError) {
          console.error("Failed to send withdrawal approval email:", emailError)
          // Don't fail the approval if email fails
        }

        return NextResponse.json({
          success: true,
          message: 'Withdrawal approved and processed manually',
          txHash: txHash,
          netAmount,
          withdrawalFee
        })

      } catch (error: any) {
        console.error('Error processing manual withdrawal:', error)

        return NextResponse.json({
          error: `Withdrawal processing failed: ${error.message}`,
          details: 'Failed to process manual withdrawal approval'
        }, { status: 500 })
      }

    } else if (action === 'reject') {
      // Use database function to reject withdrawal
      const { error: rejectionError } = await supabase.rpc('reject_withdrawal_request', {
        p_request_id: withdrawalId,
        p_admin_notes: `Manually rejected by admin at ${new Date().toISOString()}`
      })

      if (rejectionError) throw rejectionError

      // Send rejection email notification
      try {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', withdrawal.user_id)
          .single()

        if (userProfile) {
          console.log("Withdrawal rejected - email notification skipped (user email retrieval needs to be implemented)")
        }
      } catch (emailError) {
        console.error("Failed to send withdrawal rejection email:", emailError)
      }

      return NextResponse.json({
        success: true,
        message: 'Withdrawal rejected successfully'
      })

    } else {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
    }

  } catch (error: any) {
    console.error('Error in withdrawal approval:', error)
    return NextResponse.json({
      error: error.message || 'Failed to process withdrawal approval'
    }, { status: 500 })
  }
}
