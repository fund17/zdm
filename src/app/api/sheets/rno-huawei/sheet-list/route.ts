import { NextRequest, NextResponse } from 'next/server'
import { getSheetData } from '@/lib/googleSheets'
import { RNO_CONFIG, getEnvValues } from '@/lib/huaweiRouteConfig'

export async function GET(request: NextRequest) {
  try {
    const { spreadsheetId, sheetSelectionName } = getEnvValues(RNO_CONFIG)
    
    console.log('RNO Sheet List - Spreadsheet ID:', spreadsheetId)
    console.log('RNO Sheet List - Sheet Selection Name:', sheetSelectionName)
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID is not configured' },
        { status: 500 }
      )
    }

    let sheetListData
    try {
      sheetListData = await getSheetData(spreadsheetId, sheetSelectionName)
      console.log('RNO Sheet List - Data fetched:', sheetListData?.length || 0, 'rows')
    } catch (fetchError) {
      console.log('RNO Sheet List - Failed to fetch, using fallback:', fetchError)
      sheetListData = null
    }

    if (!sheetListData || sheetListData.length === 0) {
      console.log('RNO Sheet List - Using fallback default sheets')
      return NextResponse.json({
        success: true,
        data: [
          { sheetName: 'RNOHWIOH', title: 'RNO Huawei IOH Project' },
          { sheetName: 'RNOHWXL', title: 'RNO Huawei XL Project' },
          { sheetName: 'RNOHWTSEL', title: 'RNO Huawei TSEL Project' },
        ]
      })
    }

    const formattedData = sheetListData.map((row: any) => {
      console.log('RNO Sheet List - Raw row data:', row)
      
      return {
        sheetName: row.sheet_list || row.Sheet || row.sheet || row.SHEET || row.SheetName || row.sheetName || row.sheetname || '',
        title: row.title || row.Title || row.TITLE || row.Description || row.description || ''
      }
    }).filter((item: any) => item.sheetName)

    console.log('RNO Sheet List - Formatted data:', formattedData)

    return NextResponse.json({
      success: true,
      message: 'Sheet list fetched successfully',
      data: formattedData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('RNO Sheet List - Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch sheet list',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
