import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Starting import process...')
    
    // Get Sheet ID and Sheet Name from environment
    const SHEET_ID = process.env.GOOGLE_SHEET_ID_DAILYPLAN
    const SHEET_NAME = process.env.GOOGLE_SHEET_ID_DAILYPLAN_SHEETNAME || 'DailyPlan'
    console.log('📋 Sheet ID available:', !!SHEET_ID)
    console.log('📋 Sheet Name:', SHEET_NAME)
    
    const body = await request.json()
    console.log('📦 Received body:', { hasData: !!body.data, dataLength: body.data?.length })
    
    const { data } = body

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error('❌ Invalid data format:', { data: typeof data, isArray: Array.isArray(data) })
      return NextResponse.json(
        { error: 'No data provided or invalid format' },
        { status: 400 }
      )
    }

    console.log(`📥 Importing ${data.length} rows...`)
    console.log('📋 Sample row:', data[0])

    // Verify environment variables
    if (!SHEET_ID) {
      console.error('❌ GOOGLE_SHEET_ID not configured')
      return NextResponse.json(
        { error: 'Sheet ID not configured' },
        { status: 500 }
      )
    }

    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.error('❌ Google credentials not configured')
      return NextResponse.json(
        { error: 'Google credentials not configured' },
        { status: 500 }
      )
    }

    console.log('🔐 Initializing Google Sheets API...')
    
    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    console.log('✅ Google Sheets API initialized')

    // Use SHEET_NAME from environment variable
    console.log(`📝 Using sheet name: ${SHEET_NAME}`)

    // Get existing headers from the first row
    console.log('📋 Fetching headers...')
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!1:1`,
    })

    const headers = headerResponse.data.values?.[0] || []
    
    if (headers.length === 0) {
      console.error('❌ No headers found in the sheet')
      return NextResponse.json(
        { error: 'No headers found in the sheet' },
        { status: 400 }
      )
    }

    console.log('📋 Sheet headers:', headers)
    console.log(`✅ Found ${headers.length} headers`)

    // Find the RowId column index
    const rowIdIndex = headers.findIndex((h: string) => h === 'RowId')
    console.log(`🔍 RowId column index: ${rowIdIndex}`)
    
    if (rowIdIndex === -1) {
      console.error('❌ RowId column not found. Available headers:', headers)
      return NextResponse.json(
        { error: 'RowId column not found in the sheet' },
        { status: 400 }
      )
    }

    // Prepare rows for import
    console.log('🔄 Preparing rows for import...')
    const rows = data.map((row: any, idx: number) => {
      const newRow: any[] = new Array(headers.length).fill('')
      
      // Generate UUID for RowId
      const uuid = randomUUID()
      newRow[rowIdIndex] = uuid
      
      // Map data to correct columns based on headers
      let mappedCount = 0
      headers.forEach((header: string, index: number) => {
        if (header !== 'RowId' && row[header] !== undefined && row[header] !== null) {
          newRow[index] = row[header]
          mappedCount++
        }
      })
      
      if (idx === 0) {
        console.log(`📊 Sample row mapping (first row):`, {
          uuid,
          mappedColumns: mappedCount,
          totalColumns: headers.length,
          sampleData: Object.keys(row).slice(0, 5)
        })
      }
      
      return newRow
    })

    console.log(`📝 Prepared ${rows.length} rows for import`)
    console.log('📊 Sample prepared row:', rows[0]?.slice(0, 5))

    // Append rows to the sheet
    console.log(`📤 Appending ${rows.length} rows to Google Sheets...`)
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:A`, // Start from column A
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: rows,
      },
    })

    const updatedRows = appendResponse.data.updates?.updatedRows || 0
    console.log(`✅ Successfully imported ${updatedRows} rows`)
    console.log('📊 Append response:', {
      updatedRange: appendResponse.data.updates?.updatedRange,
      updatedRows: updatedRows,
      updatedColumns: appendResponse.data.updates?.updatedColumns,
      updatedCells: appendResponse.data.updates?.updatedCells
    })

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${updatedRows} rows`,
      count: updatedRows,
    })

  } catch (error) {
    console.error('❌ Import error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // More detailed error message
    let errorMessage = 'Failed to import data'
    let errorDetails = 'Unknown error'
    
    if (error instanceof Error) {
      errorMessage = error.message
      errorDetails = error.stack || error.message
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    )
  }
}
