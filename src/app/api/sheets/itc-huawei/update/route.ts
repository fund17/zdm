import { NextRequest, NextResponse } from 'next/server'
import { getSheetsClient } from '@/lib/googleSheets'

interface SafeUpdateRequest {
  rowId: string | number
  columnId: string
  value: any
  oldValue?: any
  rowIdentifierColumn?: string
}

export async function PUT(request: NextRequest) {
  try {
    const { 
      rowId, 
      columnId, 
      value, 
      oldValue,
      rowIdentifierColumn = 'RowId'
    }: SafeUpdateRequest = await request.json()
    
    const timestamp = new Date().toISOString()
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_HWROLLOUTITC
    const sheetName = process.env.GOOGLE_SHEET_NAME_HWROLLOUTITC || 'ITCHIOH'
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID is not configured' },
        { status: 500 }
      )
    }

    console.log('🔒 ITC HUAWEI UPDATE REQUEST:', {
      rowId,
      columnId,
      value,
      oldValue,
      rowIdentifierColumn,
      timestamp
    })

    const sheets = await getSheetsClient()

    // Get all data to find correct row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    })

    const rows = response.data.values
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    const headers = rows[0] as string[]
    const dataRows = rows.slice(1)

    // Find row by unique ID
    const idColumnIndex = headers.indexOf(rowIdentifierColumn)
    if (idColumnIndex === -1) {
      return NextResponse.json({ 
        error: `Identifier column '${rowIdentifierColumn}' not found in headers` 
      }, { status: 400 })
    }

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
        error: `Row with ${rowIdentifierColumn}='${rowId}' not found`
      }, { status: 404 })
    }

    // Verify target column exists
    const targetColumnIndex = headers.indexOf(columnId)
    if (targetColumnIndex === -1) {
      return NextResponse.json({ 
        error: `Column '${columnId}' not found`,
        availableColumns: headers
      }, { status: 400 })
    }

    // Get current value for verification
    const currentValue = rowData[targetColumnIndex]

    console.log('🔍 VERIFICATION:', {
      rowId,
      actualRowIndex,
      sheetRowNumber: actualRowIndex + 2, // +1 for header, +1 for 1-based indexing
      currentValue,
      expectedOldValue: oldValue,
      newValue: value
    })

    // Optional: verify old value matches
    if (oldValue !== undefined && currentValue !== oldValue) {
      console.warn('⚠️ OLD VALUE MISMATCH:', {
        expected: oldValue,
        actual: currentValue,
        proceedingAnyway: true
      })
    }

    // Calculate cell range (A1 notation)
    const sheetRowNumber = actualRowIndex + 2 // +1 for header, +1 for 1-based
    const columnLetter = String.fromCharCode(65 + targetColumnIndex) // A=65
    const cellRange = `${sheetName}!${columnLetter}${sheetRowNumber}`

    console.log('📝 UPDATING CELL:', {
      cellRange,
      oldValue: currentValue,
      newValue: value
    })

    // Update the cell
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]]
      }
    })

    console.log('✅ UPDATE SUCCESS:', {
      cellRange,
      rowId,
      columnId,
      value,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Cell updated successfully',
      data: {
        rowId,
        columnId,
        cellRange,
        oldValue: currentValue,
        newValue: value,
        sheetRowNumber,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ ITC HUAWEI UPDATE ERROR:', error)
    return NextResponse.json(
      {
        error: 'Failed to update cell',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
