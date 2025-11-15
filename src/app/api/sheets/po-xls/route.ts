import { NextResponse } from 'next/server'
import { getSheetData } from '@/lib/googleSheets'
import { google } from 'googleapis'

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_POHWITCXLS
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, message: 'PO XLS spreadsheet ID not configured' },
        { status: 500 }
      )
    }

    // Get all sheets from spreadsheet
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
    const sheetNames = spreadsheet.data.sheets?.map((sheet: any) => sheet.properties?.title || '') || []
    
    // Filter out settings/config sheets
    const dataSheets = sheetNames.filter((name: string) => 
      !name.toLowerCase().includes('setting') && 
      !name.toLowerCase().includes('config') &&
      !name.toLowerCase().includes('menu')
    )

    // Fetch data from all sheets
    const allData: any[] = []
    for (const sheetName of dataSheets) {
      const sheetData = await getSheetData(spreadsheetId, sheetName)
      // Normalize column names
      const normalizedData = sheetData.map(row => {
        const normalized: any = { ...row, _sheet: sheetName }
        // Rename 'Site ID PO' to 'Site ID' for consistency
        if (normalized['Site ID PO']) {
          normalized['Site ID'] = normalized['Site ID PO']
          delete normalized['Site ID PO']
        }
        // Rename 'Site Name PO' to 'Site Name' for consistency
        if (normalized['Site Name PO']) {
          normalized['Site Name'] = normalized['Site Name PO']
          delete normalized['Site Name PO']
        }
        // Normalize PO Status column (case-insensitive)
        const statusKeys = Object.keys(normalized).filter(key => key.toLowerCase() === 'po status')
        if (statusKeys.length > 0 && statusKeys[0] !== 'PO Status') {
          normalized['PO Status'] = normalized[statusKeys[0]]
          delete normalized[statusKeys[0]]
        }
        return normalized
      })
      allData.push(...normalizedData)
    }

    return NextResponse.json({
      success: true,
      data: allData,
      metadata: {
        rowCount: allData.length,
        sheets: dataSheets,
        columns: allData[0] ? Object.keys(allData[0]) : [],
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to fetch data' },
      { status: 500 }
    )
  }
}
