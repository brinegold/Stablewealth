-- Fix get_referral_stats_optimized function to remove usage of non-existent column usdt_commission

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
            'totalReferrals', 0,
            'levelStats', '[]'::json
        );
    END IF;
    
    -- Build comprehensive stats in a single query
    SELECT json_build_object(
        'totalUsdtEarned', COALESCE(totals.total_usdt, 0),
        'totalReferrals', COALESCE(all_referrals_count.count, 0),
        'levelStats', COALESCE(level_stats.stats, '[]'::json)
    ) INTO stats
    FROM (
        -- Calculate totals
        SELECT 
            SUM(COALESCE(commission_amount, 0)) as total_usdt
        FROM referral_commissions
        WHERE referrer_id = user_id
    ) totals
    CROSS JOIN (
        -- Count ALL referrals across all levels (unique referred_id)
        SELECT COUNT(DISTINCT referred_id) as count
        FROM referral_commissions
        WHERE referrer_id = user_id
    ) all_referrals_count
    CROSS JOIN (
        -- Level statistics
        SELECT json_agg(
            json_build_object(
                'level', level_data.level,
                'count', COALESCE(level_data.referral_count, 0),
                'usdtEarned', COALESCE(level_data.usdt_earned, 0),
                'usdtRate', level_data.usdt_rate
            ) ORDER BY level_data.level
        ) as stats
        FROM (
            SELECT 
                levels.level,
                levels.usdt_rate,
                COUNT(DISTINCT rc.referred_id) as referral_count,
                SUM(COALESCE(rc.commission_amount, 0)) as usdt_earned
            FROM (
                VALUES 
                (1, 10), (2, 5), (3, 3), (4, 2), (5, 1), (6, 0.5)
            ) AS levels(level, usdt_rate)
            LEFT JOIN referral_commissions rc ON rc.referrer_id = user_id AND rc.level = levels.level
            GROUP BY levels.level, levels.usdt_rate
        ) level_data
    ) level_stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_referral_stats_optimized TO authenticated;
