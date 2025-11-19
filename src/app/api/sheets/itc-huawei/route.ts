import { NextRequest, NextResponse } from 'next/server'
import { getSheetData, getSheetMetadata } from '@/lib/googleSheets'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_HWROLLOUTITC
    
    // Get sheetName from query params or use default from env
    const { searchParams } = new URL(request.url)
    const sheetName = searchParams.get('sheetName') || process.env.GOOGLE_SHEET_NAME_HWROLLOUTITC || 'ITCHIOH'
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID is not configured' },
        { status: 500 }
      )
    }

    // debug logs removed

    const [data, metadata] = await Promise.all([
      getSheetData(spreadsheetId, sheetName),
      getSheetMetadata(spreadsheetId)
    ])
    
    // debug logs removed

    // Format lastUpdated to Indonesian locale
    let lastUpdated: string | undefined
    if (metadata.modifiedTime) {
      const modifiedDate = new Date(metadata.modifiedTime)
      lastUpdated = modifiedDate.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    return NextResponse.json({
      data: data || [],
      total: data?.length || 0,
      lastUpdated,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch sheet data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
