import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get all PO Huawei spreadsheet IDs from environment
    const spreadsheetIds = [
      // ITC spreadsheets
      process.env.GOOGLE_SHEET_ID_POHWITCXLS,
      process.env.GOOGLE_SHEET_ID_POHWITCXL,
      process.env.GOOGLE_SHEET_ID_POHWITCIOH,
      process.env.GOOGLE_SHEET_ID_POHWITCTSEL,
      // RNO spreadsheets
      process.env.GOOGLE_SHEET_ID_POHWRNOXLS,
      process.env.GOOGLE_SHEET_ID_POHWRNOXL,
      process.env.GOOGLE_SHEET_ID_POHWRNOIOH,
      process.env.GOOGLE_SHEET_ID_POHWRNOTSEL,
    ].filter(Boolean) as string[]
    
    if (spreadsheetIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No spreadsheet IDs configured' },
        { status: 500 }
      )
    }

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Fetch data from all sheets across all spreadsheets
    const allData = []
    const allSheetNames: string[] = []
    
    for (const spreadsheetId of spreadsheetIds) {
      // Get sheet names for this spreadsheet
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId,
      })

      const sheetNames = spreadsheet.data.sheets?.map(sheet => sheet.properties?.title || '') || []
      
      // Filter out settings/config sheets
      const dataSheets = sheetNames.filter(name => 
        !name.toLowerCase().includes('setting') && 
        !name.toLowerCase().includes('config') &&
        !name.toLowerCase().includes('menu')
      )

      allSheetNames.push(...dataSheets)
      
      // Fetch data from all sheets in this spreadsheet
      for (const sheetName of dataSheets) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:Z`, // Columns A to Z (extended to include PO Status in column W)
        })

        const rows = response.data.values

        if (!rows || rows.length === 0) continue

        // Get headers from first row
        const headers = rows[0]

        // Process data rows
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length === 0) continue

          const rowData: any = { 
            _sheet: sheetName,
            _spreadsheet: spreadsheetId 
          }
          
          headers.forEach((header, index) => {
            rowData[header] = row[index] || ''
          })

          allData.push(rowData)
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: allData,
        sheets: allSheetNames,
        spreadsheets: spreadsheetIds.length,
        count: allData.length,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching PO Huawei data:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch data', error: String(error) },
      { status: 500 }
    )
  }
}
