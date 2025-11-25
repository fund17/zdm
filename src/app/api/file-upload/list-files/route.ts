import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const folderId = searchParams.get('folderId')

    if (!folderId) {
      return NextResponse.json(
        { success: false, error: 'Folder ID is required' },
        { status: 400 }
      )
    }

    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_DRIVE_URL
    const mainFolderId = process.env.GOOGLE_DRIVE_MAIN_FILE_FOLDERID

    if (!scriptUrl || !mainFolderId) {
      return NextResponse.json(
        { success: false, error: 'Google Apps Script configuration missing' },
        { status: 500 }
      )
    }

    // Call Google Apps Script to list files in the folder directly
    const url = `${scriptUrl}?action=listFilesInFolder&folderId=${folderId}&mainFolderId=${mainFolderId}`
    
    const response = await fetch(url, {
      method: 'GET',
    })

    if (!response.ok) {
      const errorText = await response.text()

      return NextResponse.json(
        { success: false, error: 'Failed to fetch files from Google Drive' },
        { status: 500 }
      )
    }

    const data = await response.json()

    if (data.success) {
      return NextResponse.json({
        success: true,
        files: data.files || [],
      })
    } else {
      return NextResponse.json(
        { success: false, error: data.error || 'Failed to list files' },
        { status: 500 }
      )
    }
  } catch (error) {

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
