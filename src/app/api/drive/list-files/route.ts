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

    if (!appsScriptUrl) {
      return NextResponse.json(
        { error: 'Apps Script URL not configured' },
        { status: 500 }
      )
    }

    // Call Apps Script to list files
    let url = `${appsScriptUrl}?action=listFiles&duid=${encodeURIComponent(duid)}`
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
    console.error('Error listing files:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list files' },
      { status: 500 }
    )
  }
}
