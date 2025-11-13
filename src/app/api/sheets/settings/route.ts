import { NextRequest, NextResponse } from 'next/server'
import { getSheetData } from '@/lib/googleSheets'

interface ColumnSetting {
  colom: string          // Column name
  type: string           // String, Date, Time, TextArea, Currency, List
  show: string           // Yes/No/StickyLeft/StickyRight
  editable: string       // Yes/No
}

type ColumnType = 'string' | 'date' | 'time' | 'textarea' | 'currency' | 'list'

interface ColumnConfig {
  name: string
  type: ColumnType
  show: boolean
  editable: boolean
  displayName: string
  sticky?: 'left' | 'right' | null // Add sticky position
}

interface SettingsResponse {
  success: boolean
  data: {
    columns: ColumnConfig[]
    summary: {
      total: number
      visible: number
      editable: number
    }
  }
  error?: string
}

export async function GET(request: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_DAILYPLAN
    const settingSheetName = process.env.GOOGLE_SHEET_ID_DAILYPLAN_SHEETSETTING || 'setting'
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID is not configured' },
        { status: 500 }
      )
    }

    console.log('📋 FETCHING COLUMN SETTINGS:', {
      spreadsheetId,
      settingSheetName,
      timestamp: new Date().toISOString()
    })

    // Fetch settings data from the setting sheet
    const settingsData = await getSheetData(spreadsheetId, settingSheetName)

    console.log('📊 SETTINGS FETCH RESULT:', {
      success: !!settingsData,
      dataType: Array.isArray(settingsData) ? 'array' : typeof settingsData,
      length: settingsData?.length || 0
    })

    if (!settingsData || settingsData.length === 0) {
      return NextResponse.json(
        { error: 'No settings data found' },
        { status: 404 }
      )
    }

    // Log raw data from settings sheet for debugging
    console.log('🔍 RAW SETTINGS DATA:', {
      sheetName: settingSheetName,
      rowCount: settingsData.length,
      firstRow: settingsData[0],
      columnNames: settingsData.length > 0 ? Object.keys(settingsData[0]) : [],
      allRows: settingsData.slice(0, 5) // Show first 5 rows for debugging
    })

    // Parse and normalize column configuration
    const columnConfigs: ColumnConfig[] = settingsData.map((row: any) => {
      const colom = row.Colom || ''
      const type = row.Type || 'string'
      const show = String(row.Show || '').toLowerCase()
      const editable = String(row.Editable || '').toLowerCase()
      
      const isVisible = ['true', 'yes', '1', 'ya'].includes(show)
      let normalizedType: ColumnType = 'string'
      const lowerType = type.toLowerCase()
      
      if (['date', 'time', 'textarea', 'currency', 'list'].includes(lowerType)) {
        normalizedType = lowerType as ColumnType
      }

      // Parse boolean values
      const isEditable = ['true', 'yes', '1', 'ya'].includes(editable)

      // Create display name from column name with better camelCase handling
      // This handles: SiteID -> Site ID, TeamCategory -> Team Category, etc.
      let displayName = colom
        // Add space before capital letters that follow lowercase letters
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Add space before capital letters followed by lowercase in acronyms (e.g., "XMLParser" -> "XML Parser")
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
        .trim()
      
      // Capitalize first letter if not already
      if (displayName.length > 0) {
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1)
      }
      
      return {
        name: colom,
        type: normalizedType,
        show: isVisible,
        editable: isEditable,
        displayName: displayName
      }
    }).filter(config => config.name) // Remove empty column names

    // Ensure RowId column exists for table operations (must be hidden)
    const hasRowId = columnConfigs.some(config => config.name === 'RowId')
    if (!hasRowId) {
      console.log('⚠️ Adding missing RowId column configuration')
      columnConfigs.unshift({
        name: 'RowId',
        type: 'string',
        show: false, // Always hidden
        editable: false, // Never editable
        displayName: 'Row ID'
      })
    } else {
      // Ensure RowId is always hidden and not editable
      const rowIdConfig = columnConfigs.find(config => config.name === 'RowId')
      if (rowIdConfig) {
        rowIdConfig.show = false
        rowIdConfig.editable = false
        console.log('✅ RowId column found and configured as hidden/read-only')
      }
    }

    // Separate visible and hidden columns for logging
    const visibleColumns = columnConfigs.filter(c => c.show)
    const editableColumns = columnConfigs.filter(c => c.editable)

    console.log('⚙️ COLUMN CONFIGURATION PARSED:', {
      totalColumns: columnConfigs.length,
      visibleColumns: visibleColumns.length,
      editableColumns: editableColumns.length,
      rowIdColumn: columnConfigs.find(c => c.name === 'RowId') ? 'Found (Hidden)' : 'Missing',
      hiddenColumns: columnConfigs.filter(c => !c.show).map(c => c.name),
      readOnlyColumns: columnConfigs.filter(c => c.show && !c.editable).map(c => c.name),
      editableColumnsList: editableColumns.map(c => `${c.name}(${c.type})`)
    })

    return NextResponse.json({
      success: true,
      message: 'Column settings fetched successfully',
      data: {
        columns: columnConfigs,
        summary: {
          total: columnConfigs.length,
          visible: visibleColumns.length,
          editable: editableColumns.length,
          byType: {
            string: columnConfigs.filter(c => c.type === 'string').length,
            date: columnConfigs.filter(c => c.type === 'date').length,
            time: columnConfigs.filter(c => c.type === 'time').length,
            textarea: columnConfigs.filter(c => c.type === 'textarea').length,
            currency: columnConfigs.filter(c => c.type === 'currency').length
          }
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ COLUMN SETTINGS ERROR:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      {
        error: 'Failed to fetch column settings',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}