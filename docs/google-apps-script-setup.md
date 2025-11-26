# Google Apps Script Deployment Guide

## Setup Google Drive File Management

### Step 1: Create Google Apps Script Project

1. Go to [Google Apps Script](https://script.google.com/)
2. Click **"New Project"**
3. Name your project: **"Drive File Manager"**

### Step 2: Add the Code

1. Delete any default code in `Code.gs`
2. Copy the entire content from `/google-apps-script/DriveFileManager.js`
3. Paste it into `Code.gs`
4. Click **Save** (💾 icon)

### Step 3: Verify Main Folder Access

1. In the script editor, select function **`testSetup`** from the dropdown
2. Click **Run** (▶️ icon)
3. First time: Authorize the script
   - Click **Review Permissions**
   - Choose your Google account
   - Click **Advanced** → **Go to Drive File Manager (unsafe)**
   - Click **Allow**
4. Check execution log (View → Logs) for success message

### Step 4: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click **⚙️ Settings icon** next to "Select type"
3. Choose **Web app**
4. Configure:
   - **Description:** "Drive File Manager API v1"
   - **Execute as:** **Me** (your account)
   - **Who has access:** **Anyone** (or "Anyone with Google account" for more security)
5. Click **Deploy**
6. **Copy the Web App URL** - you'll need this!

### Step 5: Add URL to Environment Variables

1. Open your project's `.env.local` file
2. Add this line (replace with your actual URL):
   ```
   GOOGLE_APPS_SCRIPT_DRIVE_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```
3. Save the file
4. Restart your Next.js dev server

### Step 6: Test the Integration

1. Open your app
2. Navigate to ITC Huawei dashboard
3. Click any DUID in the table
4. Click the **"Files"** tab
5. Try uploading a file

## Folder Structure

```
Main Folder (1AqY9DG_O5HoN4HmD61CulPQl9QzcMHxm)
├── DUID_001/
│   ├── document1.pdf
│   ├── photo1.jpg
│   └── report.xlsx
├── DUID_002/
│   └── file.docx
└── DUID_003/
    └── ...
```

## API Endpoints

### List Files
```
GET https://your-script-url/exec?action=listFiles&duid=DUID_001
```

### Upload File
```
POST https://your-script-url/exec
Content-Type: application/json

{
  "action": "uploadFile",
  "duid": "DUID_001",
  "fileName": "document.pdf",
  "mimeType": "application/pdf",
  "fileData": "base64_encoded_data"
}
```

### Delete File
```
POST https://your-script-url/exec
Content-Type: application/json

{
  "action": "deleteFile",
  "fileId": "google_drive_file_id"
}
```

## Troubleshooting

### Script Authorization Issues
- Make sure you've authorized the script with your Google account
- The account must have write access to the main folder

### Folder Not Found
- Verify the MAIN_FOLDER_ID in the script matches your folder ID
- Check folder permissions (script must have access)

### Upload Fails
- Check file size (Apps Script has a 50MB limit)
- Verify CORS settings if running locally

### DUID Folder Auto-Creation
- The script automatically creates a folder for each DUID
- Folders are named exactly as the DUID value

## Security Notes

1. **Execute as Me**: Script runs with your Google account permissions
2. **Access Level**: Set to "Anyone" for demo, but consider restricting in production
3. **File Access**: All files inherit the parent folder's permissions
4. **Rate Limits**: Google Apps Script has execution time limits (6 minutes per execution)

## Updating the Script

After making changes to `DriveFileManager.js`:

1. Copy the updated code
2. Paste into Apps Script editor
3. Save
4. **Deploy** → **Manage deployments**
5. Click **✏️ Edit** on your existing deployment
6. Change version to **New version**
7. Click **Deploy**

The URL remains the same, but the script is updated!
