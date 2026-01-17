-- Optimized referral system functions for better performance
-- These functions reduce the number of database queries and improve loading times

-- Function to get referral chain recursively in a single query
DROP FUNCTION IF EXISTS get_referral_chain_recursive(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_referral_chain_recursive(
    start_user_id UUID,
    max_levels INTEGER DEFAULT 6
)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    referral_code TEXT,
    main_wallet_balance DECIMAL,
    level INTEGER,
    created_at TIMESTAMPTZ
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
            0 as current_level,
            p.sponsor_id,
            p.created_at
        FROM profiles p
        WHERE p.id = start_user_id
        
        UNION ALL
        
        -- Recursive case: find the referrer at each level
        SELECT 
            referrer.id,
            referrer.full_name,
            referrer.referral_code,
            referrer.main_wallet_balance,
            rc.current_level + 1,
            referrer.sponsor_id,
            referrer.created_at
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
        rc.current_level as level,
        rc.created_at
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

SELECT 'Referral optimization functions created successfully!' as status;
