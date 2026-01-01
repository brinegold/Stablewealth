-- Consolidated Missing Functions Migration
-- Run this file in your Supabase SQL Editor to restore all missing functions

-- ==========================================
-- 1. Referral Optimization Functions
-- ==========================================

-- Function to get referral chain recursively in a single query
CREATE OR REPLACE FUNCTION get_referral_chain_recursive(
    start_user_id UUID,
    max_levels INTEGER DEFAULT 4
)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    referral_code TEXT,
    main_wallet_balance DECIMAL,
    total_jarvis_tokens DECIMAL,
    level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE referral_chain AS (
        -- Base case: start with the given user
        SELECT 
            p.id,
            p.full_name,
            p.referral_code,
            p.main_wallet_balance,
            p.total_jarvis_tokens,
            0 as current_level,
            p.sponsor_id
        FROM profiles p
        WHERE p.id = start_user_id
        
        UNION ALL
        
        -- Recursive case: find the referrer at each level
        SELECT 
            referrer.id,
            referrer.full_name,
            referrer.referral_code,
            referrer.main_wallet_balance,
            referrer.total_jarvis_tokens,
            rc.current_level + 1,
            referrer.sponsor_id
        FROM referral_chain rc
        JOIN profiles referrer ON referrer.referral_code = rc.sponsor_id
        WHERE rc.current_level < max_levels
        AND rc.sponsor_id IS NOT NULL
    )
    SELECT 
        rc.id,
        rc.full_name,
        rc.referral_code,
        rc.main_wallet_balance,
        rc.total_jarvis_tokens,
        rc.current_level as level
    FROM referral_chain rc
    WHERE rc.current_level > 0  -- Exclude the starting user
    ORDER BY rc.current_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get referral statistics efficiently
CREATE OR REPLACE FUNCTION get_referral_stats_optimized(
    user_id UUID
)
RETURNS JSON AS $$
DECLARE
    user_referral_code TEXT;
    stats JSON;
BEGIN
    -- Get user's referral code
    SELECT referral_code INTO user_referral_code
    FROM profiles
    WHERE id = user_id;
    
    IF user_referral_code IS NULL THEN
        RETURN json_build_object(
            'totalUsdtEarned', 0,
            'totalJrcEarned', 0,
            'totalReferrals', 0,
            'levelStats', '[]'::json
        );
    END IF;
    
    -- Build comprehensive stats in a single query
    SELECT json_build_object(
        'totalUsdtEarned', COALESCE(totals.total_usdt, 0),
        'totalJrcEarned', COALESCE(totals.total_jrc, 0),
        'totalReferrals', COALESCE(direct_count.count, 0),
        'levelStats', COALESCE(level_stats.stats, '[]'::json)
    ) INTO stats
    FROM (
        -- Calculate totals
        SELECT 
            SUM(COALESCE(usdt_commission, commission_amount, 0)) as total_usdt,
            SUM(COALESCE(jrc_commission, 0)) as total_jrc
        FROM referral_commissions
        WHERE referrer_id = user_id
    ) totals
    CROSS JOIN (
        -- Count direct referrals
        SELECT COUNT(*) as count
        FROM profiles
        WHERE sponsor_id = user_referral_code
    ) direct_count
    CROSS JOIN (
        -- Level statistics
        SELECT json_agg(
            json_build_object(
                'level', level_data.level,
                'count', COALESCE(level_data.referral_count, 0),
                'usdtEarned', COALESCE(level_data.usdt_earned, 0),
                'jrcEarned', COALESCE(level_data.jrc_earned, 0),
                'usdtRate', level_data.usdt_rate,
                'jrcRate', level_data.jrc_rate
            ) ORDER BY level_data.level
        ) as stats
        FROM (
            SELECT 
                levels.level,
                levels.usdt_rate,
                levels.jrc_rate,
                COUNT(DISTINCT rc.referred_id) as referral_count,
                SUM(COALESCE(rc.usdt_commission, rc.commission_amount, 0)) as usdt_earned,
                SUM(COALESCE(rc.jrc_commission, 0)) as jrc_earned
            FROM (
                VALUES 
                (1, 5, 20), (2, 3, 15), (3, 2, 10), (4, 1, 8)
            ) AS levels(level, usdt_rate, jrc_rate)
            LEFT JOIN referral_commissions rc ON rc.referrer_id = user_id AND rc.level = levels.level
            GROUP BY levels.level, levels.usdt_rate, levels.jrc_rate
        ) level_data
    ) level_stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get direct referrals efficiently
CREATE OR REPLACE FUNCTION get_direct_referrals_count(
    user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    user_referral_code TEXT;
    referral_count INTEGER;
BEGIN
    -- Get user's referral code
    SELECT referral_code INTO user_referral_code
    FROM profiles
    WHERE id = user_id;
    
    IF user_referral_code IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Count direct referrals
    SELECT COUNT(*) INTO referral_count
    FROM profiles
    WHERE sponsor_id = user_referral_code;
    
    RETURN COALESCE(referral_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_referral_chain_recursive TO authenticated;
GRANT EXECUTE ON FUNCTION get_referral_stats_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION get_direct_referrals_count TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_sponsor_id ON profiles(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer_level ON referral_commissions(referrer_id, level);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referred_id ON referral_commissions(referred_id);


-- ==========================================
-- 2. Deposit Request Functions
-- ==========================================

-- Function to process approved deposit requests
CREATE OR REPLACE FUNCTION process_manual_deposit_approval(
  p_request_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request deposit_requests%ROWTYPE;
  v_fee_amount DECIMAL(15,2);
  v_net_amount DECIMAL(15,2);
  v_transaction_id UUID;
  v_result JSON;
BEGIN
  -- Get the deposit request
  SELECT * INTO v_request
  FROM deposit_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Deposit request not found or already processed');
  END IF;
  
  -- Calculate fee (1%) and net amount
  v_fee_amount := v_request.amount * 0.01;
  v_net_amount := v_request.amount - v_fee_amount;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    transaction_type,
    amount,
    fee,
    net_amount,
    status,
    description,
    reference_id,
    created_at
  ) VALUES (
    v_request.user_id,
    'deposit'::transaction_type,
    v_net_amount,
    v_fee_amount,
    v_net_amount,
    'completed'::transaction_status,
    'Manual deposit - ' || v_request.currency || ' (' || v_request.network || ')',
    v_request.tx_hash,
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Update user balance
  UPDATE profiles
  SET 
    main_wallet_balance = main_wallet_balance + v_net_amount,
    updated_at = NOW()
  WHERE id = v_request.user_id;

  -- Update deposit request status
  UPDATE deposit_requests
  SET 
    status = 'approved',
    processed_by = p_admin_id,
    processed_at = NOW(),
    admin_notes = p_admin_notes,
    updated_at = NOW()
  WHERE id = p_request_id;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', v_request.amount,
    'fee', v_fee_amount,
    'net_amount', v_net_amount,
    'user_id', v_request.user_id
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  -- Rollback will happen automatically
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to reject deposit requests
CREATE OR REPLACE FUNCTION reject_manual_deposit(
  p_request_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update deposit request status
  UPDATE deposit_requests
  SET 
    status = 'rejected',
    processed_by = p_admin_id,
    processed_at = NOW(),
    admin_notes = p_admin_notes,
    updated_at = NOW()
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Deposit request not found or already processed');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Deposit request rejected');
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ==========================================
-- 3. Admin Funds Management
-- ==========================================

-- Function to add funds to user wallet
CREATE OR REPLACE FUNCTION admin_add_funds_to_user(
    p_user_id UUID,
    p_amount DECIMAL,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    transaction_id UUID;
    result JSON;
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than 0';
    END IF;
    
    -- Get user details
    SELECT * INTO user_record
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Add funds to user's main wallet
    UPDATE public.profiles
    SET main_wallet_balance = main_wallet_balance + p_amount
    WHERE id = p_user_id;
    
    -- Create transaction record
    INSERT INTO public.transactions (
        user_id,
        transaction_type,
        amount,
        net_amount,
        status,
        description,
        reference_id
    ) VALUES (
        p_user_id,
        'deposit',
        p_amount,
        p_amount,
        'completed',
        'Admin fund addition: ' || COALESCE(p_admin_notes, 'Manual fund addition by admin'),
        'ADMIN_ADD_' || extract(epoch from now())::text
    ) RETURNING id INTO transaction_id;
    
    -- Get updated user balance
    SELECT main_wallet_balance INTO user_record.main_wallet_balance
    FROM public.profiles
    WHERE id = p_user_id;
    
    -- Return result
    SELECT json_build_object(
        'success', true,
        'message', 'Funds added successfully',
        'user_id', p_user_id,
        'amount_added', p_amount,
        'new_balance', user_record.main_wallet_balance,
        'transaction_id', transaction_id,
        'admin_notes', p_admin_notes
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct funds from user wallet
CREATE OR REPLACE FUNCTION admin_deduct_funds_from_user(
    p_user_id UUID,
    p_amount DECIMAL,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    transaction_id UUID;
    result JSON;
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than 0';
    END IF;
    
    -- Get user details
    SELECT * INTO user_record
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Check if user has sufficient balance
    IF user_record.main_wallet_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance. User has % but trying to deduct %', user_record.main_wallet_balance, p_amount;
    END IF;
    
    -- Deduct funds from user's main wallet
    UPDATE public.profiles
    SET main_wallet_balance = main_wallet_balance - p_amount
    WHERE id = p_user_id;
    
    -- Create transaction record
    INSERT INTO public.transactions (
        user_id,
        transaction_type,
        amount,
        net_amount,
        status,
        description,
        reference_id
    ) VALUES (
        p_user_id,
        'withdrawal',
        p_amount,
        p_amount,
        'completed',
        'Admin fund deduction: ' || COALESCE(p_admin_notes, 'Manual fund deduction by admin'),
        'ADMIN_DEDUCT_' || extract(epoch from now())::text
    ) RETURNING id INTO transaction_id;
    
    -- Get updated user balance
    SELECT main_wallet_balance INTO user_record.main_wallet_balance
    FROM public.profiles
    WHERE id = p_user_id;
    
    -- Return result
    SELECT json_build_object(
        'success', true,
        'message', 'Funds deducted successfully',
        'user_id', p_user_id,
        'amount_deducted', p_amount,
        'new_balance', user_record.main_wallet_balance,
        'transaction_id', transaction_id,
        'admin_notes', p_admin_notes
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_add_funds_to_user TO authenticated;
GRANT EXECUTE ON FUNCTION admin_deduct_funds_from_user TO authenticated;


-- ==========================================
-- 4. Admin Jarvis Token Management
-- ==========================================

-- Function to add jarvis tokens to user
CREATE OR REPLACE FUNCTION admin_add_jarvis_tokens(
    p_user_id UUID,
    p_amount INTEGER,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    transaction_id UUID;
    result JSON;
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than 0';
    END IF;
    
    -- Get user details
    SELECT * INTO user_record
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Add jarvis tokens to user
    UPDATE public.profiles
    SET total_jarvis_tokens = COALESCE(total_jarvis_tokens, 0) + p_amount
    WHERE id = p_user_id;
    
    -- Create transaction record
    INSERT INTO public.transactions (
        user_id,
        transaction_type,
        amount,
        net_amount,
        status,
        description,
        reference_id
    ) VALUES (
        p_user_id,
        'jarvis_token_add',
        p_amount,
        p_amount,
        'completed',
        'Admin jarvis token addition: ' || COALESCE(p_admin_notes, 'Manual jarvis token addition by admin'),
        'ADMIN_JRV_ADD_' || extract(epoch from now())::text
    ) RETURNING id INTO transaction_id;
    
    -- Get updated user token balance
    SELECT total_jarvis_tokens INTO user_record.total_jarvis_tokens
    FROM public.profiles
    WHERE id = p_user_id;
    
    -- Return result
    SELECT json_build_object(
        'success', true,
        'message', 'Jarvis tokens added successfully',
        'user_id', p_user_id,
        'tokens_added', p_amount,
        'new_token_balance', user_record.total_jarvis_tokens,
        'transaction_id', transaction_id,
        'admin_notes', p_admin_notes
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct jarvis tokens from user
CREATE OR REPLACE FUNCTION admin_deduct_jarvis_tokens(
    p_user_id UUID,
    p_amount INTEGER,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    transaction_id UUID;
    result JSON;
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than 0';
    END IF;
    
    -- Get user details
    SELECT * INTO user_record
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF user_record IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Check if user has sufficient tokens
    IF COALESCE(user_record.total_jarvis_tokens, 0) < p_amount THEN
        RAISE EXCEPTION 'Insufficient tokens. User has % but trying to deduct %', COALESCE(user_record.total_jarvis_tokens, 0), p_amount;
    END IF;
    
    -- Deduct jarvis tokens from user
    UPDATE public.profiles
    SET total_jarvis_tokens = COALESCE(total_jarvis_tokens, 0) - p_amount
    WHERE id = p_user_id;
    
    -- Create transaction record
    INSERT INTO public.transactions (
        user_id,
        transaction_type,
        amount,
        net_amount,
        status,
        description,
        reference_id
    ) VALUES (
        p_user_id,
        'jarvis_token_deduct',
        p_amount,
        p_amount,
        'completed',
        'Admin jarvis token deduction: ' || COALESCE(p_admin_notes, 'Manual jarvis token deduction by admin'),
        'ADMIN_JRV_DEDUCT_' || extract(epoch from now())::text
    ) RETURNING id INTO transaction_id;
    
    -- Get updated user token balance
    SELECT total_jarvis_tokens INTO user_record.total_jarvis_tokens
    FROM public.profiles
    WHERE id = p_user_id;
    
    -- Return result
    SELECT json_build_object(
        'success', true,
        'message', 'Jarvis tokens deducted successfully',
        'user_id', p_user_id,
        'tokens_deducted', p_amount,
        'new_token_balance', user_record.total_jarvis_tokens,
        'transaction_id', transaction_id,
        'admin_notes', p_admin_notes
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_add_jarvis_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION admin_deduct_jarvis_tokens TO authenticated;


-- ==========================================
-- 5. User Email Helper
-- ==========================================

-- Function to get user emails from auth.users table
CREATE OR REPLACE FUNCTION get_user_emails_by_ids(user_ids UUID[])
RETURNS TABLE (
  id UUID,
  email VARCHAR(255),
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::VARCHAR(255),
    au.last_sign_in_at
  FROM auth.users au
  WHERE au.id = ANY(user_ids);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_emails_by_ids(UUID[]) TO authenticated;

SELECT 'All missing functions restored successfully!' as status;
