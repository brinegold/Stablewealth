# Stable Wealth - Smart Crypto Growth Platform

A comprehensive cryptocurrency investment platform built with Next.js, Supabase, and TypeScript. Features investment plans, referral system, staking, and automated profit distribution.

## 🚀 Features

### Investment Plans
- **Plan A**: $1-$50, 2% daily returns, 100 JRC coins
- **Plan B**: $51-$500, 4% daily returns, 1,000 JRC coins  
- **Plan C**: $500-$50,000, 5% daily returns, 10,000 JRC coins

### Referral System
- 10-level deep commission structure
- Level 1: 15% commission
- Level 2: 10% commission
- Level 3: 5% commission
- Level 4: 3% commission
- Level 5: 2% commission
- Level 6: 1% commission
- Level 7: 0.5% commission
- Level 8: 0.2% commission
- Level 9: 0.1% commission
- Level 10: 0.05% commission

### Wallet System
- **Main Wallet**: Receives profits and referral commissions
- **Fund Wallet**: Used for investments and transfers
- Instant internal transfers between wallets

### Staking Options
- **USD Staking**: 8-25% APY based on lock period
- **JRC Coin Staking**: 10-30% APY for coin holders
- Minimum $50 for USD staking, 100 JRC for coin staking

### Transaction Fees
- **Deposit Fee**: 1% of deposit amount
- **Withdrawal Fee**: 10% of withdrawal amount
- **Transfer Fee**: No fees for internal transfers

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS with custom gradient themes
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Authentication**: Supabase Auth with Row Level Security
- **Icons**: Lucide React

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd jarvis-staking-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Run the SQL schema from `supabase/schema.sql` in your Supabase SQL editor

4. **Configure environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Update `.env.local` with your credentials:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # BSC Configuration
   BSC_RPC_URL=https://bsc-dataseed1.binance.org/
   USDT_CONTRACT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
   PAYMENT_CONTRACT_ADDRESS=your_deployed_contract_address
   ADMIN_FEE_WALLET=your_admin_fee_wallet_address
   GLOBAL_ADMIN_WALLET=your_global_admin_wallet_address
   BSC_PRIVATE_KEY=your_bsc_private_key
   WALLET_SEED=your_wallet_generation_seed
   
   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   
   # Profit Distribution (in minutes)
   PROFIT_DISTRIBUTION_INTERVAL=1    # 1 minute for testing, 60 for production
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🗄️ Database Schema

The platform uses the following main tables:

- **profiles**: User profiles with wallet balances and referral codes
- **investment_plans**: User investment plans with daily percentages
- **transactions**: All financial transactions (deposits, withdrawals, profits)
- **referrals**: Referral relationships up to 10 levels
- **referral_commissions**: Commission tracking and payments
- **profit_distributions**: Daily profit distribution records

## 🔄 Automated Systems

### Profit Distribution
- Runs every hour to distribute profits gradually
- Calculates hourly profits (daily percentage ÷ 24)
- Automatically updates user balances and creates transaction records

### Referral Commissions
- Automatically calculated on new deposits
- Builds referral chains up to 10 levels deep
- Instant commission payments to referrer wallets

## 🔗 BSC Integration

### Blockchain Features
- **Real USDT Deposits**: Users send USDT to generated BSC wallet addresses
- **Transaction Verification**: Automatic verification of blockchain transactions
- **Smart Contract Integration**: Uses PaymentProcessor.sol for secure operations
- **Automated Processing**: Deposits processed automatically after verification

### How It Works
1. **Wallet Generation**: Each user gets a unique BSC wallet address
2. **Deposit Process**: Users send USDT to their wallet address
3. **Transaction Verification**: System verifies the transaction on BSC
4. **Automatic Processing**: Funds are processed and added to user account
5. **Referral Commissions**: Automatic distribution to referral network

### Withdrawal Process
1. **Request Submission**: Users submit withdrawal requests with BSC address
2. **Admin Approval**: Withdrawals require admin approval for security
3. **Blockchain Transfer**: USDT sent directly to user's BSC wallet
4. **Fee Deduction**: 10% withdrawal fee automatically calculated

## 🎨 UI/UX Features

- **Responsive Design**: Mobile-first approach with bottom navigation
- **Purple Gradient Theme**: Matches modern crypto platform aesthetics
- **Floating Animations**: Smooth transitions and hover effects
- **Real-time Updates**: Live balance updates and transaction status

## 🔐 Security Features

- **Row Level Security (RLS)**: Database-level access control
- **Authentication**: Secure user registration and login
- **Password Protection**: Required for sensitive operations
- **Transaction Validation**: Server-side validation for all operations

## 📱 Mobile Experience

- **Bottom Navigation**: Easy thumb navigation on mobile devices
- **Touch-Friendly**: Large buttons and touch targets
- **Progressive Web App**: Can be installed on mobile devices
- **Offline Support**: Basic functionality works offline

## 🚀 Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Manual Deployment
```bash
npm run build
npm start
```

## 🔧 Configuration

### Investment Plans
Edit the plans configuration in `/app/dashboard/invest/page.tsx`:

```typescript
const plans = {
  A: {
    minAmount: 1,
    maxAmount: 50,
    dailyPercentage: 2,
    tokensPerDollar: 1000
  },
  // ... other plans
}
```

### Referral Levels
Modify referral percentages in `/supabase/schema.sql`:

```sql
commission_rates DECIMAL[] := ARRAY[15.0, 10.0, 5.0, 3.0, 2.0, 1.0, 0.5, 0.2, 0.1, 0.05];
```

## 📊 Analytics & Monitoring

- **Transaction Tracking**: All financial operations are logged
- **User Activity**: Login, registration, and action tracking
- **Profit Distribution**: Automated logging of all profit distributions
- **Referral Performance**: Commission tracking and genealogy

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check the documentation in `/docs`

## 🔮 Roadmap

- [ ] Mobile app development (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Additional payment gateways
- [ ] NFT marketplace integration
- [ ] DeFi protocol integration

---

**Stable Wealth Platform** - Revolutionizing cryptocurrency investments with smart automation and user-friendly design.
