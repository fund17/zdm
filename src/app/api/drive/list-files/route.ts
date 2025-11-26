import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const duid = searchParams.get('duid')
    const folderId = searchParams.get('folderId')

    if (!duid) {
      return NextResponse.json(
        { error: 'DUID is required' },
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

    // Call Apps Script to list files with mainFolderId
    let url = `${appsScriptUrl}?action=listFiles&duid=${encodeURIComponent(duid)}&mainFolderId=${encodeURIComponent(mainFolderId)}`
    if (folderId) {
      url += `&folderId=${encodeURIComponent(folderId)}`
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch files from Apps Script')
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list files' },
      { status: 500 }
    )
  }
}
