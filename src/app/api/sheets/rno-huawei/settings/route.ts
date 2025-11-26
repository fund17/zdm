import { NextRequest, NextResponse } from 'next/server'
import { getSheetData } from '@/lib/googleSheets'
import { RNO_CONFIG, getEnvValues } from '@/lib/huaweiRouteConfig'

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
    const { spreadsheetId, settingSheetName } = getEnvValues(RNO_CONFIG)
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID is not configured' },
        { status: 500 }
      )
    }

    const settingsData = await getSheetData(spreadsheetId, settingSheetName)

    if (!settingsData || settingsData.length === 0) {
      return NextResponse.json(
        { error: 'No settings data found' },
        { status: 404 }
      )
    }

    const columnConfigs: ColumnConfig[] = settingsData.map((row: any) => {
      const columnName = row.Column || ''
      const type = row.Value || 'String'
      const editable = (row.Editable || 'yes').toString().toLowerCase() === 'yes'
      const show = (row.Show || 'yes').toString().toLowerCase() === 'yes'
      
      let normalizedType: ColumnType = 'string'
      const lowerType = type.toLowerCase()
      
      if (['date', 'time', 'textarea', 'currency', 'list'].includes(lowerType)) {
        normalizedType = lowerType as ColumnType
      }

      const internalName = columnName.replace(/\s+/g, '')
      
      return {
        name: internalName,
        type: normalizedType,
        show: show,
        editable: editable,
        displayName: columnName
      }
    }).filter(config => config.name)

    const visibleColumns = columnConfigs.filter(c => c.show)
    const editableColumns = columnConfigs.filter(c => c.editable)

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
