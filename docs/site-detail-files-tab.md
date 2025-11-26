# Site Detail Modal - Files Tab

## Overview
Tab Files telah ditambahkan ke Site Detail Modal untuk mengelola file per DUID menggunakan Google Drive.

## Features

### 1. **View Files**
- Menampilkan semua file dalam folder DUID
- Grid view dengan thumbnail/icon
- Informasi: nama file, ukuran, tanggal upload, tipe file

### 2. **Upload Files**
- Upload file ke folder DUID di Google Drive
- Progress indicator saat upload
- Auto-refresh list setelah upload berhasil

### 3. **File Actions**
- **View**: Buka file di Google Drive (new tab)
- **Download**: Download file langsung
- **Delete**: Hapus file dengan konfirmasi

## Technical Architecture

```
Next.js App
    ↓
API Routes (/api/drive/*)
    ↓
Google Apps Script (Web App)
    ↓
Google Drive API
    ↓
Main Folder (1AqY9DG_O5HoN4HmD61CulPQl9QzcMHxm)
```

## File Structure

```
project/
├── src/
│   ├── components/
│   │   └── SiteDetailModal.tsx          # Modal dengan tab Files
│   └── app/
│       └── api/
│           └── drive/
│               ├── list-files/
│               │   └── route.ts         # GET files by DUID
│               └── upload/
│                   └── route.ts         # POST upload file
├── google-apps-script/
│   └── DriveFileManager.js              # Apps Script code
└── docs/
    └── google-apps-script-setup.md      # Setup guide
```

## API Endpoints

### List Files
```typescript
GET /api/drive/list-files?duid=DUID_001
Response: {
  success: true,
  files: [
    {
      id: "file_id",
      name: "document.pdf",
      mimeType: "application/pdf",
      size: 12345,
      createdDate: "2025-11-15T10:00:00Z",
      url: "https://drive.google.com/...",
      webViewLink: "https://drive.google.com/..."
    }
  ]
}
```

### Upload File
```typescript
POST /api/drive/upload
FormData:
  - duid: string
  - file: File

Response: {
  success: true,
  file: { ... }
}
```

## Setup Instructions

### 1. Deploy Google Apps Script
```bash
# Follow instructions in:
docs/google-apps-script-setup.md
```

### 2. Add Environment Variable
```bash
# .env.local
GOOGLE_APPS_SCRIPT_DRIVE_URL=https://script.google.com/macros/s/YOUR_ID/exec
```

### 3. Restart Dev Server
```bash
npm run dev
```

## Google Drive Folder Structure

```
Main Folder (1AqY9DG_O5HoN4HmD61CulPQl9QzcMHxm)
├── DUID_001/
│   ├── site_photo.jpg
│   ├── technical_report.pdf
│   └── installation_guide.docx
├── DUID_002/
│   ├── atp_document.xlsx
│   └── invoice.pdf
└── DUID_003/
    └── ...
```

**Auto-Creation**: Folder DUID dibuat otomatis saat upload pertama kali.

## Component Props

```typescript
interface SiteDetailModalProps {
  isOpen: boolean
  onClose: () => void
  duid: string        // Required for file operations
  duName?: string     // Optional display name
}
```

## Tab State Management

```typescript
const [activeTab, setActiveTab] = useState<'po' | 'files'>('po')
```

- **PO Tab**: Menampilkan Purchase Order data
- **Files Tab**: Menampilkan file management interface

## Error Handling

1. **No Apps Script URL**: Shows error message
2. **Upload Failed**: Display error with retry option
3. **List Files Failed**: Shows error state
4. **Delete Failed**: Alert with error message

## Limitations

### Google Apps Script
- Max execution time: 6 minutes
- Max file size: 50MB per upload
- Rate limits apply

### Drive API
- Quota limits per day
- File permissions inherit from folder

## Security Considerations

1. **Apps Script Access**: Set to "Anyone" or "Anyone with Google account"
2. **File Visibility**: Files inherit folder permissions
3. **Authentication**: Uses service account for Drive operations
4. **CORS**: Apps Script handles CORS automatically

## Future Enhancements

- [ ] Bulk upload multiple files
- [ ] File preview (images, PDFs)
- [ ] Folder organization
- [ ] File versioning
- [ ] Search/filter files
- [ ] File sharing links
- [ ] Upload progress for large files
- [ ] Drag & drop upload

## Troubleshooting

### Upload tidak berfungsi
1. Cek GOOGLE_APPS_SCRIPT_DRIVE_URL di `.env.local`
2. Pastikan Apps Script sudah di-deploy
3. Cek browser console untuk error details

### Files tidak muncul
1. Cek folder permissions di Google Drive
2. Verify MAIN_FOLDER_ID di Apps Script
3. Test dengan function `testSetup()` di Apps Script

### Delete gagal
1. Pastikan file ID valid
2. Cek permissions (need Editor access)
3. File mungkin sudah di-trash sebelumnya
