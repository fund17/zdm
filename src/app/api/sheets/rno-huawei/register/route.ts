import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

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
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID_ITC_HUAWEI

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
    const valuesToAppend = rows.map(row => {
      // Create array matching header order
      const rowArray = headers.map((header: string) => {
        // Match column names (case-insensitive, flexible)
        const normalizedHeader = header.toLowerCase().replace(/\s+/g, '')
        
        if (normalizedHeader === 'duid') return row['DUID'] || ''
        if (normalizedHeader === 'duname') return row['DU Name'] || ''
        if (normalizedHeader === 'region') return row['Region'] || ''
        if (normalizedHeader === 'projectcode') return row['Project Code'] || ''
        
        // Try exact match
        if (row[header]) return row[header]
        
        // Return empty for other columns
        return ''
      })
      return rowArray
    })

    // Append rows to sheet
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      requestBody: {
        values: valuesToAppend,
      },
    })

    return NextResponse.json({
      success: true,
      count: rows.length,
      range: appendResponse.data.updates?.updatedRange,
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
