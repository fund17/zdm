import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/spreadsheets/readonly']

async function getGoogleSheetsClient() {
  const client = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  })

  await client.authorize()
  return google.sheets({ version: 'v4', auth: client })
}

export async function GET() {
  try {
    // debug logs removed

    const sheets = await getGoogleSheetsClient()
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_DAILYPLAN
    const sheetName = process.env.GOOGLE_SHEET_ID_DAILYPLAN_SHEETMENU

    if (!spreadsheetId || !sheetName) {
      throw new Error('Missing spreadsheet ID or menu sheet name in environment variables')
    }

    // Fetch menu data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`, // Get all data from menu sheet
    })

    const rows = response.data.values || []
    
    if (rows.length === 0) {
      // debug logs removed
      return NextResponse.json({
        success: true,
        data: {},
        message: 'No menu data found'
      })
    }

    // First row contains column headers
    const headers = rows[0]
    const menuData: Record<string, string[]> = {}

    // debug logs removed

    // Process each column to create dropdown lists
    headers.forEach((header, index) => {
      if (header && header.trim()) {
        const columnName = header.trim()
        const values: string[] = []
        
        // Get all non-empty values from this column (skip header row)
        for (let i = 1; i < rows.length; i++) {
          const value = rows[i]?.[index]
          if (value && value.trim()) {
            values.push(value.trim())
          }
        }
        
        menuData[columnName] = values
      }
    })

    // debug logs removed

    return NextResponse.json({
      success: true,
      data: menuData,
      summary: {
        totalColumns: Object.keys(menuData).length,
        columns: Object.keys(menuData),
        sampleCounts: Object.fromEntries(
          Object.entries(menuData).map(([key, values]) => [key, values.length])
        )
      }
    })

  } catch (error) {
    console.error('❌ Error fetching menu data:', error)
    // debug logs removed
    
    // Return fallback menu data instead of error - matching sheet Menu structure
    const fallbackMenuData = {
      'Activity': ['Survey', 'MOS', 'Installation', 'Integration', 'ATP / SIR', 'Rectification', 'Tagging', 'Dismantle', 'Inbound', 'Outbound', 'Troubleshoot', 'RF Audit', 'PLN Upgrade', 'Others'],
      'Team Category': ['Internal', 'External', 'B2B', 'SP'],
      'SOW': ['TE', 'MW', 'DISM', 'TSS', 'PLN'],
      'Vendor': ['HUAWEI', 'ZTE'],
      'Status': ['On Plan', 'On Going', 'Carry Over', 'Done', 'Failed', 'Idle', 'Off'],
      'Projects': ['IOH', 'XLS', 'TSEL'],
    }
    
    return NextResponse.json({
      success: true,
      data: fallbackMenuData,
      fallback: true,
      summary: {
        totalColumns: Object.keys(fallbackMenuData).length,
        columns: Object.keys(fallbackMenuData),
        sampleCounts: Object.fromEntries(
          Object.entries(fallbackMenuData).map(([key, values]) => [key, values.length])
        )
      }
    })
  }
}