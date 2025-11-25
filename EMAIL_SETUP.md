# Email Notification Setup Guide

This guide explains how to configure email notifications for the Stable Wealth Platform.

## Overview

The platform now sends automated email notifications for all transaction events including:
- ✅ **Deposit notifications** (success/failure)
- ✅ **Withdrawal notifications** (pending/success/failure/rejection)
- ✅ **Transfer notifications** (success/failure for both sender and receiver)
- ✅ **JRC Purchase notifications** (success/failure)
- ✅ **JRC Staking notifications** (success/failure)

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this password in `SMTP_PASS`

### Alternative SMTP Providers

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

#### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-username
SMTP_PASS=your-mailgun-password
```

#### AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-access-key
SMTP_PASS=your-ses-secret-key
```

## Email Templates

The system includes beautiful, responsive email templates with:
- 🎨 **Modern design** with gradient headers
- 📱 **Mobile-responsive** layout
- 🔒 **Secure transaction details**
- 🎯 **Status-specific styling** (success/failure/pending)
- 📊 **Comprehensive transaction information**

## Email Types

### 1. Deposit Notifications
- **Success**: Confirms deposit processing with transaction hash and fee details
- **Failure**: Notifies of deposit failure with error message

### 2. Withdrawal Notifications
- **Pending**: Confirms withdrawal request submission
- **Success**: Confirms successful withdrawal with blockchain transaction hash
- **Failure**: Notifies of processing failure with error details
- **Rejection**: Notifies of admin rejection with refund confirmation

### 3. Transfer Notifications
- **Main-to-Fund**: Internal wallet transfer confirmation
- **Fund-to-Fund**: User-to-user transfer (both sender and receiver get emails)
- **Failure**: Transfer failure notification with error details

### 4. JRC Purchase Notifications
- **Success**: Confirms JRC token purchase with amount and cost
- **Failure**: Notifies of purchase failure with error message

### 5. JRC Staking Notifications
- **Success**: Confirms staking activation with period and daily percentage
- **Failure**: Notifies of staking failure with error details

## Testing Email Configuration

1. **Install dependencies**:
   ```bash
   npm install nodemailer @types/nodemailer
   ```

2. **Set up environment variables** in `.env.local`

3. **Test email sending** by performing any transaction (deposit, withdrawal, transfer, etc.)

4. **Check logs** for email sending status:
   - Success: "Email sent successfully"
   - Failure: Error details in console

## Security Best Practices

- ✅ **Never hardcode** email credentials in source code
- ✅ **Use app passwords** instead of regular passwords
- ✅ **Enable 2FA** on email accounts
- ✅ **Rotate credentials** regularly
- ✅ **Monitor email sending** logs for suspicious activity

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify SMTP credentials
   - Check if 2FA is enabled and app password is used
   - Ensure "Less secure app access" is disabled (use app passwords instead)

2. **Connection Timeout**
   - Verify SMTP host and port
   - Check firewall settings
   - Try different SMTP ports (25, 465, 587)

3. **Emails Not Received**
   - Check spam/junk folders
   - Verify recipient email addresses
   - Check email provider's delivery logs

4. **Rate Limiting**
   - Gmail: 500 emails/day for free accounts
   - Consider using dedicated email services for high volume

### Debug Mode

Enable detailed logging by adding to your environment:
```env
DEBUG_EMAIL=true
```

## Production Considerations

1. **Use dedicated email service** (SendGrid, Mailgun, AWS SES) for production
2. **Set up email monitoring** and delivery tracking
3. **Configure bounce handling** for invalid email addresses
4. **Implement rate limiting** to prevent abuse
5. **Add unsubscribe functionality** for marketing emails (if applicable)

## Support

If you encounter issues with email configuration:
1. Check the console logs for detailed error messages
2. Verify all environment variables are correctly set
3. Test with a simple email service first (like Gmail)
4. Contact support with specific error messages and configuration details

---

**Note**: Email notifications are sent asynchronously and will not affect transaction processing if they fail. All transaction operations will complete successfully even if email delivery fails.
