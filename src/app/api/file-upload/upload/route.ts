import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileName, mimeType, fileData, folderId } = body

    if (!fileName || !fileData || !folderId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_DRIVE_URL

    if (!scriptUrl) {
      return NextResponse.json(
        { success: false, error: 'Google Apps Script URL not configured' },
        { status: 500 }
      )
    }

    // Upload directly to the specified folder (no DUID subfolder)
    // folderId is the actual Google Drive folder ID, not env key
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'uploadFile',
        mainFolderId: folderId, // Use the folder ID directly
        duid: '', // Empty DUID means upload to root of mainFolderId
        fileName,
        mimeType: mimeType || 'application/octet-stream',
        fileData,
        folderId: null, // No subfolder, upload to mainFolderId root
      }),
    })

    const result = await response.json()

    if (result.success) {
      return NextResponse.json({
        success: true,
        file: result.file,
        message: 'File uploaded successfully',
      })
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Upload failed' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
