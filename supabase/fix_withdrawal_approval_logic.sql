-- Fix withdrawal approval logic to update existing transaction instead of creating new one

-- Function to approve withdrawal request (admin only)
CREATE OR REPLACE FUNCTION approve_withdrawal_request(
    p_request_id UUID,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    withdrawal_record RECORD;
    user_balance DECIMAL;
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Get withdrawal request details
    SELECT * INTO withdrawal_record
    FROM public.withdrawal_requests
    WHERE id = p_request_id AND status = 'pending';
    
    IF withdrawal_record IS NULL THEN
        RAISE EXCEPTION 'Withdrawal request not found or already processed';
    END IF;
    
    -- Check user's current balance
    SELECT main_wallet_balance INTO user_balance
    FROM public.profiles
    WHERE id = withdrawal_record.user_id;
    
    IF user_balance < withdrawal_record.amount THEN
        RAISE EXCEPTION 'User has insufficient balance for withdrawal';
    END IF;
    
    -- Deduct amount from user's main wallet
    UPDATE public.profiles
    SET main_wallet_balance = main_wallet_balance - withdrawal_record.amount
    WHERE id = withdrawal_record.user_id;
    
    -- Update withdrawal request status
    UPDATE public.withdrawal_requests
    SET 
        status = 'approved',
        processed_at = NOW(),
        admin_notes = p_admin_notes
    WHERE id = p_request_id;
    
    -- Update existing transaction record status to completed
    UPDATE public.transactions
    SET 
        status = 'completed',
        description = 'Withdrawal approved: ' || COALESCE(p_admin_notes, ''),
        updated_at = NOW()
    WHERE reference_id = p_request_id::TEXT AND transaction_type = 'withdrawal';
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject withdrawal request (admin only)
CREATE OR REPLACE FUNCTION reject_withdrawal_request(
    p_request_id UUID,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Update withdrawal request status
    UPDATE public.withdrawal_requests
    SET 
        status = 'rejected',
        processed_at = NOW(),
        admin_notes = p_admin_notes
    WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal request not found or already processed';
    END IF;
    
    -- Update existing transaction record status to failed (cancelled)
    UPDATE public.transactions
    SET 
        status = 'failed',
        description = 'Withdrawal rejected: ' || COALESCE(p_admin_notes, ''),
        updated_at = NOW()
    WHERE reference_id = p_request_id::TEXT AND transaction_type = 'withdrawal';
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Withdrawal approval logic fixed successfully!' as status;
