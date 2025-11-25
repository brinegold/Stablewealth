-- ============================================================================
-- RESET ROI AND PENDING WITHDRAWALS - FRESH START
-- ============================================================================
-- This script will:
-- 1. Reset all accumulated profits (80% ROI) back to 0
-- 2. Cancel all pending withdrawal requests
-- 3. Return main wallet balances to 0 (since profits go to main wallet)
-- 4. Preserve original investment amounts in investment_plans
-- 5. Keep fund_wallet_balance intact (deposits)
-- 6. Keep total_jarvis_tokens intact
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Cancel all pending withdrawal requests
-- ============================================================================
UPDATE public.transactions
SET 
    status = 'cancelled',
    description = COALESCE(description, '') || ' - Cancelled during system reset',
    updated_at = NOW()
WHERE 
    transaction_type = 'withdrawal' 
    AND status = 'pending';

-- Log the number of cancelled withdrawals
DO $$
DECLARE
    cancelled_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO cancelled_count
    FROM public.transactions
    WHERE transaction_type = 'withdrawal' AND status = 'cancelled' AND updated_at > NOW() - INTERVAL '1 minute';
    
    RAISE NOTICE 'Cancelled % pending withdrawal requests', cancelled_count;
END $$;

-- ============================================================================
-- STEP 2: Reset all accumulated profits in investment_plans to 0
-- ============================================================================
-- This resets the total_profit_earned for all investment plans
-- The investment_amount (original capital) remains intact
UPDATE public.investment_plans
SET 
    total_profit_earned = 0,
    updated_at = NOW()
WHERE total_profit_earned > 0;

-- Log the number of investment plans reset
DO $$
DECLARE
    reset_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO reset_count
    FROM public.investment_plans
    WHERE updated_at > NOW() - INTERVAL '1 minute';
    
    RAISE NOTICE 'Reset profits for % investment plans', reset_count;
END $$;

-- ============================================================================
-- STEP 3: Reset main wallet balances to 0
-- ============================================================================
-- Main wallet holds the accumulated profits (80% of daily ROI)
-- We reset this to 0 since we're clearing all profits
UPDATE public.profiles
SET 
    main_wallet_balance = 0,
    updated_at = NOW()
WHERE main_wallet_balance > 0;

-- Log the number of wallets reset
DO $$
DECLARE
    wallet_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO wallet_count
    FROM public.profiles
    WHERE updated_at > NOW() - INTERVAL '1 minute';
    
    RAISE NOTICE 'Reset main wallet balance for % users', wallet_count;
END $$;

-- ============================================================================
-- STEP 4: Mark all profit transactions as cancelled (optional - for clean history)
-- ============================================================================
-- This cancels all profit distribution transactions to reflect the reset
UPDATE public.transactions
SET 
    status = 'cancelled',
    description = COALESCE(description, '') || ' - Cancelled during system reset',
    updated_at = NOW()
WHERE 
    transaction_type = 'profit' 
    AND status = 'completed';

-- Log the number of profit transactions cancelled
DO $$
DECLARE
    profit_tx_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO profit_tx_count
    FROM public.transactions
    WHERE transaction_type = 'profit' AND status = 'cancelled' AND updated_at > NOW() - INTERVAL '1 minute';
    
    RAISE NOTICE 'Cancelled % profit transactions', profit_tx_count;
END $$;

-- ============================================================================
-- STEP 5: Delete all profit distribution records (optional - clean slate)
-- ============================================================================
-- If you have a profit_distributions table, clear it
-- Uncomment if this table exists in your schema
-- DELETE FROM public.profit_distributions;
-- RAISE NOTICE 'Deleted all profit distribution records';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show summary of what was preserved
SELECT 
    'PRESERVED DATA' as category,
    COUNT(*) as count,
    SUM(investment_amount) as total_investment_amount,
    SUM(total_profit_earned) as total_profit_earned
FROM public.investment_plans
WHERE is_active = true;

-- Show summary of user balances
SELECT 
    'USER BALANCES' as category,
    COUNT(*) as user_count,
    SUM(main_wallet_balance) as total_main_wallet,
    SUM(fund_wallet_balance) as total_fund_wallet,
    SUM(total_jarvis_tokens) as total_jarvis_tokens
FROM public.profiles;

-- Show cancelled withdrawals
SELECT 
    'CANCELLED WITHDRAWALS' as category,
    COUNT(*) as count,
    SUM(amount) as total_amount
FROM public.transactions
WHERE transaction_type = 'withdrawal' AND status = 'cancelled';

-- Show cancelled profit transactions
SELECT 
    'CANCELLED PROFITS' as category,
    COUNT(*) as count,
    SUM(amount) as total_amount
FROM public.transactions
WHERE transaction_type = 'profit' AND status = 'cancelled';

-- ============================================================================
-- DETAILED VERIFICATION - Check a sample user
-- ============================================================================
-- This shows the state of the first user with an investment
SELECT 
    p.id as user_id,
    p.username,
    p.main_wallet_balance,
    p.fund_wallet_balance,
    p.total_jarvis_tokens,
    ip.plan_type,
    ip.investment_amount as original_investment,
    ip.total_profit_earned as current_profit,
    ip.is_active
FROM public.profiles p
LEFT JOIN public.investment_plans ip ON p.id = ip.user_id
WHERE ip.id IS NOT NULL
LIMIT 5;

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
SELECT 
    '✅ RESET COMPLETE!' as status,
    'All ROI profits reset to 0' as profits,
    'All pending withdrawals cancelled' as withdrawals,
    'Original investments preserved' as investments,
    'Fund wallets intact' as deposits,
    'Jarvis tokens intact' as tokens;
