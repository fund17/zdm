import { NextRequest, NextResponse } from 'next/server'
import { getSheetData, getSheetMetadata } from '@/lib/googleSheets'

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_DAILYPLAN
    const sheetName = process.env.GOOGLE_SHEET_ID_DAILYPLAN_SHEETNAME || 'DailyPlan'
    
    // Get query parameters for date filtering
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
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
        const dateStr = row.Date?.toString()
        if (!dateStr) return false
        
        // Parse date from various formats
        let rowDate: Date | null = null
        
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
            rowDate = new Date(`${year}-${monthNum}-${day.padStart(2, '0')}`)
          }
        } else {
          // Handle other formats
          rowDate = new Date(dateStr)
        }
        
        if (!rowDate || isNaN(rowDate.getTime())) return false
        
        return rowDate >= start && rowDate <= end
      })
      
      // debug logs removed
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
    
    return NextResponse.json({ 
      data: filteredData,
      total: filteredData.length,
      originalTotal: data.length,
      dateFilter: startDate && endDate ? { startDate, endDate } : null,
      lastUpdated,
      message: 'Data fetched successfully'
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch data from Google Sheets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}