import { NextRequest, NextResponse } from 'next/server'
import { getSheetsClient } from '@/lib/googleSheets'

interface SafeUpdateRequest {
  rowId: string | number
  columnId: string
  value: any
  oldValue?: any
  rowIdentifierColumn?: string
  sheetName?: string
}

export async function PUT(request: NextRequest) {
  try {
    const { 
      rowId, 
      columnId, 
      value, 
      oldValue,
      rowIdentifierColumn = 'RowId',
      sheetName
    }: SafeUpdateRequest = await request.json()
    
    const timestamp = new Date().toISOString()
    
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_HWROLLOUTITC
    const targetSheetName = sheetName || process.env.GOOGLE_SHEET_NAME_HWROLLOUTITC || 'ITCHIOH'
    
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
      sheetName: targetSheetName,
      timestamp
    })

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

    console.log(`📊 Google Sheets has ${dataRows.length} data rows`)
    console.log(`🔍 Looking for DUID: "${rowId}"`)
    console.log(`  📏 Length: ${rowId.toString().length}`)
    console.log(`  🔤 Type: ${typeof rowId}`)

    // Find row by unique ID
    const idColumnIndex = headers.indexOf(rowIdentifierColumn)
    if (idColumnIndex === -1) {
      return NextResponse.json({ 
        error: `Identifier column '${rowIdentifierColumn}' not found in headers` 
      }, { status: 400 })
    }

    console.log(`📍 DUID column index: ${idColumnIndex} (column ${String.fromCharCode(65 + idColumnIndex)})`)

    // Log first 5 DUIDs from Google Sheets for comparison
    console.log('🔍 First 5 DUIDs in Google Sheets:')
    dataRows.slice(0, 5).forEach((row, idx) => {
      const sheetDuid = row[idColumnIndex]?.toString()
      console.log(`  ${idx + 1}. "${sheetDuid}" (length: ${sheetDuid?.length})`)
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
        console.log(`✅ EXACT MATCH FOUND at row ${i + 2}`)
        console.log(`  Sheet DUID: "${sheetDuid}" (length: ${sheetDuid.length})`)
        console.log(`  Search DUID: "${searchDuid}" (length: ${searchDuid.length})`)
        console.log(`  Exact match: ${sheetDuid === searchDuid}`)
        break
      }
      
      // Try flexible matching (trim, case-insensitive, etc.)
      if (sheetDuid && searchDuid) {
        const normalizedSheet = sheetDuid.trim().toUpperCase().replace(/\s+/g, '')
        const normalizedSearch = searchDuid.trim().toUpperCase().replace(/\s+/g, '')
        
        if (normalizedSheet === normalizedSearch) {
          actualRowIndex = i
          rowData = dataRows[i]
          console.log(`✅ NORMALIZED MATCH FOUND at row ${i + 2}`)
          console.log(`  Sheet DUID (original): "${sheetDuid}"`)
          console.log(`  Sheet DUID (normalized): "${normalizedSheet}"`)
          console.log(`  Search DUID (original): "${searchDuid}"`)
          console.log(`  Search DUID (normalized): "${normalizedSearch}"`)
          break
        }
        
        // Log very similar DUIDs (for debugging)
        if (sheetDuid.includes(searchDuid.substring(0, 15))) {
          console.log(`💡 Similar DUID at row ${i + 2}: "${sheetDuid}"`)
          console.log(`  Difference: Sheet has ${sheetDuid.length} chars, Search has ${searchDuid.length} chars`)
        }
      }
    }

    if (actualRowIndex === -1 || !rowData) {
      console.error(`❌ DUID NOT FOUND IN GOOGLE SHEETS`)
      console.log(`  🔍 Searched for: "${rowId}" (length: ${rowId.toString().length})`)
      console.log(`  📊 Total rows searched: ${dataRows.length}`)
      console.log(`  📊 Total DUIDs collected: ${allDuids.length}`)
      
      // Character-by-character comparison with first 3 DUIDs
      console.log(`\n🔬 CHARACTER COMPARISON with first 3 DUIDs:`)
      allDuids.slice(0, 3).forEach(({ index, duid, length }) => {
        console.log(`\n  Row ${index}: "${duid}" (length: ${length})`)
        const searchStr = rowId.toString()
        const minLength = Math.min(duid.length, searchStr.length)
        
        for (let i = 0; i < minLength; i++) {
          if (duid[i] !== searchStr[i]) {
            console.log(`    ❌ Diff at position ${i}: Sheet='${duid[i]}' (code ${duid.charCodeAt(i)}) vs Search='${searchStr[i]}' (code ${searchStr.charCodeAt(i)})`)
          }
        }
        
        if (duid.length !== searchStr.length) {
          console.log(`    ⚠️ Length difference: Sheet=${duid.length}, Search=${searchStr.length}`)
        }
      })
      
      // Find DUIDs that contain part of the search string
      const partialMatches = allDuids
        .filter(({ duid }) => duid.includes(rowId.toString().substring(0, 15)))
        .slice(0, 5)
      
      if (partialMatches.length > 0) {
        console.log(`\n  💡 Potential partial matches:`)
        partialMatches.forEach(({ index, duid, length }) => {
          console.log(`    Row ${index}: "${duid}" (length: ${length})`)
        })
      }
      
      // Show exact DUIDs that match the beginning
      const startMatches = allDuids
        .filter(({ duid }) => duid.startsWith(rowId.toString().substring(0, 10)))
        .slice(0, 3)
      
      if (startMatches.length > 0) {
        console.log(`\n  🎯 DUIDs starting with same prefix:`)
        startMatches.forEach(({ index, duid, length }) => {
          console.log(`    Row ${index}: "${duid}" (length: ${length})`)
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
    const cellRange = `${targetSheetName}!${columnLetter}${sheetRowNumber}`

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
