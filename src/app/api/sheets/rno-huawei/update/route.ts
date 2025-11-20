import { NextRequest, NextResponse } from 'next/server'
import { getSheetsClient } from '@/lib/googleSheets'

interface SafeUpdateRequest {
  rowId: string | number
  columnId: string
  value: any
  oldValue?: any
  rowIdentifierColumn?: string
  sheetName?: string
  bulkImport?: boolean
  updates?: any[] // Array of Excel rows for bulk import
}

// Get date columns from settings sheet
async function getDateColumnsFromSettings(spreadsheetId: string): Promise<string[]> {
  const settingsSheetName = process.env.GOOGLE_SHEET_NAME_HWROLLOUTITC_SETTING || 'settings'
  const sheets = await getSheetsClient()
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${settingsSheetName}!A:C`,
    })

    const rows = response.data.values
    if (!rows || rows.length === 0) {
      return []
    }

    // Assuming settings format: Column | Type | ...
    // Header row: columns, value, type (or similar)
    const dateColumns: string[] = []
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const columnName = row[0]
      const columnType = row[2] // Type is in 3rd column (index 2)
      
      if (columnType && columnType.toLowerCase() === 'date' && columnName) {
        dateColumns.push(columnName)
      }
    }
    
    return dateColumns
  } catch (error) {
    console.error('Error reading settings sheet:', error)
    return []
  }
}

// Handle bulk import with per-cell rules
async function handleBulkImport(requestBody: SafeUpdateRequest) {
  const { sheetName, updates } = requestBody
  
  if (!updates || updates.length === 0) {
    return NextResponse.json({ error: 'No data to import' }, { status: 400 })
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID_HWROLLOUTRNO
  const targetSheetName = sheetName || process.env.GOOGLE_SHEET_NAME_HWROLLOUTRNO || 'ITCHIOH'
  
  if (!spreadsheetId) {
    return NextResponse.json({ error: 'Google Sheet ID is not configured' }, { status: 500 })
  }

  const sheets = await getSheetsClient()

  // Get date columns from settings sheet
  const dateColumns = await getDateColumnsFromSettings(spreadsheetId)
  console.log('[IMPORT] Date columns from settings:', dateColumns)

  // Get all data from Google Sheets
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${targetSheetName}!A:Z`,
  })

  const rows = response.data.values
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'No data found in sheet' }, { status: 404 })
  }

  const headers = rows[0] as string[]
  const dataRows = rows.slice(1)


  // Find DUID column index
  const duidColumnIndex = headers.findIndex(h => 
    h === 'DUID' || 
    h.toLowerCase() === 'duid' ||
    h.replace(/\s+/g, '').toLowerCase() === 'duid'
  )

  if (duidColumnIndex === -1) {
    return NextResponse.json({ error: 'DUID column not found in sheet' }, { status: 400 })
  }


  // Prepare batch updates array
  const batchUpdates: Array<{
    range: string
    values: any[][]
  }> = []

  let cellsUpdated = 0
  let cellsSkipped = 0
  const importedCellsList: Array<{ duid: string; column: string }> = []

  // Process each Excel row
  for (const excelRow of updates) {
    const duid = excelRow['DUID'] || excelRow['duid']
    
    if (!duid) {
      cellsSkipped += Object.keys(excelRow).length
      continue
    }

    // Find existing row in Google Sheets by DUID
    let actualRowIndex = -1
    let existingRow: any[] | null = null

    for (let i = 0; i < dataRows.length; i++) {
      const sheetDuid = dataRows[i][duidColumnIndex]?.toString()
      if (sheetDuid && sheetDuid === duid.toString()) {
        actualRowIndex = i
        existingRow = dataRows[i]
        break
      }
    }

    if (actualRowIndex === -1) {
      cellsSkipped += Object.keys(excelRow).length
      continue
    }

    // Process each cell in the Excel row
    for (const [excelKey, excelValue] of Object.entries(excelRow)) {
      // Rule 1: DUID column cannot be updated
      if (excelKey.toLowerCase() === 'duid') {
        cellsSkipped++
        continue
      }

      // Find column index (flexible matching)
      let targetColumnIndex = headers.findIndex(h => 
        h === excelKey ||
        h.replace(/\s+/g, '') === excelKey ||
        h.replace(/\s+/g, '') === excelKey.replace(/\s+/g, '') ||
        h.toLowerCase() === excelKey.toLowerCase()
      )

      if (targetColumnIndex === -1) {
        cellsSkipped++
        continue
      }

      // Check if this is a date column - check against sheet header name, not Excel key
      const actualColumnName = headers[targetColumnIndex]
      const isDateColumn = dateColumns.some(dateCol => 
        actualColumnName === dateCol ||
        actualColumnName.toLowerCase() === dateCol.toLowerCase() ||
        actualColumnName.replace(/\s+/g, '').toLowerCase() === dateCol.replace(/\s+/g, '').toLowerCase()
      )

      // Rule 2: Date column with existing value is protected - MUST CHECK BEFORE ANY UPDATE
      if (isDateColumn && existingRow) {
        const existingValue = existingRow[targetColumnIndex]
        // Check if existing value is not empty (trim whitespace too)
        const hasExistingValue = existingValue !== null && 
                                 existingValue !== undefined && 
                                 existingValue !== '' && 
                                 (typeof existingValue === 'string' ? existingValue.trim() !== '' : true)
        
        if (hasExistingValue) {
          console.log(`[PROTECTED] Date column "${actualColumnName}" has existing value "${existingValue}" - skipping update`)
          cellsSkipped++
          continue // Skip this cell - DO NOT UPDATE
        }
      }

      // Rule 3: Check if value is different
      if (existingRow) {
        const existingValue = existingRow[targetColumnIndex]
        if (excelValue === existingValue || excelValue === null || excelValue === undefined || excelValue === '') {
          cellsSkipped++
          continue
        }
      }

      // Add to batch updates
      const sheetRowNumber = actualRowIndex + 2 // +1 for header, +1 for 1-based
      const columnLetter = String.fromCharCode(65 + targetColumnIndex)
      const cellRange = `${targetSheetName}!${columnLetter}${sheetRowNumber}`

      batchUpdates.push({
        range: cellRange,
        values: [[excelValue]]
      })
      
      // Track for highlighting - use ACTUAL column name from sheet header (already defined above)
      importedCellsList.push({
        duid: duid.toString(),
        column: actualColumnName // Use sheet header name, not Excel key
      })
      
      cellsUpdated++
    }
  }


  // Execute batch update if there are updates
  if (batchUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batchUpdates
      }
    })

  }

  return NextResponse.json({
    success: true,
    message: 'Bulk import completed',
    updatedCount: cellsUpdated,
    skippedCount: cellsSkipped,
    totalRows: updates.length,
    importedCells: importedCellsList
  })
}

export async function PUT(request: NextRequest) {
  try {
    const requestBody: SafeUpdateRequest = await request.json()
    
    // Check if this is a bulk import request
    if (requestBody.bulkImport && requestBody.updates) {
      return await handleBulkImport(requestBody)
    }
    
    // Single cell update
    const { 
      rowId, 
      columnId, 
      value, 
      oldValue,
      rowIdentifierColumn = 'RowId',
      sheetName
    } = requestBody
    
    const timestamp = new Date().toISOString()
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_HWROLLOUTRNO
    const targetSheetName = sheetName || process.env.GOOGLE_SHEET_NAME_HWROLLOUTRNO || 'ITCHIOH'
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID is not configured' },
        { status: 500 }
      )
    }

    const sheets = await getSheetsClient()

    // Get all data to find correct row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheetName}!A:Z`,
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


    // Log first 5 DUIDs from Google Sheets for comparison
    dataRows.slice(0, 5).forEach((row, idx) => {
      const sheetDuid = row[idColumnIndex]?.toString()
    })

    let actualRowIndex = -1
    let rowData: any[] | null = null
    
    // Track all DUIDs for debugging
    const allDuids: Array<{index: number, duid: string, length: number}> = []

    for (let i = 0; i < dataRows.length; i++) {
      const sheetDuid = dataRows[i][idColumnIndex]?.toString()
      const searchDuid = rowId?.toString()
      
      // Collect all DUIDs for comparison
      if (sheetDuid) {
        allDuids.push({ index: i + 2, duid: sheetDuid, length: sheetDuid.length })
      }
      
      // Try exact match
      if (sheetDuid === searchDuid) {
        actualRowIndex = i
        rowData = dataRows[i]
        break
      }
      
      // Try flexible matching (trim, case-insensitive, etc.)
      if (sheetDuid && searchDuid) {
        const normalizedSheet = sheetDuid.trim().toUpperCase().replace(/\s+/g, '')
        const normalizedSearch = searchDuid.trim().toUpperCase().replace(/\s+/g, '')
        
        if (normalizedSheet === normalizedSearch) {
          actualRowIndex = i
          rowData = dataRows[i]
          break
        }
        
        // Log very similar DUIDs (for debugging)
        if (sheetDuid.includes(searchDuid.substring(0, 15))) {
        }
      }
    }

    if (actualRowIndex === -1 || !rowData) {
      
      // Character-by-character comparison with first 3 DUIDs
      allDuids.slice(0, 3).forEach(({ index, duid, length }) => {
        const searchStr = rowId.toString()
        const minLength = Math.min(duid.length, searchStr.length)
        
        for (let i = 0; i < minLength; i++) {
          if (duid[i] !== searchStr[i]) {
          }
        }
        
        if (duid.length !== searchStr.length) {
        }
      })
      
      // Find DUIDs that contain part of the search string
      const partialMatches = allDuids
        .filter(({ duid }) => duid.includes(rowId.toString().substring(0, 15)))
        .slice(0, 5)
      
      if (partialMatches.length > 0) {
        partialMatches.forEach(({ index, duid, length }) => {
        })
      }
      
      // Show exact DUIDs that match the beginning
      const startMatches = allDuids
        .filter(({ duid }) => duid.startsWith(rowId.toString().substring(0, 10)))
        .slice(0, 3)
      
      if (startMatches.length > 0) {
        startMatches.forEach(({ index, duid, length }) => {
        })
      }
      
      return NextResponse.json({ 
        error: `Row with ${rowIdentifierColumn}='${rowId}' not found`,
        debug: {
          searchedDuid: rowId,
          searchedLength: rowId.toString().length,
          totalRows: dataRows.length,
          totalDuids: allDuids.length,
          firstThreeDuids: allDuids.slice(0, 3).map(d => d.duid),
          partialMatches: partialMatches.map(m => m.duid),
          startMatches: startMatches.map(m => m.duid)
        }
      }, { status: 404 })
    }

    // Verify target column exists - try multiple matching strategies
    let targetColumnIndex = headers.indexOf(columnId)
    
    // If exact match not found, try flexible matching
    if (targetColumnIndex === -1) {
      // Try matching without spaces
      targetColumnIndex = headers.findIndex(h => 
        h.replace(/\s+/g, '') === columnId ||
        h.replace(/\s+/g, '') === columnId.replace(/\s+/g, '')
      )
      
      // Try case-insensitive match
      if (targetColumnIndex === -1) {
        targetColumnIndex = headers.findIndex(h => 
          h.toLowerCase() === columnId.toLowerCase() ||
          h.replace(/\s+/g, '').toLowerCase() === columnId.replace(/\s+/g, '').toLowerCase()
        )
      }
    }
    
    if (targetColumnIndex === -1) {
      return NextResponse.json({ 
        error: `Column '${columnId}' not found`,
        availableColumns: headers
      }, { status: 400 })
    }
    

    // Get current value for verification
    const currentValue = rowData[targetColumnIndex]

    // Optional: verify old value matches
    if (oldValue !== undefined && currentValue !== oldValue) {
      // Warning: values don't match, but proceeding anyway
    }

    // Calculate cell range (A1 notation)
    const sheetRowNumber = actualRowIndex + 2 // +1 for header, +1 for 1-based
    const columnLetter = String.fromCharCode(65 + targetColumnIndex) // A=65
    const cellRange = `${targetSheetName}!${columnLetter}${sheetRowNumber}`

    // Update the cell
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]]
      }
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
    return NextResponse.json(
      {
        error: 'Failed to update cell',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
