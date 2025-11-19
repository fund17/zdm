import { NextRequest, NextResponse } from 'next/server'
import { getSheetsClient } from '@/lib/googleSheets'

interface CellUpdate {
  duid: string
  columnId: string
  value: any
  oldValue?: any
}

interface BatchUpdateRequest {
  cellUpdates: CellUpdate[]
  rowIdentifierColumn: string
  sheetName?: string
}

async function getGoogleSheetsClient() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID_HWROLLOUTITC
  if (!spreadsheetId) {
    throw new Error('Google Sheet ID not configured')
  }
  const sheets = await getSheetsClient()
  return { sheets, spreadsheetId }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { cellUpdates, rowIdentifierColumn, sheetName } = body

    if (!cellUpdates || !Array.isArray(cellUpdates) || !rowIdentifierColumn) {
      return NextResponse.json(
        { error: 'Missing required fields: cellUpdates (array), rowIdentifierColumn' },
        { status: 400 }
      )
    }

    const startTime = Date.now()

    // Get Google Sheets client
    const { sheets, spreadsheetId } = await getGoogleSheetsClient()

    // Determine which sheet to use (default or specified)
    const targetSheetName = sheetName || process.env.GOOGLE_SHEET_NAME || 'Sheet1'

    // Get the sheet data to find row and column indices
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheetName}!A1:ZZ`,
    })

    const rows = response.data.values || []
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Sheet is empty' }, { status: 404 })
    }

    const headers = rows[0]
    
    // Find the column index for the row identifier
    const rowIdColIndex = headers.findIndex((h) => {
      const headerNormalized = String(h || '').replace(/\s+/g, '').toLowerCase()
      const searchNormalized = rowIdentifierColumn.replace(/\s+/g, '').toLowerCase()
      return headerNormalized === searchNormalized
    })

    if (rowIdColIndex === -1) {
      return NextResponse.json(
        { error: `Column '${rowIdentifierColumn}' not found in sheet` },
        { status: 404 }
      )
    }

    // Build DUID -> rowIndex lookup map
    const duidToRowIndex = new Map<string, number>()
    rows.forEach((row, idx) => {
      if (idx === 0) return // Skip header
      const duid = String(row[rowIdColIndex] || '').trim()
      if (duid) {
        duidToRowIndex.set(duid, idx)
      }
    })


    // Prepare batch update requests for ALL cells at once
    const batchUpdateRequests: any[] = []
    let processedCells = 0
    let skippedCells = 0

    for (const cellUpdate of cellUpdates) {
      const { duid, columnId, value } = cellUpdate
      
      // Find row index
      const rowIndex = duidToRowIndex.get(String(duid).trim())
      if (rowIndex === undefined) {
        skippedCells++
        continue
      }

      // Find column index - try multiple normalization strategies
      let colIndex = headers.findIndex((h) => {
        const headerStr = String(h || '')
        const headerNormalized = headerStr.replace(/\s+/g, '').toLowerCase()
        const searchNormalized = columnId.replace(/\s+/g, '').toLowerCase()
        
        return (
          headerStr === columnId ||
          headerNormalized === searchNormalized ||
          headerStr.toLowerCase() === columnId.toLowerCase()
        )
      })

      if (colIndex === -1) {
        skippedCells++
        continue
      }

      // Convert column index to letter (A, B, C, etc.)
      const colLetter = String.fromCharCode(65 + colIndex)
      const cellAddress = `${targetSheetName}!${colLetter}${rowIndex + 1}`

      batchUpdateRequests.push({
        range: cellAddress,
        values: [[value]]
      })

      processedCells++
    }

    if (batchUpdateRequests.length === 0) {
      return NextResponse.json(
        { error: 'No valid cells to update', skippedCells },
        { status: 400 }
      )
    }

    // Execute SINGLE batch update with ALL cells
    
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batchUpdateRequests
      }
    })

    const updateTime = Date.now() - startTime

    if (skippedCells > 0) {
    }

    return NextResponse.json({
      success: true,
      updatedCells: processedCells,
      skippedCells,
      updateTime
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to update data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
