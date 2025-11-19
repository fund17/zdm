# Registration System Setup Guide

## ✅ Completed Implementation

Full registration system with email verification using Google Sheets + Gmail!

## 📋 Features

- ✅ Email-only registration (@zmg.co.id domain)
- ✅ 6-digit verification code sent via Gmail
- ✅ Rate limiting (5 attempts/hour)
- ✅ Code expiration (15 minutes)
- ✅ Secure password hashing (bcrypt)
- ✅ JWT tokens for verification flow
- ✅ Welcome email after registration
- ✅ Responsive UI with error handling

## 🗄️ Google Sheets Structure

Your sheet `GOOGLE_SHEET_ID_USER` must have 3 sheets:

### 1. Sheet: `users`
| ID | Email | Name | Password | Region | Role | IsVerified | IsActive | Login |
|----|-------|------|----------|--------|------|------------|----------|-------|
| 1233124123123 | admin@zmg.co.id | admin | $2a$10$... | Bali Nusra | admin | yes | yes | 2024-01-01T00:00:00Z |

### 2. Sheet: `verificationCodes`
| ID | Email | Code | Type | ExpiresAt | UsedAt | CreatedAt |
|----|-------|------|------|-----------|--------|-----------|
| abc123 | user@zmg.co.id | 123456 | registration | 2024-01-01T12:15:00Z | | 2024-01-01T12:00:00Z |

### 3. Sheet: `rateLimits`
| Email | IP | AttemptCount | LastAttempt | BlockedUntil |
|-------|----|--------------| ------------|--------------|
| user@zmg.co.id | 192.168.1.1 | 2 | 2024-01-01T12:00:00Z | |

## 📧 Gmail Setup

### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account](https://myaccount.google.com/)
2. Click **Security** → **2-Step Verification**
3. Follow the steps to enable

### Step 2: Generate App Password

1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select app: **Mail**
3. Select device: **Other (Custom name)** → "ZMG System"
4. Click **Generate**
5. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

### Step 3: Update .env.local

```env
GMAIL_USER=zmg.database.2023@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
```

⚠️ **Important:** Replace `JWT_SECRET` with a random string (min 32 chars)

Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🚀 Testing Flow

### 1. Register
```
Navigate to: http://localhost:3000/register
- Enter name: "John Doe"
- Enter email: "john@zmg.co.id"
- Click "Continue"
```

### 2. Verify Email
```
- Check email inbox for 6-digit code
- Enter code in verification page
- Click "Verify Code"
```

### 3. Set Password
```
- Enter password (min 8 chars, letters + numbers)
- Confirm password
- Optional: Enter region
- Click "Create Account"
```

### 4. Login
```
- Redirected to login page
- Enter email and password
- Click "Sign In"
```

## 🔒 Security Features

| Feature | Implementation |
|---------|---------------|
| Domain restriction | Only @zmg.co.id allowed |
| Rate limiting | Max 5 attempts/hour per email |
| Code expiration | 15 minutes |
| One-time codes | Cannot reuse verification codes |
| Password hashing | bcrypt with salt rounds=10 |
| JWT tokens | 15-minute expiry for password setup |
| Input validation | Email format, password strength |

## 📁 Files Created

### Backend (API)
- `/api/auth/register` - Send verification code
- `/api/auth/verify-code` - Verify code & generate token
- `/api/auth/set-password` - Create user account
- `/api/auth/resend-code` - Resend verification code

### Frontend (UI)
- `/register` - Registration form
- `/verify` - Code verification (6 boxes)
- `/set-password` - Password setup
- `/login` - Updated with register link

### Utilities
- `lib/email.ts` - Gmail integration
- `lib/googleSheets.ts` - Extended with user management

## 🧪 Testing Checklist

- [ ] Register with valid @zmg.co.id email
- [ ] Receive verification email
- [ ] Verify with correct code
- [ ] Set password and create account
- [ ] Login with new credentials
- [ ] Test rate limiting (6+ attempts)
- [ ] Test code expiration (wait 16 minutes)
- [ ] Test duplicate registration
- [ ] Test invalid email domain
- [ ] Test password validation
- [ ] Test resend code functionality

## ⚠️ Common Issues

### Issue: Email not received
**Solution:** 
- Check Gmail spam folder
- Verify `GMAIL_USER` and `GMAIL_APP_PASSWORD` in .env.local
- Ensure Gmail account has 2FA enabled
- Check Gmail "Less secure app access" is disabled

### Issue: "Invalid token" on set-password page
**Solution:** 
- Code expired (> 15 minutes)
- Request new code from register page

### Issue: "Column not found" error
**Solution:** 
- Verify Google Sheets has exact column names
- Check sheet names match env variables
- Ensure service account has edit permissions

### Issue: Rate limit blocking legitimate users
**Solution:**
- Wait 1 hour or manually delete row from rateLimits sheet
- Adjust limits in `googleSheets.ts` (lines 350-351)

## 🎨 Customization

### Change code expiry time
Edit `lib/googleSheets.ts` line 252:
```typescript
const expiresAt = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes
```

### Change rate limits
Edit `lib/googleSheets.ts` line 350:
```typescript
const maxAttempts = 3 // Max 3 attempts
const blockDuration = 30 * 60 * 1000 // Block for 30 minutes
```

### Change email template
Edit `lib/email.ts` starting line 16

## 🚀 Next Steps

1. **Update Gmail credentials** in `.env.local`
2. **Test registration flow** end-to-end
3. **Customize email templates** with company branding
4. **Set up monitoring** for failed registrations
5. **Add admin panel** to manage users (future)

## 📞 Support

For issues or questions:
- Check console logs in browser and server
- Verify Google Sheets permissions
- Ensure all env variables are set correctly
- Test with different email addresses

---

**Status:** ✅ Ready for testing!
**Last Updated:** 2024-01-19
