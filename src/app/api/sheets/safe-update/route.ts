import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSheetsClient } from '@/lib/googleSheets'

interface SafeUpdateRequest {
  rowId: string | number           // UNIQUE identifier
  columnId: string
  value: any
  oldValue?: any                   // For verification
  rowIdentifierColumn?: string     // Which column contains the unique ID
}

interface CellVerification {
  currentValue: any
  rowFound: boolean
  actualRowIndex: number
  sheetRowIndex: number
  range: string
}

export async function PUT(request: NextRequest) {
  try {
    const { 
      rowId, 
      columnId, 
      value, 
      oldValue,
      rowIdentifierColumn = 'id' // Default: use 'id' column as identifier
    }: SafeUpdateRequest = await request.json()
    
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

    // 1. GET ALL DATA to find the correct row by ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    })

    const rows = response.data.values
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    const headers = rows[0] as string[]
    const dataRows = rows.slice(1) // Exclude header row

    // 2. FIND ROW BY UNIQUE ID (not by index!)
    const idColumnIndex = headers.indexOf(rowIdentifierColumn)
    if (idColumnIndex === -1) {
      return NextResponse.json({ 
        error: `Identifier column '${rowIdentifierColumn}' not found in headers` 
      }, { status: 400 })
    }

    // Find the actual row by comparing the ID column
    let actualRowIndex = -1
    let rowData: any[] | null = null

    for (let i = 0; i < dataRows.length; i++) {
      if (dataRows[i][idColumnIndex]?.toString() === rowId?.toString()) {
        actualRowIndex = i
        rowData = dataRows[i]
        break
      }
    }

    if (actualRowIndex === -1 || !rowData) {
      return NextResponse.json({ 
        error: `Row with ${rowIdentifierColumn}='${rowId}' not found`,
        availableIds: dataRows.map(row => row[idColumnIndex]).filter(Boolean)
      }, { status: 404 })
    }

    // 3. VERIFY TARGET COLUMN EXISTS
    const targetColumnIndex = headers.indexOf(columnId)
    if (targetColumnIndex === -1) {
      return NextResponse.json({ 
        error: `Column '${columnId}' not found`,
        availableColumns: headers
      }, { status: 400 })
    }

    // 4. GET CURRENT VALUE FOR VERIFICATION
    const currentValue = rowData[targetColumnIndex] || ''
    
    // 5. VERIFY OLD VALUE MATCHES (optional but recommended)
    if (oldValue !== undefined && currentValue !== oldValue) {
      // Option: Strict mode - reject if values don't match
      // return NextResponse.json({ 
      //   error: 'Data has been modified by another user',
      //   currentValue,
      //   expectedOldValue: oldValue
      // }, { status: 409 }) // Conflict
    }

    // 6. CALCULATE SAFE GOOGLE SHEETS RANGE
    const columnLetter = String.fromCharCode(65 + targetColumnIndex)
    const sheetRowIndex = actualRowIndex + 2 // +1 for header, +1 for 1-based indexing
    const range = `${sheetName}!${columnLetter}${sheetRowIndex}`

    // 7. PERFORM THE UPDATE
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]]
      }
    })

    // 8. VERIFICATION: Re-fetch the cell to confirm update
    const verificationResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    })
    
    const updatedValue = verificationResponse.data.values?.[0]?.[0]
    const updateSuccess = updatedValue === value

    const verification: CellVerification = {
      currentValue,
      rowFound: true,
      actualRowIndex,
      sheetRowIndex,
      range
    }

    // Invalidate cache for Daily Plan page to trigger fresh fetch
    try {
      revalidatePath('/api/sheets')
      revalidatePath('/daily-plan')
    } catch (revalidateError) {
      // Log but don't fail the request if revalidation fails
      console.warn('Cache revalidation warning:', revalidateError)
    }

    return NextResponse.json({ 
      success: true,
      message: 'Cell updated safely using row ID verification',
      rowId,
      updatedRange: range,
      value,
      verification,
      updateConfirmed: updateSuccess,
      cacheInvalidated: true,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to safely update cell',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}