import { NextRequest, NextResponse } from 'next/server'
import { getSheetData } from '@/lib/googleSheets'

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_DAILYPLAN
    const sheetName = process.env.GOOGLE_SHEET_ID_DAILYPLAN_SHEETNAME || 'DailyPlan'
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID is not configured' },
        { status: 500 }
      )
    }

    console.log('🔍 DEBUG: Fetching data structure...')
    const data = await getSheetData(spreadsheetId, sheetName)
    
    const debug = {
      spreadsheetId,
      sheetName,
      totalRows: data?.length || 0,
      columns: data && data.length > 0 ? Object.keys(data[0]).sort() : [],
      hasRowId: data && data.length > 0 ? 'RowId' in data[0] : false,
      sampleRow: data && data.length > 0 ? data[0] : null,
      firstFiveRows: data ? data.slice(0, 5) : []
    }

    console.log('🔍 DEBUG RESULT:', debug)
    
    return NextResponse.json({
      success: true,
      debug
    })
  } catch (error) {
    console.error('Debug API Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch debug data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}