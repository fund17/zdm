import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_HWROLLOUTITC

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Sheet ID not configured' },
        { status: 500 }
      )
    }

    // Fetch sheet_list data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'sheet_list!A2:B100', // Skip header row, get sheet_list and title columns
    })

    const rows = response.data.values || []
    
    // Map to array of objects
    const sheetList = rows
      .filter(row => row[0] && row[1]) // Filter out empty rows
      .map(row => ({
        sheetName: row[0],
        title: row[1],
      }))

    return NextResponse.json({
      success: true,
      data: sheetList,
    })
  } catch (error) {
    console.error('Error fetching sheet list:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sheet list' },
      { status: 500 }
    )
  }
}
