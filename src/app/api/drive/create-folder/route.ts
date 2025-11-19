import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { duid, folderName, parentFolderId } = body

    if (!duid || !folderName) {
      return NextResponse.json(
        { error: 'DUID and folderName are required' },
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

    // Call Apps Script to create folder
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'createFolder',
        duid: duid,
        folderName: folderName,
        parentFolderId: parentFolderId,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create folder via Apps Script')
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create folder' },
      { status: 500 }
    )
  }
}
