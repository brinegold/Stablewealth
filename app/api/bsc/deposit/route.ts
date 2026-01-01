import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase-server'

import EmailService from '@/lib/email-service'
import { referralService } from '@/lib/referralService'

// Force dynamic rendering
export const dynamic = 'force-dynamic'



export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    // Parse request body
    const { txHash, expectedAmount, userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (!txHash) {
      return NextResponse.json({ error: 'Transaction hash is required' }, { status: 400 })
    }

    if (!expectedAmount || isNaN(parseFloat(expectedAmount))) {
      return NextResponse.json({ error: 'Valid deposit amount is required' }, { status: 400 })
    }

    const expectedAmountNum = parseFloat(expectedAmount)
    if (expectedAmountNum < 10) {
      return NextResponse.json({ error: 'Minimum deposit amount is $10 USDT' }, { status: 400 })
    }

    if (expectedAmountNum > 50000) {
      return NextResponse.json({ error: 'Maximum deposit amount is $50,000 USDT' }, { status: 400 })
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

    // For manual transactions, we trust the user's input initially but mark it as pending
    // In a real production app with manual verification, you'd likely want to just create a 'pending' record
    // and have an admin approve it.

    // However, if the user wants "manual transactions" but still calls this endpoint with a txHash,
    // they might expect it to just work if they provide the hash.
    // Since we removed BSCService, we can't verify the hash on-chain here.

    // We will create a PENDING transaction record.

    const depositAmount = parseFloat(expectedAmount)

    // Check if transaction already processed
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('reference_id', txHash)
      .single()

    if (existingTx) {
      return NextResponse.json({ error: "Transaction already processed" }, { status: 400 })
    }

    // Insert pending transaction
    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: depositAmount,
        transaction_type: 'deposit',
        status: 'pending',
        reference_id: txHash,
        description: `Deposit of ${depositAmount} USDT (Manual Verification)`
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error recording deposit:', insertError)
      return NextResponse.json({ error: 'Failed to record deposit' }, { status: 500 })
    }

    console.log("Deposit recorded successfully (Pending Admin Approval)")

    // Send pending deposit email notification
    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single()

      // Get user email from auth
      const { data: authUser } = await (supabaseAdmin.auth as any).admin.getUserById(userId)

      if (userProfile && authUser.user?.email) {
        const emailService = new EmailService()
        // Send pending notification (you might want to create a specific method for this)
        console.log("Deposit pending - email notification skipped for now")
      }
    } catch (emailError) {
      console.error("Failed to send deposit email:", emailError)
      // Don't fail the transaction if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Deposit submitted successfully. Please wait for admin approval.",
      amount: depositAmount,
      txHash: txHash,
      status: 'pending'
    })

  } catch (error: any) {
    console.error("Error processing BSC deposit:", error)

    // TODO: Send failure email notification (need user email from auth)

    return NextResponse.json({ error: error.message || "Failed to process deposit" }, { status: 500 })
  }
}

// Admin endpoint to approve deposits
export async function PUT(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    // TODO: Add admin role check here
    // For now, any authenticated user can approve (should be restricted to admins)

    const { transactionId, approve } = await request.json()

    if (!transactionId || approve === undefined) {
      return NextResponse.json({ error: 'Transaction ID and approval status are required' }, { status: 400 })
    }

    // Get the deposit transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('transaction_type', 'deposit')
      .eq('status', 'pending')
      .single()

    if (txError || !transaction) {
      return NextResponse.json({ error: 'Deposit transaction not found' }, { status: 404 })
    }

    if (approve) {
      // Process the deposit with referral commissions
      try {
        const depositAmount = parseFloat(transaction.amount.toString())
        const fee = depositAmount * 0.01
        const netAmount = depositAmount - fee

        // Use the database function to process the entire deposit with referral commissions
        const { error: depositError } = await supabase
          .rpc('process_bsc_deposit', {
            p_user_id: transaction.user_id,
            p_deposit_amount: depositAmount,
            p_fee_amount: fee,
            p_net_amount: netAmount,
            p_tx_hash: transaction.reference_id,
            p_from_address: 'manual',
            p_to_address: 'manual'
          })

        if (depositError) {
          console.error('Error processing deposit:', depositError)
          return NextResponse.json({ error: 'Failed to process deposit' }, { status: 500 })
        }

        // Process referral commissions for the deposit
        try {
          await referralService.processReferralCommissions({
            userId: transaction.user_id,
            amount: depositAmount,
            transactionType: 'deposit',
            planType: 'deposit'
          })
        } catch (commissionError) {
          console.error('Error processing referral commissions:', commissionError)
          // Don't fail the deposit if commission processing fails
          // Admin can manually fix commissions later
        }

        // Update transaction status to completed
        await supabase
          .from('transactions')
          .update({
            status: 'completed',
            description: `${transaction.description} - Approved`
          })
          .eq('id', transactionId)

        // Send success email notification
        try {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', transaction.user_id)
            .single()

          const { data: authUser } = await (supabaseAdmin.auth as any).admin.getUserById(transaction.user_id)

          if (userProfile && authUser.user?.email) {
            const emailService = new EmailService()
            await emailService.sendDepositNotification(
              authUser.user.email,
              userProfile.full_name || 'User',
              netAmount,
              'USDT',
              'success',
              transaction.reference_id || '',
              fee,
              netAmount
            )
            console.log("Deposit success email sent")
          }
        } catch (emailError) {
          console.error("Failed to send deposit success email:", emailError)
        }

        return NextResponse.json({
          success: true,
          message: "Deposit approved and processed successfully"
        })

      } catch (error: any) {
        console.error('Error approving deposit:', error)
        return NextResponse.json({ error: `Deposit approval failed: ${error.message}` }, { status: 500 })
      }
    } else {
      // Reject the deposit - just delete the pending transaction
      await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)

      return NextResponse.json({
        success: true,
        message: "Deposit rejected and removed"
      })
    }

  } catch (error: any) {
    console.error("Error processing deposit approval:", error)
    return NextResponse.json({ error: error.message || "Failed to process deposit approval" }, { status: 500 })
  }
}
