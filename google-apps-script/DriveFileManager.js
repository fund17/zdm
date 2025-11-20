/**
 * Google Apps Script for managing files in Google Drive
 * Deploy this as a Web App with "Execute as: Me" and "Who has access: Anyone"
 * 
 * Now accepts mainFolderId as a parameter instead of hardcoded
 * 
 * Structure: Main Folder > DUID Folders > Files
 */

/**
 * Handle GET requests
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const duid = e.parameter.duid;
    const mainFolderId = e.parameter.mainFolderId;

    if (!action) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: 'Action parameter is required' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (!mainFolderId) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: 'mainFolderId parameter is required' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'listFiles') {
      if (!duid) {
        return ContentService.createTextOutput(
          JSON.stringify({ error: 'DUID parameter is required' })
        ).setMimeType(ContentService.MimeType.JSON);
      }

      const folderId = e.parameter.folderId;
      const result = listFiles(mainFolderId, duid, folderId);
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, files: result.files, folders: result.folders })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'listFilesInFolder') {
      const folderId = e.parameter.folderId;
      if (!folderId) {
        return ContentService.createTextOutput(
          JSON.stringify({ error: 'folderId parameter is required' })
        ).setMimeType(ContentService.MimeType.JSON);
      }

      const result = listFilesInFolder(folderId);
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, files: result })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ error: 'Invalid action' })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (!action) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: 'Action is required' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'uploadFile') {
      const mainFolderId = data.mainFolderId;
      const duid = data.duid;
      const fileName = data.fileName;
      const mimeType = data.mimeType;
      const fileData = data.fileData;
      const folderId = data.folderId;

      if (!mainFolderId) {
        return ContentService.createTextOutput(
          JSON.stringify({ error: 'mainFolderId is required for uploadFile' })
        ).setMimeType(ContentService.MimeType.JSON);
      }

      if (!fileName || !fileData) {
        return ContentService.createTextOutput(
          JSON.stringify({ error: 'fileName and fileData are required' })
        ).setMimeType(ContentService.MimeType.JSON);
      }

      const result = uploadFile(mainFolderId, duid || '', fileName, mimeType, fileData, folderId);
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, file: result })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // For other actions, mainFolderId is required
    const mainFolderId = data.mainFolderId;
    if (!mainFolderId) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: 'mainFolderId is required' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'deleteFile') {
      const fileId = data.fileId;
      if (!fileId) {
        return ContentService.createTextOutput(
          JSON.stringify({ error: 'fileId is required' })
        ).setMimeType(ContentService.MimeType.JSON);
      }

      deleteFile(fileId);
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, message: 'File deleted successfully' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'createFolder') {
      const duid = data.duid;
      const folderName = data.folderName;
      const parentFolderId = data.parentFolderId;

      if (!duid || !folderName) {
        return ContentService.createTextOutput(
          JSON.stringify({ error: 'DUID and folderName are required' })
        ).setMimeType(ContentService.MimeType.JSON);
      }

      const result = createFolder(mainFolderId, duid, folderName, parentFolderId);
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, folder: result })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ error: 'Invalid action' })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get or create folder for DUID
 */
function getOrCreateDUIDFolder(mainFolderId, duid) {
  const mainFolder = DriveApp.getFolderById(mainFolderId);
  
  // Search for existing DUID folder
  const folders = mainFolder.getFoldersByName(duid);
  
  if (folders.hasNext()) {
    return folders.next();
  }
  
  // Create new folder if not exists
  Logger.log('Creating new folder for DUID: ' + duid);
  return mainFolder.createFolder(duid);
}

/**
 * List all files and folders in DUID folder or subfolder
 */
function listFiles(mainFolderId, duid, folderId) {
  try {
    let targetFolder;
    
    if (folderId) {
      // List contents of specific folder
      targetFolder = DriveApp.getFolderById(folderId);
    } else {
      // List contents of DUID root folder
      targetFolder = getOrCreateDUIDFolder(mainFolderId, duid);
    }
    
    // Get folders
    const folders = targetFolder.getFolders();
    const folderList = [];
    
    while (folders.hasNext()) {
      const folder = folders.next();
      
      // Count files in folder
      const filesIterator = folder.getFiles();
      let fileCount = 0;
      while (filesIterator.hasNext()) {
        filesIterator.next();
        fileCount++;
      }
      
      folderList.push({
        id: folder.getId(),
        name: folder.getName(),
        createdDate: folder.getDateCreated().toISOString(),
        filesCount: fileCount,
      });
    }
    
    // Get files
    const files = targetFolder.getFiles();
    const fileList = [];

    while (files.hasNext()) {
      const file = files.next();
      
      // Get thumbnail URL (only for images)
      let thumbnailUrl = null;
      const mimeType = file.getMimeType();
      if (mimeType.startsWith('image/')) {
        // Use Drive API thumbnail format
        thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w200';
      }
      
      fileList.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: mimeType,
        size: file.getSize(),
        createdDate: file.getDateCreated().toISOString(),
        modifiedDate: file.getLastUpdated().toISOString(),
        url: file.getUrl(),
        downloadUrl: file.getDownloadUrl(),
        thumbnailUrl: thumbnailUrl,
        webViewLink: file.getUrl(),
      });
    }

    Logger.log('Found ' + folderList.length + ' folders and ' + fileList.length + ' files');
    return {
      folders: folderList,
      files: fileList
    };
  } catch (error) {
    Logger.log('Error listing files: ' + error.toString());
    throw error;
  }
}

/**
 * List all files in a specific folder (direct folder access, no DUID)
 */
function listFilesInFolder(folderId) {
  try {
    const targetFolder = DriveApp.getFolderById(folderId);
    const files = targetFolder.getFiles();
    const fileList = [];

    while (files.hasNext()) {
      const file = files.next();
      
      // Get thumbnail URL (only for images)
      let thumbnailUrl = null;
      const mimeType = file.getMimeType();
      if (mimeType.startsWith('image/')) {
        thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w200';
      }
      
      fileList.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: mimeType,
        size: file.getSize(),
        createdTime: file.getDateCreated().toISOString(),
        modifiedTime: file.getLastUpdated().toISOString(),
        url: file.getUrl(),
        downloadUrl: file.getDownloadUrl(),
        thumbnailUrl: thumbnailUrl,
        webViewLink: file.getUrl(),
        webContentLink: file.getDownloadUrl(),
      });
    }

    Logger.log('Found ' + fileList.length + ' files in folder ' + folderId);
    return fileList;
  } catch (error) {
    Logger.log('Error listing files in folder: ' + error.toString());
    throw error;
  }
}

/**
 * Upload file to DUID folder or subfolder
 * If DUID is empty, upload directly to mainFolderId (for general uploads)
 */
function uploadFile(mainFolderId, duid, fileName, mimeType, base64Data, folderId) {
  try {
    let targetFolder;
    
    if (folderId) {
      // Upload to specific subfolder
      targetFolder = DriveApp.getFolderById(folderId);
    } else if (duid && duid !== '') {
      // Upload to DUID root folder
      targetFolder = getOrCreateDUIDFolder(mainFolderId, duid);
    } else {
      // Upload directly to mainFolderId (no DUID subfolder)
      targetFolder = DriveApp.getFolderById(mainFolderId);
    }
    
    // Decode base64
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      mimeType || 'application/octet-stream',
      fileName
    );

    // Create file
    const file = targetFolder.createFile(blob);
    
    Logger.log('File uploaded successfully: ' + fileName + ' to folder: ' + (duid || mainFolderId));
    
    // Get thumbnail URL (only for images)
    let thumbnailUrl = null;
    const fileMimeType = file.getMimeType();
    if (fileMimeType.startsWith('image/')) {
      thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w200';
    }
    
    return {
      id: file.getId(),
      name: file.getName(),
      mimeType: fileMimeType,
      size: file.getSize(),
      createdDate: file.getDateCreated().toISOString(),
      url: file.getUrl(),
      downloadUrl: file.getDownloadUrl(),
      thumbnailUrl: thumbnailUrl,
      webViewLink: file.getUrl(),
    };
  } catch (error) {
    Logger.log('Error uploading file: ' + error.toString());
    throw error;
  }
}

/**
 * Delete file by ID
 */
function deleteFile(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    Logger.log('File deleted: ' + fileId);
  } catch (error) {
    Logger.log('Error deleting file: ' + error.toString());
    throw error;
  }
}

/**
 * Create folder in DUID folder or subfolder
 */
function createFolder(mainFolderId, duid, folderName, parentFolderId) {
  try {
    let parentFolder;
    
    if (parentFolderId) {
      // Create in specific subfolder
      parentFolder = DriveApp.getFolderById(parentFolderId);
    } else {
      // Create in DUID root folder
      parentFolder = getOrCreateDUIDFolder(mainFolderId, duid);
    }
    
    const newFolder = parentFolder.createFolder(folderName);
    
    Logger.log('Folder created: ' + folderName + ' in ' + parentFolder.getName());
    
    return {
      id: newFolder.getId(),
      name: newFolder.getName(),
      createdDate: newFolder.getDateCreated().toISOString(),
      filesCount: 0,
    };
  } catch (error) {
    Logger.log('Error creating folder: ' + error.toString());
    throw error;
  }
}

/**
 * Test function to verify setup
 * Pass your mainFolderId to test
 */
function testSetup(mainFolderId) {
  try {
    if (!mainFolderId) {
      mainFolderId = '1AqY9DG_O5HoN4HmD61CulPQl9QzcMHxm'; // Default for testing
    }
    
    const mainFolder = DriveApp.getFolderById(mainFolderId);
    Logger.log('✅ Main folder accessible: ' + mainFolder.getName());
    
    // Test creating a folder
    const testDUID = 'TEST_DUID_' + new Date().getTime();
    const testFolder = getOrCreateDUIDFolder(mainFolderId, testDUID);
    Logger.log('✅ Test folder created: ' + testFolder.getName());
    
    // Clean up test folder
    testFolder.setTrashed(true);
    Logger.log('✅ Test folder cleaned up');
    
    return 'Setup test completed successfully!';
  } catch (error) {
    Logger.log('❌ Setup test failed: ' + error.toString());
    return 'Setup test failed: ' + error.toString();
  }
}
