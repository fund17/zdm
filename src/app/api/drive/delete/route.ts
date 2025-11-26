import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileId } = body

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }

    const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_DRIVE_URL
    const mainFolderId = process.env.GOOGLE_DRIVE_MAIN_FILE_FOLDERID

    if (!appsScriptUrl) {
      return NextResponse.json(
        { error: 'Apps Script URL not configured' },
        { status: 500 }
      )
    }

    if (!mainFolderId) {
      return NextResponse.json(
        { error: 'Main Folder ID not configured' },
        { status: 500 }
      )
    }

    // Call Apps Script to delete file
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'deleteFile',
        mainFolderId: mainFolderId,
        fileId: fileId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to delete file via Apps Script')
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete file' },
      { status: 500 }
    )
  }
}
