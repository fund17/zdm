# Google Apps Script Update Required

## Perubahan yang sudah dibuat:

### 1. Frontend (File Upload Page)
- ✅ Menambahkan tab system: PO Update, ISDP Update, Clock Report
- ✅ Menambahkan parameter `includeSubfolders=true` untuk ISDP tab
- ✅ Menampilkan folder path untuk setiap file di ISDP

### 2. Backend API (list-files route)
- ✅ Menerima parameter `includeSubfolders` 
- ✅ Meneruskan parameter ke Google Apps Script

### 3. Google Apps Script (DriveFileManager.js)
- ✅ Menambahkan fungsi `listFilesInFolderRecursive()` yang:
  - Mencari file di folder utama
  - Recursively mencari file di semua subfolder
  - Menambahkan property `folderPath` dan `parentFolder` ke setiap file
  - Menampilkan full path dari file (misal: "Main Folder / Subfolder1 / Subfolder2")

## Yang Perlu Dilakukan:

### Deploy Updated Google Apps Script

1. **Buka Google Apps Script Editor:**
   - Buka: https://script.google.com
   - Pilih project yang sesuai untuk Drive File Manager

2. **Update Code:**
   - Copy semua isi dari file: `google-apps-script/DriveFileManager.js`
   - Replace semua code di Apps Script editor dengan code yang baru

3. **Deploy sebagai Web App:**
   - Klik "Deploy" > "New deployment"
   - Pilih "Web app"
   - Execute as: **Me (your@email.com)**
   - Who has access: **Anyone**
   - Klik "Deploy"
   - Copy URL yang diberikan

4. **Update Environment Variable:**
   - Pastikan `GOOGLE_APPS_SCRIPT_DRIVE_URL` di `.env.local` sesuai dengan URL deployment

5. **Test:**
   - Refresh halaman File Upload Center
   - Pilih tab "ISDP Update"
   - Pilih folder "ISDP Update"
   - Seharusnya menampilkan semua file dari semua subfolder dengan path lengkap

## Fungsi Baru yang Ditambahkan:

```javascript
/**
 * List all files in a specific folder including subfolders (recursive)
 */
function listFilesInFolderRecursive(folderId, parentPath) {
  // Mencari file di current folder
  // Recursively mencari di semua subfolder
  // Return array of files dengan folderPath property
}
```

## Perubahan di doGet():

```javascript
if (action === 'listFilesInFolder') {
  const folderId = e.parameter.folderId;
  const includeSubfolders = e.parameter.includeSubfolders === 'true';
  
  const result = includeSubfolders 
    ? listFilesInFolderRecursive(folderId)
    : listFilesInFolder(folderId);
  
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, files: result })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

## Testing:

Setelah deploy, test dengan:
1. Buka File Upload Center
2. Klik tab "ISDP Update"
3. Pilih folder "ISDP Update"
4. Verifikasi bahwa semua file dari subfolder muncul dengan folder path-nya

## Folder IDs:

- PO XLS: `142ti_4bDTEOY7x5bYIFj3nAGcnLnTvTP`
- PO TSEL: `1acCyxmCDDARCknQohSsRwlWxZh8c7qHX`
- PO IOH: `1flu7jHcddGUWXCUQKyPB_xKSX83U8c4W`
- ISDP Update: `1tMyzbGFSWjaZ4JY7VRkz_IQqKBEo-pxb` (with recursive subfolder scan)
- Clock Report: `1qQorUzpvBvrk_BuBaMMmrG8_aaWYnq2M`
