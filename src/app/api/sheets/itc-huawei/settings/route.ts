import { NextRequest, NextResponse } from 'next/server'
import { getSheetData } from '@/lib/googleSheets'

interface ColumnSetting {
  colom: string
  type: string
  show: string
  editable: string
}

type ColumnType = 'string' | 'date' | 'time' | 'textarea' | 'currency' | 'list'

interface ColumnConfig {
  name: string
  type: ColumnType
  show: boolean
  editable: boolean
  displayName: string
  sticky?: 'left' | 'right' | null
}

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_HWROLLOUTITC
    const settingSheetName = process.env.GOOGLE_SHEET_NAME_HWROLLOUTITC_SETTING || 'settings'
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID is not configured' },
        { status: 500 }
      )
    }

    // Fetching ITC Huawei settings

    const settingsData = await getSheetData(spreadsheetId, settingSheetName)

    if (!settingsData || settingsData.length === 0) {
      return NextResponse.json(
        { error: 'No settings data found' },
        { status: 404 }
      )
    }

    // Raw settings data processed

    // Parse column configuration - using Column, Value, Editable, Show structure
    const columnConfigs: ColumnConfig[] = settingsData.map((row: any) => {
      const columnName = row.Column || ''
      const type = row.Value || 'String'
      const editable = (row.Editable || 'yes').toString().toLowerCase() === 'yes'
      const show = (row.Show || 'yes').toString().toLowerCase() === 'yes'
      
      // Normalize type
      let normalizedType: ColumnType = 'string'
      const lowerType = type.toLowerCase()
      
      if (['date', 'time', 'textarea', 'currency', 'list'].includes(lowerType)) {
        normalizedType = lowerType as ColumnType
      }

      // Internal name without spaces (e.g., "DU Name" -> "DUName")
      const internalName = columnName.replace(/\s+/g, '')
      
      return {
        name: internalName,
        type: normalizedType,
        show: show,
        editable: editable,
        displayName: columnName // Keep original display name with spaces
      }
    }).filter(config => config.name)

    const visibleColumns = columnConfigs.filter(c => c.show)
    const editableColumns = columnConfigs.filter(c => c.editable)
    const hiddenColumns = columnConfigs.filter(c => !c.show)
    const readOnlyColumns = columnConfigs.filter(c => !c.editable)

    // Column configuration summarised
    
    // Hidden columns: apply as necessary

    return NextResponse.json({
      success: true,
      message: 'Column settings fetched successfully',
      data: {
        columns: columnConfigs,
        summary: {
          total: columnConfigs.length,
          visible: visibleColumns.length,
          editable: editableColumns.length
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {

    return NextResponse.json(
      {
        error: 'Failed to fetch column settings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
