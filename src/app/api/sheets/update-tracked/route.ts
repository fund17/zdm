import { NextRequest, NextResponse } from 'next/server'
import { getSheetsClient } from '@/lib/googleSheets'

interface CellUpdate {
  rowIndex: number
  columnId: string
  value: any
  timestamp: string
  oldValue?: any
  range?: string
}

interface UpdateResponse {
  success: boolean
  message: string
  updatedRange: string
  value: any
  timestamp: string
  cellInfo: {
    row: number
    column: string
    columnIndex: number
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { rowIndex, columnId, value, oldValue } = await request.json()
    const timestamp = new Date().toISOString()
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_DAILYPLAN
    const sheetName = process.env.GOOGLE_SHEET_ID_DAILYPLAN_SHEETNAME || 'DailyPlan'
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID is not configured' },
        { status: 500 }
      )
    }

    const sheets = await getSheetsClient()

    // First, get the current data to find column index
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    })

    const rows = response.data.values
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    const headers = rows[0] as string[]
    const columnIndex = headers.indexOf(columnId)
    
    if (columnIndex === -1) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 })
    }

    // Convert column index to letter (A, B, C, etc.)
    const columnLetter = String.fromCharCode(65 + columnIndex)
    
    // Row index + 2 (1 for 1-based indexing, 1 for header row)
    const sheetRowIndex = rowIndex + 2
    
    // Create the range
    const range = `${sheetName}!${columnLetter}${sheetRowIndex}`

    // Get current value before update (for verification)
    const currentCellResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    })
    
    const currentValue = currentCellResponse.data.values?.[0]?.[0] || ''
    
    // Update the specific cell
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]]
      }
    })

    // Log successful update
    const updateLog: CellUpdate = {
      rowIndex,
      columnId,
      value,
      timestamp,
      oldValue: currentValue,
      range
    }
    

    const responseData: UpdateResponse = {
      success: true,
      message: 'Cell updated successfully',
      updatedRange: range,
      value,
      timestamp,
      cellInfo: {
        row: sheetRowIndex,
        column: columnLetter,
        columnIndex
      }
    }

    return NextResponse.json(responseData)
    
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to update cell in Google Sheets',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}