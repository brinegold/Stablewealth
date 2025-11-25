# Profit Distribution System

## Overview
The Stable Wealth platform includes a profit distribution system that distributes daily profits to users 24 hours after they invest in a plan.

## How It Works

### Profit Calculation
- **Daily Rate**: Each investment plan has a daily percentage (Plan A: 2%, Plan B: 4%, Plan C: 5%)
- **Profit Amount**: `Investment Amount × (Daily Percentage / 100)`
- **24-Hour Rule**: Users receive their first profit 24 hours after investing

### Distribution Process
1. **Fetches Active Plans**: Gets all active investment plans from the database
2. **Checks Eligibility**: Only processes plans that are at least 24 hours old
3. **Calculates Profits**: Computes daily profit for each eligible plan
4. **Updates Balances**: Adds profits to users' main wallet balances
5. **Creates Transactions**: Records profit transactions for audit trail
6. **Updates Plan Totals**: Tracks total profits earned per investment plan

## Current Status ✅

### ✅ What's Working:
- Profit distribution logic is implemented
- 24-hour waiting period enforced per investment plan
- Database tables are created (`profit_distributions`)
- Manual trigger via admin dashboard
- API endpoints for profit distribution
- **Automatic profit distribution** running at configurable intervals
- Server auto-initialization on startup

## Automatic Profit Distribution

The system now runs automatically in the background. Profits are distributed:

1. **Automatically** at configurable intervals (default: 1 minute for testing)
2. **On server startup** - initializes automatically when the app loads
3. **24-hour rule applies**: Only plans created 24+ hours ago will receive profits
4. **Manual trigger available** via admin dashboard or API

### Configuration

Set the distribution interval in your `.env.local` file:

```env
# Profit Distribution Interval (in minutes)
PROFIT_DISTRIBUTION_INTERVAL=1    # For testing (every minute)
# PROFIT_DISTRIBUTION_INTERVAL=60   # For production (every hour)
# PROFIT_DISTRIBUTION_INTERVAL=1440 # For production (every 24 hours)
```

### Manual Triggering (Optional)
- **Admin Dashboard**: Login as admin → Go to `/admin` → Click "Distribute Profits"
- **API Endpoint**: `POST /api/admin/distribute-profits` (requires admin auth)
- **Start/Restart**: `GET /api/init` or `POST /api/profit-distribution/start`

## How Automatic Distribution Works
1. **Server Starts**: App initializes and calls `/api/init`
2. **Interval Set**: System starts running every X minutes (configurable)
3. **Checks Plans**: Every interval, checks all active investment plans
4. **24-Hour Check**: Only processes plans older than 24 hours
5. **Distributes Profits**: Adds daily profits to user wallets
6. **Prevents Duplicates**: Won't distribute twice in the same day

## Manual Testing

### Via Admin Dashboard:
1. Login as admin
2. Go to `/admin`
3. Click "Distribute Profits" button

### Via API:
```bash
curl -X POST https://your-domain.com/api/admin/distribute-profits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

## Database Tables

### profit_distributions
- `id`: UUID primary key
- `plan_id`: Reference to investment plan
- `user_id`: Reference to user
- `profit_amount`: Amount distributed
- `distribution_date`: Date of distribution
- `created_at`: Timestamp

## Monitoring

### Check Distribution Status:
- Admin dashboard shows recent distributions
- API endpoint: `GET /api/admin/distribute-profits`
- Database query: `SELECT * FROM profit_distributions ORDER BY created_at DESC`

### Logs:
- Check server logs for distribution messages
- Each distribution logs user updates and amounts

## Security

### API Protection:
- Admin endpoints require admin privileges
- Cron endpoint requires secret token
- All operations are logged

### Data Integrity:
- Prevents duplicate distributions for the same day
- Validates user balances before updates
- Creates audit trail via transactions table

## Troubleshooting

### Common Issues:
1. **No distributions happening**: Check if cron job is set up correctly
2. **Duplicate distributions**: System prevents this automatically
3. **Balance not updating**: Check transaction logs and error messages

### Debug Steps:
1. Check admin dashboard for recent distributions
2. Verify investment plans are marked as `is_active = true`
3. Check server logs for error messages
4. Manually trigger distribution to test

## Next Steps

The system is now ready to use:
1. **Users invest** in plans and wait 24 hours
2. **Admin triggers** profit distribution when needed
3. **Monitor** logs and user balances via admin dashboard
4. **24-hour rule** ensures fair profit distribution timing

The system now distributes profits on-demand with a 24-hour waiting period per investment plan! 🚀
