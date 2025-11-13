import { NextRequest, NextResponse } from 'next/server'
import { getSheetData } from '@/lib/googleSheets'

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

    console.log('📊 FETCHING ITC HUAWEI DATA:', {
      spreadsheetId,
      sheetName,
      envSheetName: process.env.GOOGLE_SHEET_NAME_HWROLLOUTITC,
      timestamp: new Date().toISOString()
    })

    const data = await getSheetData(spreadsheetId, sheetName)
    
    console.log('📋 ITC HUAWEI DATA:', {
      totalRows: data?.length || 0,
      firstRowKeys: data && data.length > 0 ? Object.keys(data[0]) : [],
      hasRowId: data && data.length > 0 ? 'RowId' in data[0] : false
    })

    return NextResponse.json({
      data: data || [],
      total: data?.length || 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ ERROR FETCHING ITC HUAWEI DATA:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch sheet data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
