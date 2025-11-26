import { NextRequest, NextResponse } from 'next/server'
import { getSheetData, getSheetMetadata } from '@/lib/googleSheets'

// Edge Runtime for faster response and reduced bandwidth via Vercel Edge Network
export const runtime = 'nodejs' // Keep nodejs for Google Sheets API compatibility
// Cache for 3 hours (10800 seconds) - will be invalidated on-demand when user updates
// Only invalidated when user updates data via safe-update or import endpoints
// No one updates directly in Google Sheets, so 3 hours is safe
export const revalidate = 10800 // 3 hours as fallback, but primarily relies on on-demand revalidation
// Enable dynamic for query params (date filtering)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_DAILYPLAN
    const sheetName = process.env.GOOGLE_SHEET_ID_DAILYPLAN_SHEETNAME || 'DailyPlan'
    
    // Get query parameters for date and region filtering
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const region = searchParams.get('region')
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID is not configured' },
        { status: 500 }
      )
    }

    // debug logs removed

    const [data, metadata] = await Promise.all([
      getSheetData(spreadsheetId, sheetName),
      getSheetMetadata(spreadsheetId)
    ])
    
    // debug logs removed

    // Apply server-side date filtering
    let filteredData = data
    if (startDate && endDate && data && data.length > 0) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      
      // Set time to start/end of day for proper comparison
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      
      filteredData = data.filter(row => {
        const dateValue = row.Date
        if (!dateValue) return false
        
        let rowDate: Date | null = null
        
        // Handle Excel serial number (e.g., 45295, 45296)
        if (typeof dateValue === 'number') {
          // Excel serial: days since 1900-01-01 (with 1900 leap year bug)
          const excelEpoch = Date.UTC(1899, 11, 30) // Dec 30, 1899
          const timestamp = excelEpoch + (dateValue * 86400000)
          rowDate = new Date(timestamp)
        } else {
          // Handle string dates
          const dateStr = dateValue.toString()
          
          // Handle 04-Jan-2024 format
          const ddMmmYyyy = /(\d{1,2})-(\w{3})-(\d{4})/.exec(dateStr)
          if (ddMmmYyyy) {
            const [, day, month, year] = ddMmmYyyy
            const monthMap: Record<string, string> = {
              Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
              Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
            }
            const monthNum = monthMap[month]
            if (monthNum) {
              // Parse as UTC to avoid timezone shifts
              rowDate = new Date(Date.UTC(
                parseInt(year),
                parseInt(monthNum) - 1,
                parseInt(day)
              ))
            }
          } else {
            // Handle other formats
            rowDate = new Date(dateStr)
          }
        }
        
        if (!rowDate || isNaN(rowDate.getTime())) return false
        
        return rowDate >= start && rowDate <= end
      })
      
      // debug logs removed
    }

    // Apply server-side region filtering
    if (region && filteredData.length > 0) {
      filteredData = filteredData.filter(row => {
        const rowRegion = row.Region || row.region || ''
        return rowRegion === region
      })
    }
    
    // Format lastUpdated to Indonesian locale
    let lastUpdated: string | undefined
    if (metadata.modifiedTime) {
      const modifiedDate = new Date(metadata.modifiedTime)
      lastUpdated = modifiedDate.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    const response = NextResponse.json({ 
      data: filteredData,
      total: filteredData.length,
      originalTotal: data.length,
      dateFilter: startDate && endDate ? { startDate, endDate } : null,
      regionFilter: region ? { region } : null,
      lastUpdated,
      message: 'Data fetched successfully'
    })

    // Set cache headers for CDN and browser caching
    // s-maxage: CDN cache for 3 hours (10800s) - will be invalidated on-demand when user updates
    // stale-while-revalidate: Serve stale content while revalidating in background (30s)
    // This dramatically reduces Fast Origin Transfer costs on Vercel
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=10800, stale-while-revalidate=30'
    )

    return response
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch data from Google Sheets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}