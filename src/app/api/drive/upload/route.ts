import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const duid = formData.get('duid') as string
    const folderId = formData.get('folderId') as string | null

    if (!file || !duid) {
      return NextResponse.json(
        { error: 'File and DUID are required' },
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

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')

    // Send to Apps Script
    const uploadData: any = {
      action: 'uploadFile',
      duid: duid,
      fileName: file.name,
      mimeType: file.type,
      fileData: base64,
    }
    
    if (folderId) {
      uploadData.folderId = folderId
    }
    
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(uploadData),
    })

    if (!response.ok) {
      throw new Error('Failed to upload file via Apps Script')
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}
