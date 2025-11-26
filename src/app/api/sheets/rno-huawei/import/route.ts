import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { google } from 'googleapis'
import { RNO_CONFIG, getEnvValues } from '@/lib/huaweiRouteConfig'

export async function POST(request: NextRequest) {
  try {
    const { sheetName, rows } = await request.json()

    if (!sheetName) {
      return NextResponse.json(
        { error: 'Sheet name is required' },
        { status: 400 }
      )
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'No rows to register' },
        { status: 400 }
      )
    }

    if (rows.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 rows allowed' },
        { status: 400 }
      )
    }

    // Validate required fields
    const requiredFields = ['DUID', 'DU Name', 'Region', 'Project Code']
    for (const row of rows) {
      for (const field of requiredFields) {
        if (!row[field] || row[field].toString().trim() === '') {
          return NextResponse.json(
            { error: `Missing required field: ${field}` },
            { status: 400 }
          )
        }
      }
    }

    // Initialize Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const { spreadsheetId } = getEnvValues(RNO_CONFIG)

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Spreadsheet ID not configured' },
        { status: 500 }
      )
    }

    // Get current data to check for duplicates
    const currentData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    })

    const existingRows = currentData.data.values || []
    if (existingRows.length === 0) {
      return NextResponse.json(
        { error: 'Sheet is empty or headers not found' },
        { status: 400 }
      )
    }

    const headers = existingRows[0]
    
    // Log headers for debugging


    const duidColumnIndex = headers.findIndex((h: string) => 
      h.toLowerCase() === 'duid' || h === 'DUID'
    )

    if (duidColumnIndex === -1) {
      return NextResponse.json(
        { error: 'DUID column not found in sheet' },
        { status: 400 }
      )
    }

    // Check for duplicates in existing data
    const existingDUIDs = new Set(
      existingRows.slice(1).map((row: any[]) => row[duidColumnIndex]).filter(Boolean)
    )

    const duplicates = rows.filter(row => existingDUIDs.has(row.DUID))
    if (duplicates.length > 0) {
      return NextResponse.json(
        { 
          error: 'Duplicate DUIDs found', 
          duplicates: duplicates.map(r => r.DUID) 
        },
        { status: 400 }
      )
    }

    // Prepare rows for insertion
    const valuesToAppend = rows.map((row, rowIndex) => {
      // Create array with same length as headers, filled with empty strings
      const rowArray = new Array(headers.length).fill('')
      
      // Map each header to corresponding value from Excel
      headers.forEach((header: string, index: number) => {
        // Skip empty headers in Google Sheets
        if (!header || !header.toString().trim()) return
        
        const normalizedHeader = header.toString().toLowerCase().replace(/\s+/g, '').trim()
        
        // Try to find matching field in Excel row
        let value = ''
        
        // Direct exact match first
        if (row[header] !== undefined && row[header] !== null) {
          value = row[header]
        } else {
          // Try normalized match
          const matchingKey = Object.keys(row).find(key => {
            // Skip empty keys
            if (!key || !key.trim()) return false
            
            const normalizedKey = key.toLowerCase().replace(/\s+/g, '').trim()
            return normalizedKey === normalizedHeader
          })
          
          if (matchingKey) {
            value = row[matchingKey]
          }
        }
        
        rowArray[index] = value !== undefined && value !== null ? value.toString() : ''
        
        if (rowIndex === 0) {

        }
      })
      
      if (rowIndex === 0) {

      }
      
      return rowArray
    })

    // Append rows to sheet
    // Skip first column (index 0) if it's empty by starting from column B
    const firstNonEmptyColIndex = headers.findIndex((h: string) => h && h.toString().trim())
    const startColumn = firstNonEmptyColIndex === 0 ? 'A' : String.fromCharCode(65 + firstNonEmptyColIndex) // A=65 in ASCII


    // Remove empty columns from the beginning of each row
    const cleanedRows = valuesToAppend.map(row => row.slice(firstNonEmptyColIndex))
    
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!${startColumn}:Z`,
      valueInputOption: 'RAW',
      requestBody: {
        values: cleanedRows,
      },
    })

    // Invalidate cache after successful import
    try {
      revalidatePath('/api/sheets/rno-huawei')
      revalidatePath('/rno-huawei')
    } catch (revalidateError) {
      console.warn('Cache revalidation warning:', revalidateError)
    }

    return NextResponse.json({
      success: true,
      count: rows.length,
      range: appendResponse.data.updates?.updatedRange,
      cacheInvalidated: true
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to register DUIDs', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
