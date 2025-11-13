# Deployment Instructions for Unisistem

## Setup Environment Variables

Anda perlu menyiapkan environment variables berikut:

### 1. Google Sheets Service Account
Buat service account di Google Cloud Console dan dapatkan:
- `GOOGLE_CLIENT_EMAIL`: Email service account
- `GOOGLE_PRIVATE_KEY`: Private key (dalam format JSON)
- `GOOGLE_SHEET_ID`: ID dari Google Sheet Anda

### 2. Vercel Environment Variables
Di Vercel Dashboard, tambahkan environment variables:
1. Buka project di Vercel
2. Masuk ke Settings > Environment Variables
3. Tambahkan semua variabel dari `.env.example`

## Deployment Steps

### Option 1: Manual Deployment
1. Connect repository ke Vercel
2. Import project ke Vercel
3. Set environment variables
4. Deploy

### Option 2: GitHub Actions (Automated)
1. Set GitHub Secrets:
   - `GOOGLE_CLIENT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_SHEET_ID`
   - `VERCEL_TOKEN`
   - `ORG_ID`
   - `PROJECT_ID`

2. Push ke main branch untuk auto deploy

## Post-Deployment Checklist
- [ ] Environment variables configured
- [ ] Google Sheet shared with service account
- [ ] API endpoint accessible
- [ ] Table displays data correctly
- [ ] Responsive design works on mobile

## Troubleshooting
1. Check Vercel function logs for errors
2. Verify Google Sheets API is enabled
3. Ensure service account has proper permissions
4. Test API endpoint directly: `/api/sheets`