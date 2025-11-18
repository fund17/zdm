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
      const remainingIndex = headers.findIndex((h: string) => 
        h.toLowerCase() === 'remaining'
      )
      const statusIndex = headers.findIndex((h: string) => 
        h.toLowerCase().includes('status')
      )

      if (siteIdIndex === -1 || remainingIndex === -1) continue

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row || row.length === 0) continue

        const siteId = row[siteIdIndex]?.toString().trim()
        const remainingValue = row[remainingIndex]
        const status = statusIndex !== -1 ? row[statusIndex]?.toString().trim().toLowerCase() : ''

        if (!siteId) continue
        
        // Skip cancelled POs - tidak masuk dalam perhitungan
        if (status.includes('cancel')) continue

        // Parse remaining value - could be percentage string or number
        let remaining = 0
        if (typeof remainingValue === 'string') {
          // Remove % sign and parse
          const cleaned = remainingValue.replace('%', '').trim()
          remaining = parseFloat(cleaned) || 0
        } else if (typeof remainingValue === 'number') {
          remaining = remainingValue
        }

        if (!poIndex[siteId]) {
          poIndex[siteId] = []
        }

        poIndex[siteId].push({ remaining })
      }
    }
  }

  // Calculate average remaining percentage for each DUID
  const result: Record<string, any> = {}
  
  for (const [duid, records] of Object.entries(poIndex)) {
    if (records.length === 0) continue
    
    // Calculate average of remaining values
    const totalRemaining = records.reduce((sum, { remaining }) => sum + remaining, 0)
    const avgRemaining = totalRemaining / records.length
    
    // If remaining is already in percentage (0-100), use as is
    // If remaining is decimal (0-1), convert to percentage
    let percentage = avgRemaining
    if (avgRemaining <= 1) {
      percentage = avgRemaining * 100
    }
    
    // Round to nearest integer
    percentage = Math.round(percentage)
    
    result[duid] = {
      totalLines: records.length,
      avgRemaining: Math.round(avgRemaining * 100) / 100, // Keep 2 decimal for debugging
      percentage: 100 - percentage, // Invert: high remaining = low completion
      display: `${100 - percentage}%` // Show completion percentage
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

    // If specific DUIDs requested, filter with case-insensitive matching
    if (duids.length > 0) {
      const filtered: Record<string, any> = {}
      duids.forEach(requestedDuid => {
        const normalizedRequested = requestedDuid.trim().toLowerCase()
        
        // Try exact match first
        if (allData[requestedDuid]) {
          filtered[requestedDuid] = allData[requestedDuid]
          return
        }
        
        // Try case-insensitive match
        for (const [poDuid, poData] of Object.entries(allData)) {
          if (poDuid.toLowerCase() === normalizedRequested) {
            filtered[requestedDuid] = poData // Keep original requested key
            return
          }
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const requestedDuids = body.duids || []

    if (!Array.isArray(requestedDuids) || requestedDuids.length === 0) {
      return NextResponse.json(
        { success: false, message: 'duids array is required' },
        { status: 400 }
      )
    }

    const allData = await fetchAllPOData()

    // Filter PO data - only return what's requested
    const matched: Record<string, any> = {}
    const orphans: Record<string, any> = {}
    
    // Create normalized lookup map for requested DUIDs
    const requestedSet = new Set(requestedDuids.map(d => d.toString().trim().toLowerCase()))
    
    // Find matches
    for (const requestedDuid of requestedDuids) {
      const normalizedRequested = requestedDuid.toString().trim().toLowerCase()
      
      // Try exact match first
      if (allData[requestedDuid]) {
        matched[requestedDuid] = allData[requestedDuid]
        continue
      }
      
      // Try case-insensitive match
      let found = false
      for (const [poDuid, poData] of Object.entries(allData)) {
        if (poDuid.toLowerCase() === normalizedRequested) {
          matched[requestedDuid] = poData // Use requested key format
          found = true
          break
        }
      }
    }
    
    // Find orphans (PO exists but not requested by table)
    for (const [poDuid, poData] of Object.entries(allData)) {
      const normalizedPoDuid = poDuid.toLowerCase()
      if (!requestedSet.has(normalizedPoDuid)) {
        orphans[poDuid] = poData
      }
    }
    
    // debug logs removed

    return NextResponse.json({ 
      success: true, 
      data: matched,
      orphans: orphans, // Return orphans for debugging/monitoring
      stats: {
        requested: requestedDuids.length,
        matched: Object.keys(matched).length,
        orphaned: Object.keys(orphans).length,
        total: Object.keys(allData).length
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching PO status:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch PO status', error: String(error) },
      { status: 500 }
    )
  }
}
