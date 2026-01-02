-- Debug query to check referral data
-- Run this to see what's being counted

-- Replace 'YOUR_USER_ID' with your actual user ID
-- You can find your user ID by running: SELECT id, email FROM auth.users WHERE email = 'your@email.com';

-- Check your referral code
SELECT id, email, referral_code, sponsor_id, full_name
FROM profiles
WHERE id = 'YOUR_USER_ID';

-- Check all profiles that have you as sponsor (direct referrals)
SELECT id, email, referral_code, sponsor_id, full_name, created_at
FROM profiles
WHERE sponsor_id = (SELECT referral_code FROM profiles WHERE id = 'YOUR_USER_ID');

-- Check all commission records
SELECT 
    rc.id,
    rc.referrer_id,
    rc.referred_id,
    rc.level,
    rc.commission_amount,
    rc.created_at,
    p.email as referred_email,
    p.full_name as referred_name
FROM referral_commissions rc
LEFT JOIN profiles p ON p.id = rc.referred_id
WHERE rc.referrer_id = 'YOUR_USER_ID'
ORDER BY rc.level, rc.created_at;

-- Count unique referrals per level
SELECT 
    level,
    COUNT(*) as total_records,
    COUNT(DISTINCT referred_id) as unique_referrals
FROM referral_commissions
WHERE referrer_id = 'YOUR_USER_ID'
GROUP BY level
ORDER BY level;

-- Test the recursive count function
SELECT count_all_referrals('YOUR_USER_ID', 6) as total_referrals_recursive;

-- Check the full stats
SELECT get_referral_stats_optimized('YOUR_USER_ID');
