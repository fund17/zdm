# Quick Setup - Google Apps Script for File Management

## 🚀 Quick Start (5 menit)

### 1️⃣ Buka Google Apps Script
```
https://script.google.com/
```

### 2️⃣ Create New Project
- Klik **"New Project"**
- Rename: **"Drive File Manager"**

### 3️⃣ Copy Code
- Buka file: `/google-apps-script/DriveFileManager.js`
- Copy semua kode
- Paste ke Apps Script editor (ganti semua kode default)
- Klik **Save** 💾

### 4️⃣ Test Setup (Optional but Recommended)
```javascript
// Di Apps Script editor:
// 1. Pilih function "testSetup" dari dropdown
// 2. Klik Run ▶️
// 3. Authorize permissions saat diminta
// 4. Check logs: View → Logs
// Harus muncul: "✅ Setup test completed successfully!"
```

### 5️⃣ Deploy Web App
1. Klik **Deploy** → **New deployment**
2. Klik ⚙️ icon → pilih **Web app**
3. Settings:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Klik **Deploy**
5. **COPY URL** yang muncul!

### 6️⃣ Add to Environment Variable
```bash
# .env.local
GOOGLE_APPS_SCRIPT_DRIVE_URL=https://script.google.com/macros/s/AKf...../exec
```

### 7️⃣ Restart Server
```bash
npm run dev
```

## ✅ Test di Browser

1. Buka ITC Huawei dashboard
2. Klik salah satu DUID
3. Klik tab **"Files"**
4. Upload test file
5. Cek di Google Drive folder: `1AqY9DG_O5HoN4HmD61CulPQl9QzcMHxm`

## 📁 Folder Structure

```
Main Folder (1AqY9DG_O5HoN4HmD61CulPQl9QzcMHxm)
└── DUID_XXX/          ← Auto-created per DUID
    └── uploaded_files
```

## 🔧 Troubleshooting

### "Failed to fetch files"
- ✅ Pastikan Apps Script sudah di-deploy
- ✅ Check URL di `.env.local` (harus ada `/exec` di akhir)
- ✅ Restart Next.js server setelah update .env

### "Authorization required"
- ✅ Run `testSetup()` function di Apps Script
- ✅ Authorize dengan Google account yang punya akses ke folder

### "Upload failed"
- ✅ File size max 50MB
- ✅ Check browser console untuk detail error
- ✅ Pastikan folder permissions allow write access

## 📚 Full Documentation

Lihat dokumentasi lengkap di:
- `/docs/google-apps-script-setup.md` - Setup detail
- `/docs/site-detail-files-tab.md` - Feature documentation

## 🔒 Security Notes

- Script runs dengan **permissions akun Anda**
- Files inherit **folder permissions**
- Anyone with URL dapat akses (change jika perlu lebih secure)

---

**Need Help?** Check logs di Apps Script: View → Executions
