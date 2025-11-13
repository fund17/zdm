# Login System Documentation

## Overview
Login system dengan autentikasi menggunakan Google Sheets sebagai database user.

## Features
✅ Login dengan email dan password
✅ Session management dengan cookies
✅ Protected routes dengan middleware
✅ User info di navbar
✅ Logout functionality
✅ Auto-update last_login timestamp
✅ Role-based access (usertype: admin, user, dll)
✅ Region-based filtering

## Google Sheets Structure

### Sheet: `new_user`
Kolom yang digunakan:

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| name | String | Nama lengkap user | Admin |
| email | String | Email login (unique) | admin@zmg.co.id |
| pass | String | Password | zmg123 |
| region | String | Regional user | Bali Nusra |
| usertype | String | Tipe user (admin/user) | admin |
| status | String | Status akun (active/inactive) | active |
| last_login | DateTime | Timestamp login terakhir | 13/11/2025 14:30:00 |

## API Endpoints

### 1. POST `/api/auth/login`
Login user dan create session.

**Request:**
```json
{
  "email": "admin@zmg.co.id",
  "password": "zmg123"
}
```

**Response Success:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "name": "Admin",
    "email": "admin@zmg.co.id",
    "region": "Bali Nusra",
    "usertype": "admin",
    "status": "active"
  }
}
```

**Response Error:**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

### 2. POST `/api/auth/logout`
Logout user dan clear session.

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### 3. GET `/api/auth/session`
Check current user session.

**Response:**
```json
{
  "success": true,
  "user": {
    "name": "Admin",
    "email": "admin@zmg.co.id",
    "region": "Bali Nusra",
    "usertype": "admin",
    "status": "active"
  }
}
```

## Protected Routes

Routes yang memerlukan autentikasi:
- `/` - Dashboard
- `/daily-plan` - Daily Plan
- `/itc-huawei` - ITC Huawei
- `/dashboard/itc-huawei` - Dashboard ITC Huawei

Public routes:
- `/login` - Login page
- `/api/auth/login` - Login API
- `/api/auth/logout` - Logout API
- `/api/auth/session` - Session check API

## Middleware

File: `middleware.ts`

Middleware akan:
1. Check user session cookie
2. Redirect ke `/login` jika belum login dan akses protected route
3. Redirect ke `/` jika sudah login dan akses `/login`

## Session Management

Session disimpan dalam HTTP-only cookie dengan:
- Name: `user_session`
- Duration: 7 hari
- HttpOnly: true (tidak bisa diakses JavaScript)
- Secure: true (production only)
- SameSite: lax

## Usage

### 1. Login
Navigate ke `/login` atau akan auto-redirect jika belum login.

### 2. Menggunakan User Data
```typescript
// Di component
const [user, setUser] = useState<UserData | null>(null)

useEffect(() => {
  const fetchUser = async () => {
    const res = await fetch('/api/auth/session')
    const data = await res.json()
    if (data.success) {
      setUser(data.user)
    }
  }
  fetchUser()
}, [])
```

### 3. Logout
```typescript
const handleLogout = async () => {
  await fetch('/api/auth/logout', { method: 'POST' })
  router.push('/login')
}
```

## Security Notes

⚠️ **Important for Production:**

1. **Password Hashing**: Saat ini password disimpan plain text. Untuk production, gunakan bcrypt:
   ```typescript
   import bcrypt from 'bcryptjs'
   const hashedPassword = await bcrypt.hash(password, 10)
   const isValid = await bcrypt.compare(password, hashedPassword)
   ```

2. **HTTPS**: Pastikan gunakan HTTPS di production untuk secure cookies

3. **Rate Limiting**: Tambahkan rate limiting untuk prevent brute force attacks

4. **Session Secret**: Gunakan JWT token dengan secret key yang strong

## Demo Credentials

**Admin Account:**
- Email: `admin@zmg.co.id`
- Password: `zmg123`
- Region: Bali Nusra
- Type: admin

## Troubleshooting

### Issue: "Not authenticated" error
- Clear cookies dan login ulang
- Check `GOOGLE_SHEET_ID_USER` di `.env.local`
- Verify Google Sheets permissions

### Issue: Login redirect loop
- Clear browser cache dan cookies
- Check middleware configuration
- Verify session cookie is being set

### Issue: "Invalid session" error
- Session expired (7 days)
- Cookie was manually deleted
- Browser privacy settings blocking cookies

## Future Enhancements

- [ ] Password reset functionality
- [ ] Remember me option
- [ ] Two-factor authentication
- [ ] Login history tracking
- [ ] Account lockout after failed attempts
- [ ] Email verification
- [ ] OAuth integration (Google, Microsoft)
