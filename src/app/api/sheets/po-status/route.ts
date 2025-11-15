import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

// Cache for PO data to avoid repeated API calls
let cachedData: { data: Record<string, any>, timestamp: number } | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

async function fetchAllPOData() {
  // Check cache
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    return cachedData.data
  }

  // Get all PO Huawei spreadsheet IDs from environment
  const spreadsheetIds = [
    process.env.GOOGLE_SHEET_ID_POHWITCXLS,
    process.env.GOOGLE_SHEET_ID_POHWITCXL,
    process.env.GOOGLE_SHEET_ID_POHWITCIOH,
    process.env.GOOGLE_SHEET_ID_POHWITCTSEL,
    process.env.GOOGLE_SHEET_ID_POHWRNOXLS,
    process.env.GOOGLE_SHEET_ID_POHWRNOXL,
    process.env.GOOGLE_SHEET_ID_POHWRNOIOH,
    process.env.GOOGLE_SHEET_ID_POHWRNOTSEL,
  ].filter(Boolean) as string[]

  // Initialize Google Sheets API
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })

  // Create index: DUID -> PO records
  const poIndex: Record<string, any[]> = {}

  for (const spreadsheetId of spreadsheetIds) {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
    const sheetNames = spreadsheet.data.sheets?.map(sheet => sheet.properties?.title || '') || []
    const dataSheets = sheetNames.filter(name => 
      !name.toLowerCase().includes('setting') && 
      !name.toLowerCase().includes('config') &&
      !name.toLowerCase().includes('menu')
    )

    for (const sheetName of dataSheets) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      })

      const rows = response.data.values
      if (!rows || rows.length === 0) continue

      const headers = rows[0]
      const siteIdIndex = headers.findIndex((h: string) => 
        h.toLowerCase().includes('site') && h.toLowerCase().includes('id')
      )
      const statusIndex = headers.findIndex((h: string) => 
        h.toLowerCase().includes('status')
      )

      if (siteIdIndex === -1 || statusIndex === -1) continue

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row || row.length === 0) continue

        const siteId = row[siteIdIndex]?.toString().trim()
        const status = row[statusIndex]?.toString().toLowerCase() || ''

        if (!siteId) continue

        if (!poIndex[siteId]) {
          poIndex[siteId] = []
        }

        poIndex[siteId].push({ status })
      }
    }
  }

  // Calculate status for each DUID
  const result: Record<string, any> = {}
  
  for (const [duid, records] of Object.entries(poIndex)) {
    const counts = { close: 0, open: 0, cancelled: 0 }
    
    records.forEach(({ status }) => {
      if (status.includes('close') || status.includes('closed')) {
        counts.close++
      } else if (status.includes('cancel')) {
        counts.cancelled++
      } else {
        counts.open++
      }
    })

    const total = counts.close + counts.open
    result[duid] = {
      close: counts.close,
      open: counts.open,
      cancelled: counts.cancelled,
      total,
      display: total > 0 ? `${counts.close}/${total}` : '0/0',
      percentage: total > 0 ? Math.round((counts.close / total) * 100) : 0
    }
  }

  // Update cache
  cachedData = {
    data: result,
    timestamp: Date.now()
  }

  return result
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const duids = searchParams.get('duids')?.split(',') || []

    const allData = await fetchAllPOData()

    // If specific DUIDs requested, filter
    if (duids.length > 0) {
      const filtered: Record<string, any> = {}
      duids.forEach(duid => {
        if (allData[duid]) {
          filtered[duid] = allData[duid]
        }
      })
      return NextResponse.json({ success: true, data: filtered }, { status: 200 })
    }

    // Return all
    return NextResponse.json({ success: true, data: allData }, { status: 200 })
  } catch (error) {
    console.error('Error fetching PO status:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch PO status', error: String(error) },
      { status: 500 }
    )
  }
}
