import { NextRequest, NextResponse } from 'next/server'
import { getSheetData, getSheetMetadata } from '@/lib/googleSheets'

// NO CACHE - Direct fetch untuk memastikan data selalu update setelah inline edit atau import
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0 // No cache, always fetch fresh data

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_HWROLLOUTITC
    
    // Get sheetName from query params or use default from env
    const { searchParams } = new URL(request.url)
    const sheetName = searchParams.get('sheetName') || process.env.GOOGLE_SHEET_NAME_HWROLLOUTITC || 'ITCHIOH'
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

    // Apply server-side region filtering
    let filteredData = data
    if (region && data && data.length > 0) {
      // Skip filtering if region is "All Region" - show all data
      if (region.toLowerCase() === 'all region') {
        filteredData = data
      } else {
        // Support multi-region filtering (comma-separated)
        const allowedRegions = region.split(',').map(r => r.trim().toLowerCase())
        
        filteredData = data.filter(row => {
          const rowRegion = (row.Region || row.region || '').toString().trim().toLowerCase()
          if (!rowRegion) return false
          
          // Check if row region matches any of the allowed regions
          return allowedRegions.some(allowedRegion => rowRegion === allowedRegion)
        })
      }
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
      data: filteredData || [],
      total: filteredData?.length || 0,
      originalTotal: data?.length || 0,
      regionFilter: region ? { region } : null,
      lastUpdated,
      timestamp: new Date().toISOString(),
      message: 'Data fetched successfully (direct fetch - no cache)'
    })

    // NO CACHE - selalu fetch data terbaru dari Google Sheets
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, max-age=0'
    )

    return response

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch sheet data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
