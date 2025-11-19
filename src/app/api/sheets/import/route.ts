import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // Starting import process (debug logs removed)
    
    // Get Sheet ID and Sheet Name from environment
    const SHEET_ID = process.env.GOOGLE_SHEET_ID_DAILYPLAN
    const SHEET_NAME = process.env.GOOGLE_SHEET_ID_DAILYPLAN_SHEETNAME || 'DailyPlan'
    // debug logs removed
    
    const body = await request.json()
    // debug logs removed
    const { data } = body

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'No data provided or invalid format' },
        { status: 400 }
      )
    }

    // debug logs removed
    
    // Verify environment variables
    if (!SHEET_ID) {
      return NextResponse.json(
        { error: 'Sheet ID not configured' },
        { status: 500 }
      )
    }

    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Google credentials not configured' },
        { status: 500 }
      )
    }

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Get existing headers from the first row
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!1:1`,
    })

    const headers = headerResponse.data.values?.[0] || []
    
    if (headers.length === 0) {
      return NextResponse.json(
        { error: 'No headers found in the sheet' },
        { status: 400 }
      )
    }

    // Find the RowId column index
    const rowIdIndex = headers.findIndex((h: string) => h === 'RowId')
    
    if (rowIdIndex === -1) {
      return NextResponse.json(
        { error: 'RowId column not found in the sheet' },
        { status: 400 }
      )
    }

    // Prepare rows for import
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
      
      return newRow
    })

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

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${updatedRows} rows`,
      count: updatedRows,
    })

  } catch (error) {
    
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
