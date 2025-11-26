import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

// Cache for 1 week (604800 seconds) - Update every Wednesday
// This dramatically reduces bandwidth as PO data doesn't change frequently
export const revalidate = 604800 // 7 days = 7 * 24 * 60 * 60
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check if today is Wednesday (3 = Wednesday in JavaScript Date.getDay())
    const today = new Date()
    const isWednesday = today.getDay() === 3
    
    // Force bypass cache on Wednesday morning (optional: only 8-10 AM Jakarta time)
    const jakartaHour = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).getHours()
    const shouldForceRefresh = isWednesday && jakartaHour >= 8 && jakartaHour < 10
    
    if (shouldForceRefresh) {
      // Wednesday morning force refresh: logging removed for production
    }
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
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const drive = google.drive({ version: 'v3', auth })

    // Fetch data from all sheets across all spreadsheets
    const allData = []
    const allSheetNames: string[] = []
    let latestModifiedTime: Date | null = null
    
    for (const spreadsheetId of spreadsheetIds) {
      // Get metadata for last modified time
      try {
        const fileMetadata = await drive.files.get({
          fileId: spreadsheetId,
          fields: 'modifiedTime'
        })
        
        if (fileMetadata.data.modifiedTime) {
          const modifiedTime = new Date(fileMetadata.data.modifiedTime)
          if (!latestModifiedTime || modifiedTime > latestModifiedTime) {
            latestModifiedTime = modifiedTime
          }
        }
      } catch (metaError) {
        // Silent metadata error
      }
      
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
          
          // Map headers with normalization for common column names
          headers.forEach((header, index) => {
            const value = row[index] || ''
            
            // Normalize column names (case-insensitive, remove extra spaces)
            const normalizedHeader = header.trim()
            const headerLower = normalizedHeader.toLowerCase()
            
            // Normalize PO Status column
            if (headerLower === 'po status' || 
                headerLower === 'postatus' || 
                headerLower === 'status po') {
              rowData['PO Status'] = value
            }
            // Normalize Invoice Pending column
            else if (headerLower === 'invoice pending' || 
                     headerLower === 'invoicepending' || 
                     headerLower === 'pending invoice') {
              rowData['Invoice Pending'] = value
            }
            // Normalize Invoice Amount column
            else if (headerLower === 'invoice amount' || 
                     headerLower === 'invoiceamount' || 
                     headerLower === 'amount invoice') {
              rowData['Invoice Amount'] = value
            }
            else {
              // Keep original header for other columns
              rowData[header] = value
            }
          })

          allData.push(rowData)
        }
      }
    }

    // Format lastUpdated to Indonesian locale
    let lastUpdated: string | undefined
    if (latestModifiedTime) {
      lastUpdated = latestModifiedTime.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // Calculate next cache refresh (next Wednesday)
    const nextWednesday = new Date(today)
    const daysUntilWednesday = (3 - today.getDay() + 7) % 7
    nextWednesday.setDate(today.getDate() + (daysUntilWednesday || 7))
    nextWednesday.setHours(8, 0, 0, 0)

    return NextResponse.json(
      {
        success: true,
        data: allData,
        sheets: allSheetNames,
        spreadsheets: spreadsheetIds.length,
        count: allData.length,
        lastUpdated,
        cacheInfo: {
          cachedUntil: nextWednesday.toLocaleString('id-ID', {
            weekday: 'long',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          nextRefresh: 'Rabu pagi (08:00 WIB)'
        }
      },
      { 
        status: 200,
        headers: {
          // Cache for 1 week on Vercel Edge
          'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400',
          'X-Cache-Strategy': 'weekly-wednesday',
          'X-Next-Refresh': nextWednesday.toISOString()
        }
      }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch data', error: String(error) },
      { status: 500 }
    )
  }
}
