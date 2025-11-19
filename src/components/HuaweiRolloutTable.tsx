'use client'

import React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  ColumnSizingState,
  ColumnPinningState,
} from '@tanstack/react-table'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Check, X, Edit2, XCircle, ChevronLeft, ChevronRight, Filter, Calendar, Download, Database, Search, RefreshCcw } from 'lucide-react'
import { SiteDetailModal } from './SiteDetailModal'

interface ColumnConfig {
  name: string
  type: 'string' | 'date' | 'time' | 'textarea' | 'currency' | 'list'
  show: boolean
  editable: boolean
  displayName: string
}

interface SimpleDataTableProps {
  data: Record<string, any>[]
  onUpdateData?: (rowId: string, columnId: string, value: any, oldValue: any) => Promise<void>
  rowIdColumn?: string
  onFilteredDataChange?: (filteredData: Record<string, any>[]) => void
  onExport?: () => void
  exporting?: boolean
  loading?: boolean
  error?: string | null
  selectedSheet?: string
  onExportDataReady?: (exportData: {
    columns: { name: string; displayName: string }[],
    poStatusMap: Record<string, any>,
    includePOStatus?: boolean
  }) => void
  onRefresh?: () => void
  refreshing?: boolean
  onImport?: () => void
  importedCells?: Set<string> // Set of "duid-columnId" for highlighting imported cells
}

interface EditingState {
  rowId: string
  columnId: string
  value: any
  oldValue: any
}

interface DateFilter {
  startDate: string
  endDate: string
}

interface FilterDropdownPosition {
  top: number
  left: number
}

interface DateRangeFilterValue {
  preset: string
  startDate: string
  endDate: string
}

export function HuaweiRolloutTable({ 
  data, 
  onUpdateData, 
  rowIdColumn = 'DUID',
  onFilteredDataChange,
  onExport,
  exporting = false,
  loading = false,
  error = null,
  onImport,
  selectedSheet = '',
  onExportDataReady,
  onRefresh,
  refreshing = false,
  importedCells = new Set()
}: SimpleDataTableProps) {
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([])
  const [editingCell, setEditingCell] = useState<EditingState | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Map<string, EditingState>>(new Map())
  const [changedCells, setChangedCells] = useState<Map<string, { oldValue: any; newValue: any }>>(new Map())
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ 
    left: ['DUID'], 
    right: ['PO_Status'] 
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  
  // PO data state - now indexed by DUID for O(1) lookup
  const [poStatusMap, setPoStatusMap] = useState<Record<string, any>>({})
  const [poLoading, setPoLoading] = useState(false)
  const [poColumnVisible, setPoColumnVisible] = useState(false)
  const [showPOStatus, setShowPOStatus] = useState(false)
  
  // Import Excel states
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState<{ updated: number; skipped: number } | null>(null)
  const [backupData, setBackupData] = useState<Record<string, any>[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localExporting, setLocalExporting] = useState(false)

  // Helper: resolve value for a column from a row with robust matching
  const resolveRowValue = (row: Record<string, any>, config: ColumnConfig) => {
    if (!row || !config) return ''
    let value = row[config.name]
    if (value === undefined || value === null) {
      value = row[config.displayName]
    }
    if ((value === undefined || value === null) && config) {
      const matchingKey = Object.keys(row).find(
        key => key.toLowerCase() === config.name.toLowerCase() ||
               key.toLowerCase() === config.displayName.toLowerCase()
      )
      if (matchingKey) value = row[matchingKey]
    }
    if ((value === undefined || value === null) && config) {
      const matchingKey = Object.keys(row).find(
        key => key.replace(/\s+/g, '') === config.name.replace(/\s+/g, '') ||
               key.replace(/\s+/g, '') === config.displayName.replace(/\s+/g, '')
      )
      if (matchingKey) value = row[matchingKey]
    }
    if ((value === undefined || value === null) && config) {
      const matchingKey = Object.keys(row).find(
        key => key.trim() === config.name.trim() ||
               key.trim() === config.displayName.trim()
      )
      if (matchingKey) value = row[matchingKey]
    }
    return value === undefined || value === null ? '' : value
  }

  // Export filtered data to Excel (using local data, no server fetch)
  const handleExport = async () => {
    setLocalExporting(true)
    try {
      // Get filtered data from table (includes all filters: date, column, global search)
      const filteredRows = table.getFilteredRowModel().rows.map(row => row.original)
      
      if (filteredRows.length === 0) {
        alert('No data to export. Please adjust filters or date range.')
        setLocalExporting(false)
        return
      }

      // Get visible columns (excluding hidden ones) and ensure they exist in the data
      const dataKeysMap = new Map<string, string>()
      if (data && data.length > 0) {
        Object.keys(data[0]).forEach(key => {
          dataKeysMap.set(key, key)
          dataKeysMap.set(key.toLowerCase(), key)
          dataKeysMap.set(key.replace(/\s+/g, ''), key)
          dataKeysMap.set(key.replace(/\s+/g, '').toLowerCase(), key)
          dataKeysMap.set(key.trim(), key)
        })
      }
      const visibleColumns = columnConfigs.filter(config => config.show && columnVisibility[config.name] !== false && (
        dataKeysMap.has(config.name) || dataKeysMap.has(config.displayName) || dataKeysMap.has(config.name.toLowerCase()) || dataKeysMap.has(config.displayName.toLowerCase()) || dataKeysMap.has(config.name.replace(/\s+/g, ''))
      ))
      
      // Add PO_Status if visible
      const includePOStatus = showPOStatus && columnVisibility['PO_Status'] !== false

      // Dynamically import XLSX
      const XLSX = await import('xlsx')
      
      // Create worksheet data with proper headers and values
      const headers = [
        ...visibleColumns.map(config => config.displayName),
        ...(includePOStatus ? ['PO Status'] : [])
      ]
      
      const dataRows = filteredRows.map(row => {
        const rowData = visibleColumns.map(config => {
          const value = resolveRowValue(row, config)
          return value === null || value === undefined ? '' : value
        })
        
        // Add PO Status if visible
        if (includePOStatus) {
          const duid = row['DUID'] || row['duid']
          const poKey = Object.keys(poStatusMap).find(k => k.toLowerCase() === (duid || '').toString().toLowerCase())
          const status = poKey ? poStatusMap[poKey] : null
          rowData.push(status?.display || 'No PO')
        }
        
        return rowData
      })
      
      const wsData = [headers, ...dataRows]

      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Huawei Rollout')

      // Generate filename with timestamp and sheet name
      const timestamp = new Date().toISOString().split('T')[0]
      const sheetName = selectedSheet || 'Data'
      const filename = `${sheetName}_Filtered_${timestamp}.xlsx`

      // Download file
      XLSX.writeFile(wb, filename)
      
      // debug logs removed
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export data: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setLocalExporting(false)
    }
  }
  
  // Refs for virtualization
  const tableContainerRef = useRef<HTMLDivElement>(null)
  
  // Date range filter state
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    const today = new Date()
    const oneMonthAgo = new Date(today)
    oneMonthAgo.setMonth(today.getMonth() - 1)
    return {
      startDate: oneMonthAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    }
  })
  
  // Filter dropdown states
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null)
  const [filterDropdownPosition, setFilterDropdownPosition] = useState<FilterDropdownPosition | null>(null)
  const [filterSearchQuery, setFilterSearchQuery] = useState('')
  const filterDropdownRef = useRef<HTMLDivElement>(null)
  
  // Site detail modal state
  const [siteDetailModalOpen, setSiteDetailModalOpen] = useState(false)
  const [selectedSite, setSelectedSite] = useState<{ duid: string; duName: string } | null>(null)

  // Callback functions for editing
  const handleCellEdit = useCallback((row: any, columnId: string, currentValue: any) => {
    const rowId = row[rowIdColumn]?.toString()
    if (!rowId) return
    
    // Convert date display format (DD-MMM-YYYY) to input format (YYYY-MM-DD)
    let inputValue = currentValue
    const columnConfig = columnConfigs.find(c => c.name === columnId)
    
    if (columnConfig?.type === 'date' && currentValue) {
      // Parse DD/MM/YYYY or DD-MMM-YYYY to YYYY-MM-DD
      if (typeof currentValue === 'string') {
        const parts = currentValue.split(/[\/\-]/)
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10)
          const monthStr = parts[1]
          let month = parseInt(monthStr, 10)
          
          // Check if month is text (like 'Nov')
          if (isNaN(month)) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            month = monthNames.findIndex(m => m === monthStr) + 1
          }
          
          const year = parseInt(parts[2], 10)
          
          if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            // Convert to YYYY-MM-DD format for input type="date"
            inputValue = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
          }
        }
      }
    }
    
    setEditingCell({ rowId, columnId, value: inputValue, oldValue: currentValue })
  }, [rowIdColumn, columnConfigs])

  const handleCellSave = useCallback(() => {
    if (!editingCell) return

    const { rowId, columnId, value, oldValue } = editingCell

    // Skip if no change
    if (value === oldValue) {
      setEditingCell(null)
      return
    }

    const changeKey = `${rowId}-${columnId}`
    const columnConfig = columnConfigs.find(c => c.name === columnId)
    
    // Convert date value from YYYY-MM-DD to DD/MM/YYYY for storage
    let savedValue = value
    if (columnConfig?.type === 'date' && value) {
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Convert YYYY-MM-DD to DD/MM/YYYY
        const [year, month, day] = value.split('-')
        savedValue = `${day}/${month}/${year}`
      }
    }
    
    // Update changed cells for visual indicator
    const newChangedCells = new Map(changedCells)
    newChangedCells.set(changeKey, { oldValue, newValue: savedValue })
    setChangedCells(newChangedCells)

    // Update pending changes for batch save with converted date format
    const newChanges = new Map(pendingChanges)
    newChanges.set(changeKey, { ...editingCell, value: savedValue })
    setPendingChanges(newChanges)
    
    setEditingCell(null)
  }, [editingCell, pendingChanges, changedCells, columnConfigs])

  const handleCellCancel = useCallback(() => {
    setEditingCell(null)
  }, [])

  const handleCancelAll = useCallback(() => {
    setPendingChanges(new Map())
    setChangedCells(new Map())
    setEditingCell(null)
  }, [])

  // Auto-save on click outside editing cell
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingCell) {
        const target = event.target as HTMLElement
        const isInsideEditingCell = target.closest('[data-editing-cell]')
        
        if (!isInsideEditingCell) {
          // Use setTimeout to avoid blocking the UI
          setTimeout(() => handleCellSave(), 0)
        }
      }
    }

    if (editingCell) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editingCell, handleCellSave])

  // Fetch PO status data only when manually triggered
  useEffect(() => {
    if (!showPOStatus || !poColumnVisible) return

    const fetchPOStatus = async () => {
      setPoLoading(true)
      try {
        // Extract unique DUIDs from current table data
        const uniqueDuids = Array.from(new Set(
          data
            .map(row => row['DUID'] || row['duid'])
            .filter(Boolean)
            .map(duid => duid.toString().trim())
        ))
        
        // debug logs removed
        
        // Send DUIDs to API for filtered PO fetch
        const response = await fetch('/api/sheets/po-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duids: uniqueDuids })
        })
        
        if (!response.ok) throw new Error('Failed to fetch PO status')
        
        const result = await response.json()
        
        // Only store PO data for DUIDs that exist in table
        setPoStatusMap(result.data || {})
        
        // debug logs removed
        
        // Log orphans if any (PO exists but not in table)
        if (result.orphans && Object.keys(result.orphans).length > 0) {
          // debug logs removed
        }
      } catch (error) {
        console.error('Failed to load PO status:', error)
      } finally {
        setPoLoading(false)
      }
    }

    fetchPOStatus()
  }, [showPOStatus, poColumnVisible, data])

  // Fetch column configuration
  useEffect(() => {
    const fetchColumnConfig = async () => {
      try {
        // Convert page path to API path
        const pagePath = window.location.pathname // e.g., /itc-huawei
        const apiPath = `/api/sheets${pagePath}/settings` // e.g., /api/sheets/itc-huawei/settings

        const response = await fetch(apiPath)
        if (!response.ok) throw new Error('Failed to fetch column configuration')

        const result = await response.json()
        const configs: ColumnConfig[] = result.data?.columns || []

        setColumnConfigs(configs)

        // Set initial visibility based on config
        const initialVisibility: Record<string, boolean> = {}
        configs.forEach(config => {
          initialVisibility[config.name] = config.show
        })
        // PO_Status column hidden by default (manual load required)
        initialVisibility['PO_Status'] = false
        setColumnVisibility(initialVisibility)
        
        // Don't trigger PO data fetch by default
        setPoColumnVisible(false)

      } catch (error) {
        console.error('Failed to load column configuration:', error)
      }
    }

    fetchColumnConfig()
  }, [])

  // Get PO status from pre-calculated map (O(1) lookup)
  const getPOStatus = useCallback((duid: string) => {
    if (!duid || !poStatusMap || Object.keys(poStatusMap).length === 0) {
      return null
    }
    
    // Try exact match first
    const exactMatch = poStatusMap[duid.toString().trim()]
    if (exactMatch) return exactMatch
    
    // Try case-insensitive match
    const normalizedDuid = duid.toString().trim().toLowerCase()
    for (const [key, value] of Object.entries(poStatusMap)) {
      if (key.toLowerCase() === normalizedDuid) {
        return value
      }
    }
    
    return null
  }, [poStatusMap])

  // Get status badge styling
  const getStatusBadge = useCallback((status: string) => {
    const statusLower = status.toLowerCase().trim()
    
    // Closed - Green
    if (statusLower.includes('close') || statusLower === 'closed') {
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        border: 'border-green-200',
        icon: '✓'
      }
    }
    
    // In Progress - Blue
    if (statusLower.includes('progress') || statusLower.includes('in progress')) {
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        border: 'border-blue-200',
        icon: '⟳'
      }
    }
    
    // Cancel - Red
    if (statusLower.includes('cancel')) {
      return {
        bg: 'bg-red-100',
        text: 'text-red-800',
        border: 'border-red-200',
        icon: '✕'
      }
    }
    
    // Not Start - Gray
    if (statusLower.includes('not start') || statusLower.includes('not started')) {
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-200',
        icon: '○'
      }
    }
    
    // Default - Neutral
    return {
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      border: 'border-gray-300',
      icon: '•'
    }
  }, [])

  // Create table columns
  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (columnConfigs.length === 0) return []
    if (data.length === 0) return []

    // Get all column names from data with multiple normalization strategies
    const dataColumns = new Map<string, string>() // normalized -> original
    if (data.length > 0) {
      // Check first row to get all column names
      Object.keys(data[0]).forEach(key => {
        // Store original key
        dataColumns.set(key, key)
        
        // Store normalized versions for matching
        dataColumns.set(key.toLowerCase(), key)
        dataColumns.set(key.trim(), key)
        dataColumns.set(key.replace(/\s+/g, ''), key) // Remove all spaces
        dataColumns.set(key.replace(/\s+/g, '').toLowerCase(), key)
      })
    }

    // Filter columns based on two conditions:
    // 1. Column must be marked as show=true in settings
    // 2. Column must exist in the actual data from Google Sheets
    const hiddenBySettings: string[] = []
    const notInData: string[] = []
    const displayedColumns: string[] = []
    
    const filtered = columnConfigs.filter(config => {
        // Condition 1: Must be allowed to show in settings
        if (!config.show) {
          hiddenBySettings.push(config.displayName)
          return false
        }
        
        // Condition 2: Column must exist in data
        // Try multiple matching strategies
        const columnExists = dataColumns.has(config.name) ||
                            dataColumns.has(config.displayName) || // Try display name (with spaces)
                            dataColumns.has(config.name.toLowerCase()) ||
                            dataColumns.has(config.displayName.toLowerCase()) ||
                            dataColumns.has(config.name.trim()) ||
                            dataColumns.has(config.displayName.trim()) ||
                            dataColumns.has(config.name.replace(/\s+/g, '')) ||
                            dataColumns.has(config.displayName.replace(/\s+/g, ''))
        
        if (!columnExists) {
          notInData.push(`${config.displayName} (looking for: ${config.name})`)
          return false
        }
        
        displayedColumns.push(config.displayName)
        return true
      })
    
    // Add PO Status column after all configured columns
    const columnsWithPOStatus = [
      ...filtered.map((config): ColumnDef<any> => {
        // Special handling for DUID column - make it clickable
        const isDUIDColumn = config.name === 'DUID' || config.displayName === 'DUID'
        
        return ({
          id: config.name,
          accessorFn: (row) => {
          // Try multiple matching strategies to find the column value
          let value = row[config.name]
          
          // Try display name (with spaces)
          if (value === undefined || value === null) {
            value = row[config.displayName]
          }
          
          // Try case-insensitive match
          if (value === undefined || value === null) {
            const matchingKey = Object.keys(row).find(
              key => key.toLowerCase() === config.name.toLowerCase() ||
                     key.toLowerCase() === config.displayName.toLowerCase()
            )
            if (matchingKey) {
              value = row[matchingKey]
            }
          }
          
          // Try without spaces
          if (value === undefined || value === null) {
            const matchingKey = Object.keys(row).find(
              key => key.replace(/\s+/g, '') === config.name.replace(/\s+/g, '') ||
                     key.replace(/\s+/g, '') === config.displayName.replace(/\s+/g, '')
            )
            if (matchingKey) {
              value = row[matchingKey]
            }
          }
          
          // Try trimmed match
          if (value === undefined || value === null) {
            const matchingKey = Object.keys(row).find(
              key => key.trim() === config.name.trim() ||
                     key.trim() === config.displayName.trim()
            )
            if (matchingKey) {
              value = row[matchingKey]
            }
          }
          
          return value
        },
        header: config.displayName,
        enableResizing: true,
        enableSorting: true,
        filterFn: (row, columnId, filterValue) => {
          const cellValue = row.getValue(columnId)
          
          // Handle empty/not empty filters
          if (filterValue === 'FILTER_EMPTY') {
            return !cellValue || cellValue === ''
          }
          if (filterValue === 'FILTER_NOT_EMPTY') {
            return !!(cellValue && cellValue !== '')
          }
          
          // Handle multi-select array
          if (Array.isArray(filterValue)) {
            if (filterValue.length === 0) return true
            const cellStr = cellValue?.toString() || ''
            return filterValue.some((val: string) => cellStr === val)
          }

          // Handle date range object { preset, startDate, endDate }
          if (filterValue && typeof filterValue === 'object' && 'startDate' in filterValue && 'endDate' in filterValue) {
            const { startDate, endDate } = filterValue as DateRangeFilterValue
            if (!cellValue) return false

            // Parse date from DD/MM/YYYY or DD-MM-YYYY format
            let parsed: Date | null = null
            if (typeof cellValue === 'string') {
              const parts = cellValue.split(/[\/\-]/)
              if (parts.length === 3) {
                const day = parseInt(parts[0], 10)
                const month = parseInt(parts[1], 10) - 1
                const year = parseInt(parts[2], 10)
                parsed = new Date(year, month, day)
              }
            } else if (cellValue instanceof Date) {
              parsed = cellValue
            } else if (typeof cellValue === 'number') {
              parsed = new Date(cellValue)
            }
            if (!parsed || isNaN(parsed.getTime())) return false
            const start = new Date(startDate)
            const end = new Date(endDate)
            const p = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()
            return p >= new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() &&
                   p <= new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
          }
          
          // Default string contains
          const cellStr = cellValue?.toString().toLowerCase() || ''
          const filterStr = filterValue?.toString().toLowerCase() || ''
          return cellStr.includes(filterStr)
        },
        cell: ({ row, getValue }) => {
          let cellValue = getValue() as any
          const rowId = row.original[rowIdColumn]
          const columnId = config.name
          const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId
          const changeKey = `${rowId}-${columnId}`
          const hasChanges = changedCells.has(changeKey)
          
          // Check imported with multiple key formats (with/without spaces)
          const isImported = importedCells.has(changeKey) || 
                            importedCells.has(`${rowId}-${config.displayName}`) ||
                            importedCells.has(`${rowId}-${columnId.replace(/\s+/g, '')})`)
          
          // Fallback: try to get value if getValue() returns empty but data exists
          if (!cellValue && cellValue !== 0) {
            // Try exact match with config.name
            cellValue = row.original[config.name]
            
            // Try display name (with spaces)
            if (!cellValue && cellValue !== 0) {
              cellValue = row.original[config.displayName]
            }
            
            // Try case-insensitive match
            if (!cellValue && cellValue !== 0) {
              const matchingKey = Object.keys(row.original).find(
                key => key.toLowerCase() === config.name.toLowerCase() ||
                       key.toLowerCase() === config.displayName.toLowerCase()
              )
              if (matchingKey) {
                cellValue = row.original[matchingKey]
              }
            }
            
            // Try without spaces
            if (!cellValue && cellValue !== 0) {
              const matchingKey = Object.keys(row.original).find(
                key => key.replace(/\s+/g, '') === config.name.replace(/\s+/g, '') ||
                       key.replace(/\s+/g, '') === config.displayName.replace(/\s+/g, '')
              )
              if (matchingKey) {
                cellValue = row.original[matchingKey]
              }
            }
            
            // Try trimmed match
            if (!cellValue && cellValue !== 0) {
              const matchingKey = Object.keys(row.original).find(
                key => key.trim() === config.name.trim() ||
                       key.trim() === config.displayName.trim()
              )
              if (matchingKey) {
                cellValue = row.original[matchingKey]
              }
            }
          }
          
          // Use new value if changed, otherwise use original (after fallback)
          const displayValue = hasChanges ? changedCells.get(changeKey)?.newValue : cellValue

          // Date display with format dd-MMM-yyyy
          if (config.type === 'date' && displayValue) {
            let dateValue: Date | null = null
            
            if (typeof displayValue === 'string') {
              // Handle DD/MM/YYYY or DD-MM-YYYY format
              const parts = displayValue.split(/[\/\-]/)
              if (parts.length === 3) {
                const day = parseInt(parts[0], 10)
                const month = parseInt(parts[1], 10) - 1
                const year = parseInt(parts[2], 10)
                dateValue = new Date(year, month, day)
              }
            } else {
              dateValue = new Date(displayValue)
            }
            
            if (dateValue && !isNaN(dateValue.getTime())) {
              const day = dateValue.getDate().toString().padStart(2, '0')
              const month = dateValue.toLocaleDateString('en-US', { month: 'short' })
              const year = dateValue.getFullYear()
              
              const cellClasses = `flex items-center gap-1 text-xs px-1 py-0.5 rounded ${
                hasChanges 
                  ? 'bg-orange-50 border border-orange-200' 
                  : isImported
                  ? 'bg-emerald-50 border border-emerald-200'
                  : ''
              }`
              
              return (
                <div className={cellClasses}>
                  {hasChanges && <div className="w-1 h-1 bg-orange-500 rounded-full" />}
                  {!hasChanges && isImported && <div className="w-1 h-1 bg-emerald-500 rounded-full" />}
                  <span className={hasChanges ? 'text-orange-700 font-medium' : isImported ? 'text-emerald-700 font-medium' : ''}>
                    {`${day}-${month}-${year}`}
                  </span>
                </div>
              )
            }
          }

          // DUID column - clickable to open detail modal
          if (isDUIDColumn && !isEditing) {
            return (
              <button
                onClick={() => {
                  const duName = row.original['DU Name'] || row.original['DUName'] || ''
                  setSelectedSite({ duid: displayValue?.toString() || '', duName })
                  setSiteDetailModalOpen(true)
                }}
                className="group flex items-center gap-2 px-2 py-1 rounded hover:bg-blue-50 transition-colors text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                title="Click to view site details"
              >
                <span className="underline decoration-dotted">{displayValue?.toString() || ''}</span>
                <svg className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            )
          }
          
          // Editable cell
          if (config.editable && !isEditing) {
            const cellClasses = `group flex items-center justify-between px-1 py-0.5 rounded transition-colors text-xs ${
              hasChanges 
                ? 'bg-orange-50 border border-orange-200 hover:bg-orange-100' 
                : isImported
                ? 'bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
                : 'hover:bg-gray-50'
            }`
            
            return (
              <div 
                className={cellClasses}
                onDoubleClick={() => handleCellEdit(row.original, columnId, displayValue)}
                title={hasChanges ? "Modified - not saved yet. Double-click to edit." : isImported ? "Just imported from Excel" : "Double-click to edit"}
              >
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  {hasChanges && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0" />}
                  {!hasChanges && isImported && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />}
                  <span className={hasChanges ? 'text-orange-700 font-medium' : isImported ? 'text-emerald-700 font-medium' : ''}>
                    {displayValue?.toString() || ''}
                  </span>
                </div>
                <Edit2 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            )
          }

          // Editing state
          if (isEditing) {
            return (
              <div className="w-full h-full" data-editing-cell style={{ padding: 0, margin: 0 }}>
                {config.type === 'textarea' ? (
                  <textarea
                    autoFocus
                    value={editingCell.value || ''}
                    onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') handleCellCancel()
                      if (e.key === 'Enter' && e.ctrlKey) handleCellSave()
                    }}
                    className="w-full h-full px-2 py-1.5 border-2 border-blue-500 text-xs focus:outline-none focus:border-blue-600 bg-white"
                    style={{ margin: 0, borderRadius: 0, minHeight: '100%' }}
                    rows={3}
                  />
                ) : (
                  <input
                    autoFocus
                    type={config.type === 'date' ? 'date' : 'text'}
                    value={editingCell.value || ''}
                    onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCellSave()
                      if (e.key === 'Escape') handleCellCancel()
                    }}
                    className="w-full h-full px-2 py-1.5 border-2 border-blue-500 text-xs focus:outline-none focus:border-blue-600 bg-white"
                    style={{ margin: 0, borderRadius: 0 }}
                  />
                )}
              </div>
            )
          }

          // Default non-editable cell with DUID check
          if (isDUIDColumn) {
            return (
              <button
                onClick={() => {
                  const duName = row.original['DU Name'] || row.original['DUName'] || ''
                  setSelectedSite({ duid: displayValue?.toString() || '', duName })
                  setSiteDetailModalOpen(true)
                }}
                className="group flex items-center gap-2 px-2 py-1 rounded hover:bg-blue-50 transition-colors text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                title="Click to view site details"
              >
                <span className="underline decoration-dotted">{displayValue?.toString() || ''}</span>
                <svg className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            )
          }
          
          // Status badge rendering for Site Status or similar columns
          const columnNameLower = config.name.toLowerCase()
          const displayNameLower = config.displayName.toLowerCase()
          const isSiteStatusColumn = columnNameLower.includes('status') || displayNameLower.includes('status')
          
          // Apply badge to status columns (but not for PO_Status which is handled separately)
          if (isSiteStatusColumn && displayValue && displayValue.toString().trim() && config.name !== 'PO_Status') {
            const badge = getStatusBadge(displayValue.toString())
            const cellClasses = `flex items-center gap-1 px-1 py-0.5 rounded ${
              hasChanges 
                ? 'bg-orange-50 border border-orange-200' 
                : isImported
                ? 'bg-emerald-50 border border-emerald-200'
                : ''
            }`
            return (
              <div className={cellClasses}>
                {hasChanges && <div className="w-1 h-1 bg-orange-500 rounded-full" />}
                {!hasChanges && isImported && <div className="w-1 h-1 bg-emerald-500 rounded-full" />}
                <span 
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}
                >
                  <span className="text-[10px]">{badge.icon}</span>
                  <span>{displayValue.toString()}</span>
                </span>
              </div>
            )
          }
          
          // Default cell rendering
          const defaultCellClasses = `flex items-center gap-1 text-xs px-1 py-0.5 rounded ${
            hasChanges 
              ? 'bg-orange-50 border border-orange-200' 
              : isImported
              ? 'bg-emerald-50 border border-emerald-200'
              : ''
          }`
          
          return (
            <div className={defaultCellClasses}>
              {hasChanges && <div className="w-1 h-1 bg-orange-500 rounded-full" />}
              {!hasChanges && isImported && <div className="w-1 h-1 bg-emerald-500 rounded-full" />}
              <span className={hasChanges ? 'text-orange-700 font-medium' : isImported ? 'text-emerald-700 font-medium' : ''}>
                {displayValue?.toString() || ''}
              </span>
            </div>
          )
        },
      })
    }),
    // Add PO Status column
    {
      id: 'PO_Status',
      header: 'PO Status',
      accessorFn: (row: any) => {
        const duid = row['DUID'] || row['duid']
        if (!duid) return null
        const status = getPOStatus(duid)
        // Return percentage as string for filtering (e.g., "75%")
        return status?.percentage !== undefined ? `${status.percentage}%` : null
      },
      enableResizing: true,
      enableSorting: true,
      sortingFn: (rowA: any, rowB: any, columnId: string) => {
        const a = rowA.getValue(columnId) as string | null
        const b = rowB.getValue(columnId) as string | null
        if (!a) return 1
        if (!b) return -1
        const aNum = parseInt(a.replace('%', ''))
        const bNum = parseInt(b.replace('%', ''))
        return aNum - bNum
      },
      cell: ({ row }: { row: any }) => {
        const duid = row.original['DUID'] || row.original['duid']
        if (!duid) return <span className="text-xs text-gray-400">-</span>
        
        if (!showPOStatus) {
          return <span className="text-xs text-gray-400">-</span>
        }
        
        if (poLoading) {
          return (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <div className="animate-spin h-3 w-3 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
              <span>Loading...</span>
            </div>
          )
        }
        
        const status = getPOStatus(duid)
        
        if (!status || !status.totalLines) {
          return <span className="text-xs text-gray-400">No PO</span>
        }
        
        // Use pre-calculated percentage from API (based on average Remaining)
        const percentage = status.percentage || 0
        const isComplete = percentage === 100
        const isPartial = percentage > 0 && percentage < 100
        const isEmpty = percentage === 0
        
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-[80px] max-w-[120px]">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    isComplete ? 'bg-green-500' : 
                    isPartial ? 'bg-blue-500' : 
                    'bg-gray-400'
                  }`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
            <span 
              className={`text-xs font-semibold min-w-[35px] text-right ${
                isComplete ? 'text-green-600' : 
                isPartial ? 'text-blue-600' : 
                'text-gray-600'
              }`}
              title={`Average completion from ${status.totalLines} PO lines`}
            >
              {percentage}%
            </span>
          </div>
        )
      },
    }
  ]
  
    return columnsWithPOStatus
  }, [columnConfigs, editingCell, pendingChanges, changedCells, rowIdColumn, handleCellEdit, handleCellSave, handleCellCancel, data, getPOStatus, poLoading])

  // Filter data by date range
  const filteredData = useMemo(() => {
    if (!dateFilter.startDate || !dateFilter.endDate) return data
    
    const startDate = new Date(dateFilter.startDate)
    const endDate = new Date(dateFilter.endDate)
    
    return data.filter(row => {
      const dateColumns = columnConfigs.filter(config => config.type === 'date')
      if (dateColumns.length === 0) return true
      
      return dateColumns.some(config => {
        const cellValue = row[config.name]
        if (!cellValue) return false
        
        let rowDate: Date | null = null
        if (typeof cellValue === 'string') {
          const parts = cellValue.split(/[\/\-]/)
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10)
            const month = parseInt(parts[1], 10) - 1
            const year = parseInt(parts[2], 10)
            rowDate = new Date(year, month, day)
          }
        } else {
          rowDate = new Date(cellValue)
        }
        
        if (!rowDate || isNaN(rowDate.getTime())) return false
        return rowDate >= startDate && rowDate <= endDate
      })
    })
  }, [data, dateFilter, columnConfigs])

  // Custom global filter function for multi-term search (comma, newline, whitespace separated)
  const globalFilterFn = useCallback((row: any, columnId: string, filterValue: string) => {
    if (!filterValue) return true
    
    // Split by comma, newline, and whitespace - then filter empty strings
    const searchTerms = filterValue
      .split(/[,\n\r\s]+/)
      .map(term => term.trim().toLowerCase())
      .filter(term => term.length > 0)
    
    if (searchTerms.length === 0) return true
    
    // Check if ANY search term matches ANY value in the row
    return searchTerms.some(term => {
      return Object.values(row.original).some(value => {
        if (value === null || value === undefined) return false
        return String(value).toLowerCase().includes(term)
      })
    })
  }, [])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      columnPinning,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: setColumnPinning,
    columnResizeMode: 'onChange',
    globalFilterFn: globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  })

  // Notify parent of filtered data changes (including all filters: date, column, and global search)
  useEffect(() => {
    if (onFilteredDataChange) {
      // Get the FINAL filtered rows after ALL filters are applied (date + column + search)
      const allFilteredRows = table.getFilteredRowModel().rows.map(row => row.original)
      
      onFilteredDataChange(allFilteredRows)
    }
  }, [table, columnFilters, globalFilter, sorting, filteredData.length, onFilteredDataChange])

  // Send export-ready data to parent (visible columns + PO status map)
  useEffect(() => {
    if (onExportDataReady && columnConfigs.length > 0) {
      // Use both config.show and columnVisibility state (table's current state)
      // Also ensure the column exists in the data to prevent exporting empty columns
      const dataKeysMap = new Map<string, string>()
      if (data && data.length > 0) {
        Object.keys(data[0]).forEach(key => {
          dataKeysMap.set(key, key)
          dataKeysMap.set(key.toLowerCase(), key)
          dataKeysMap.set(key.replace(/\s+/g, ''), key)
          dataKeysMap.set(key.replace(/\s+/g, '').toLowerCase(), key)
          dataKeysMap.set(key.trim(), key)
        })
      }
      const visibleColumns = columnConfigs
        .filter(config => config.show && columnVisibility[config.name] !== false && (
          dataKeysMap.has(config.name) || dataKeysMap.has(config.displayName) || dataKeysMap.has(config.name.toLowerCase()) || dataKeysMap.has(config.displayName.toLowerCase()) || dataKeysMap.has(config.name.replace(/\s+/g, ''))
        ))
        .map(config => ({
          name: config.name,
          displayName: config.displayName
        }))
      onExportDataReady({
        columns: visibleColumns,
        poStatusMap: poStatusMap,
        includePOStatus: showPOStatus && columnVisibility['PO_Status'] !== false
      })
    }
  }, [columnConfigs, columnVisibility, poStatusMap, onExportDataReady])

  // Get unique values for a column
  const getUniqueColumnValues = (columnId: string) => {
    const values = new Set<string>()
    const config = columnConfigs.find(c => c.name === columnId)
    
    filteredData.forEach(row => {
      let value
      
      // Special handling for PO_Status column (computed from poStatusMap)
      if (columnId === 'PO_Status') {
        const duid = row['DUID'] || row['duid']
        if (duid) {
          const status = getPOStatus(duid)
          if (status?.percentage !== undefined) {
            value = `${status.percentage}%`
          }
        }
      } else {
        // Use same matching strategy as accessorFn for regular columns
        value = row[columnId]
        
        // Try display name (with spaces)
        if ((value === null || value === undefined) && config) {
          value = row[config.displayName]
        }
        
        // Try case-insensitive match
        if ((value === null || value === undefined) && config) {
          const matchingKey = Object.keys(row).find(
            key => key.toLowerCase() === columnId.toLowerCase() ||
                   key.toLowerCase() === config.displayName.toLowerCase()
          )
          if (matchingKey) {
            value = row[matchingKey]
          }
        }
        
        // Try without spaces
        if ((value === null || value === undefined) && config) {
          const matchingKey = Object.keys(row).find(
            key => key.replace(/\s+/g, '') === columnId.replace(/\s+/g, '') ||
                   key.replace(/\s+/g, '') === config.displayName.replace(/\s+/g, '')
          )
          if (matchingKey) {
            value = row[matchingKey]
          }
        }
        
        // Try trimmed match
        if ((value === null || value === undefined) && config) {
          const matchingKey = Object.keys(row).find(
            key => key.trim() === columnId.trim() ||
                   key.trim() === config.displayName.trim()
          )
          if (matchingKey) {
            value = row[matchingKey]
          }
        }
      }
      
      if (value !== null && value !== undefined && value !== '') {
        values.add(value.toString())
      }
    })
    return Array.from(values).sort((a, b) => {
      // Sort percentage values numerically
      if (columnId === 'PO_Status') {
        const aNum = parseInt(a.replace('%', ''))
        const bNum = parseInt(b.replace('%', ''))
        return aNum - bNum
      }
      return a.localeCompare(b)
    })
  }

  // Get current filter value for a column
  const getColumnFilterValue = (columnId: string) => {
    const filter = columnFilters.find(f => f.id === columnId)
    return filter?.value
  }

  // Check if a value is selected in filter
  const isValueSelected = (columnId: string, value: string) => {
    const currentFilter = getColumnFilterValue(columnId)
    if (Array.isArray(currentFilter)) {
      return currentFilter.includes(value)
    }
    return false
  }

  // Get selected count for a column
  const getSelectedCount = (columnId: string) => {
    const current = getColumnFilterValue(columnId)
    if (Array.isArray(current)) return current.length
    if (current && current !== 'FILTER_EMPTY' && current !== 'FILTER_NOT_EMPTY') return 1
    return 0
  }

  // Handle column filtering
  const handleColumnFilter = (columnId: string, action: 'empty' | 'notEmpty' | 'toggleValue', value?: string) => {
    const currentFilters = [...columnFilters]
    const filterIndex = currentFilters.findIndex(f => f.id === columnId)

    if (action === 'empty') {
      if (filterIndex >= 0) {
        currentFilters[filterIndex] = { id: columnId, value: 'FILTER_EMPTY' }
      } else {
        currentFilters.push({ id: columnId, value: 'FILTER_EMPTY' })
      }
      setColumnFilters(currentFilters)
      setActiveFilterColumn(null)
      return
    }

    if (action === 'notEmpty') {
      if (filterIndex >= 0) {
        currentFilters[filterIndex] = { id: columnId, value: 'FILTER_NOT_EMPTY' }
      } else {
        currentFilters.push({ id: columnId, value: 'FILTER_NOT_EMPTY' })
      }
      setColumnFilters(currentFilters)
      setActiveFilterColumn(null)
      return
    }

    if (action === 'toggleValue' && value) {
      let selectedValues: string[] = []
      if (filterIndex >= 0) {
        const currentValue = currentFilters[filterIndex].value
        if (Array.isArray(currentValue)) {
          selectedValues = [...currentValue]
        }
      }

      const valueIndex = selectedValues.indexOf(value)
      if (valueIndex >= 0) {
        selectedValues.splice(valueIndex, 1)
      } else {
        selectedValues.push(value)
      }

      if (selectedValues.length === 0) {
        currentFilters.splice(filterIndex, 1)
      } else if (filterIndex >= 0) {
        currentFilters[filterIndex] = { id: columnId, value: selectedValues }
      } else {
        currentFilters.push({ id: columnId, value: selectedValues })
      }

      setColumnFilters(currentFilters)
    }
  }

  // Date preset filtering
  const handleDatePresetFilter = (columnId: string, preset: string) => {
    const now = new Date()
    let start: Date
    let end: Date

    const startOfWeek = (date: Date) => {
      const d = new Date(date)
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day
      d.setDate(d.getDate() + diff)
      d.setHours(0, 0, 0, 0)
      return d
    }
    const endOfWeek = (date: Date) => {
      const d = startOfWeek(date)
      d.setDate(d.getDate() + 6)
      d.setHours(23, 59, 59, 999)
      return d
    }
    const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
    const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)

    switch (preset) {
      case 'thisweek':
        start = startOfWeek(now)
        end = endOfWeek(now)
        break
      case 'lastweek': {
        const lastWeekRef = new Date(now)
        lastWeekRef.setDate(lastWeekRef.getDate() - 7)
        start = startOfWeek(lastWeekRef)
        end = endOfWeek(lastWeekRef)
        break
      }
      case 'thismonth':
        start = startOfMonth(now)
        end = endOfMonth(now)
        break
      case 'lastmonth': {
        const lastMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 15)
        start = startOfMonth(lastMonthRef)
        end = endOfMonth(lastMonthRef)
        break
      }
      case 'thisyear':
        start = new Date(now.getFullYear(), 0, 1)
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
        break
      default:
        return
    }

    const format = (d: Date) => d.toISOString().split('T')[0]
    const rangeValue: DateRangeFilterValue = { preset, startDate: format(start), endDate: format(end) }

    const existing = columnFilters.findIndex(f => f.id === columnId)
    const nextFilters = [...columnFilters]
    if (existing >= 0) {
      nextFilters[existing] = { id: columnId, value: rangeValue }
    } else {
      nextFilters.push({ id: columnId, value: rangeValue })
    }
    setColumnFilters(nextFilters)
    setActiveFilterColumn(null)
  }

  // Handle filter dropdown toggle
  const handleFilterDropdownToggle = (event: React.MouseEvent, columnId: string) => {
    event.stopPropagation()
    if (activeFilterColumn === columnId) {
      setActiveFilterColumn(null)
      setFilterDropdownPosition(null)
      setFilterSearchQuery('')
    } else {
      const buttonRect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const dropdownWidth = 280 // Width of the dropdown from CSS
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const dropdownHeight = 400 // Approximate max height
      
      // Calculate initial left position (try to align with button)
      let left = buttonRect.left - dropdownWidth + 30
      
      // Ensure dropdown doesn't go off the left edge (with 16px margin for sidebar)
      if (left < 16) {
        left = Math.max(16, buttonRect.left)
      }
      
      // Ensure dropdown doesn't go off the right edge
      if (left + dropdownWidth > viewportWidth - 16) {
        left = viewportWidth - dropdownWidth - 16
      }
      
      // Calculate top position
      let top = buttonRect.bottom + 5
      
      // If dropdown would go off bottom, position it above the button
      if (top + dropdownHeight > viewportHeight - 16) {
        top = buttonRect.top - dropdownHeight - 5
        // If still off screen, position at bottom with scroll
        if (top < 16) {
          top = viewportHeight - dropdownHeight - 16
        }
      }
      
      setFilterDropdownPosition({
        top,
        left,
      })
      setActiveFilterColumn(columnId)
      setFilterSearchQuery('')
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setActiveFilterColumn(null)
        setFilterDropdownPosition(null)
        setFilterSearchQuery('')
      }
    }

    if (activeFilterColumn) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [activeFilterColumn])

  const handleBatchSave = async () => {
    if (pendingChanges.size === 0) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const startTime = performance.now()
      const changes = Array.from(pendingChanges.values())

      // Parallel updates
      const updatePromises = changes.map(change =>
        onUpdateData?.(change.rowId, change.columnId, change.value, change.oldValue)
      )

      await Promise.all(updatePromises)

      const endTime = performance.now()

      setPendingChanges(new Map())
      setChangedCells(new Map())
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClearAllFilters = () => {
    // Clear column filters
    setColumnFilters([])
    
    // Clear global search
    setGlobalFilter('')
    
    // Clear active filter dropdown
    setActiveFilterColumn(null)
    setFilterDropdownPosition(null)
  }

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportSuccess(null)

    try {
      // Dynamically import XLSX
      const XLSX = await import('xlsx')
      
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result
          const workbook = XLSX.read(arrayBuffer, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const importedData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) as Record<string, any>[]

          if (importedData.length === 0) {
            alert('Excel file is empty')
            setImporting(false)
            return
          }

          // Backup current data before update
          setBackupData([...data])

          console.log('📋 Excel file loaded:')
          console.log(`  - Total rows: ${importedData.length}`)
          console.log(`  - First row keys: ${Object.keys(importedData[0] || {}).join(', ')}`)
          console.log(`  - Editable columns from settings: ${columnConfigs.filter(c => c.editable).map(c => `${c.displayName} (${c.name})`).join(', ')}`)

          // Log first 5 DUIDs from Google Sheets for reference
          console.log('🔍 First 5 DUIDs in current data:')
          data.slice(0, 5).forEach((row, idx) => {
            const duid = row[rowIdColumn]?.toString()
            console.log(`  ${idx + 1}. ${duid}`)
          })

          // Create DUID lookup map from current data with multiple normalization strategies
          // Map structure: normalized key -> { row, originalDuid }
          const dataMap = new Map<string, { row: any; originalDuid: string }>()
          data.forEach((row, idx) => {
            const originalDuid = row[rowIdColumn]?.toString()
            if (originalDuid) {
              const duidTrimmed = originalDuid.trim()
              const rowData = { row, originalDuid: duidTrimmed }
              
              // Store with multiple keys for flexible matching
              dataMap.set(duidTrimmed, rowData)
              dataMap.set(duidTrimmed.toUpperCase(), rowData)
              dataMap.set(duidTrimmed.replace(/\s+/g, ''), rowData)
              dataMap.set(duidTrimmed.replace(/\s+/g, '').toUpperCase(), rowData)
              
              // Log first few for debugging
              if (idx < 3) {
                // debug logs removed
              }
            }
          })
          
          // debug logs removed
          // debug logs removed
          
          let updatedCount = 0
          let skippedCount = 0
          // Group updates by row: Map<duid, { columns: Map<columnId, {value, oldValue}> }>
          const rowUpdates = new Map<string, Map<string, { value: any; oldValue: any }>>()

          // Process each row from Excel
          
          for (let i = 0; i < importedData.length; i++) {
            const excelRow = importedData[i]
            const duidRaw = excelRow[rowIdColumn]?.toString()
            
            if (!duidRaw) {
              skippedCount++
              continue
            }

            const duid = duidRaw.trim()
            
            // Log every row attempt for debugging
            if (i < 5 || duid.includes('NUS-NB-PYA-0432')) {
              // debug logs removed
              // debug logs removed
              // debug logs removed
              // debug logs removed
            }
            
            // Try multiple matching strategies to find existing row
            let matchedData = dataMap.get(duid) || 
                             dataMap.get(duid.toUpperCase()) ||
                             dataMap.get(duid.replace(/\s+/g, '')) ||
                             dataMap.get(duid.replace(/\s+/g, '').toUpperCase())
            
            if (!matchedData) {
              console.error(`❌ Row ${i + 1}: DUID='${duid}' NOT FOUND in Google Sheets data`)
              // debug logs removed
              // debug logs removed
              // debug logs removed
              // debug logs removed
              // debug logs removed
              
              // Try to find similar DUIDs in Google Sheets
              const similarDuids = data
                .map(row => row[rowIdColumn]?.toString().trim())
                .filter(sheetDuid => sheetDuid && sheetDuid.includes(duid.substring(0, 10)))
                .slice(0, 3)
              
              if (similarDuids.length > 0) {
                // debug logs removed
                // debug logs removed
              } else {
                // debug logs removed
              }
              
              skippedCount++
              continue
            }

            // Use the ORIGINAL DUID from Google Sheets (exact match for API)
            const originalDuid = matchedData.originalDuid
            const existingRow = matchedData.row
            
            if (i < 5 || duid.includes('NUS-NB-PYA-0432')) {
              // debug logs removed
              // debug logs removed
              // debug logs removed
            }
            
            if (!originalDuid || !existingRow) {
              console.error(`❌ Row ${i + 1}: Invalid data structure for DUID='${duid}'`)
              skippedCount++
              continue
            }

            // Compare and update columns
            let rowHasUpdates = false
            const rowChangesList: string[] = [] // For logging
            
            for (const columnConfig of columnConfigs) {
              if (!columnConfig.editable) continue
              if (columnConfig.name === rowIdColumn) continue

              // Try multiple matching strategies for column name
              // 1. Try exact match with config.name (no spaces: "TSSRClosed")
              // 2. Try with displayName (with spaces: "TSSR Closed")
              // 3. Try case-insensitive match
              let excelValue = excelRow[columnConfig.name] || 
                              excelRow[columnConfig.displayName]
              
              // If still not found, try finding the key in excelRow that matches
              if (excelValue === undefined || excelValue === null) {
                const matchingKey = Object.keys(excelRow).find(key => 
                  key === columnConfig.name ||
                  key === columnConfig.displayName ||
                  key.replace(/\s+/g, '') === columnConfig.name ||
                  key.replace(/\s+/g, '') === columnConfig.displayName ||
                  key.toLowerCase() === columnConfig.name.toLowerCase() ||
                  key.toLowerCase() === columnConfig.displayName.toLowerCase()
                )
                if (matchingKey) {
                  excelValue = excelRow[matchingKey]
                }
              }
              
              // Log column check for first few rows
              if (i < 3) {
                console.log(`  📝 Column "${columnConfig.displayName}" (${columnConfig.name}): Excel value = "${excelValue}"`)
              }
              
              if (excelValue === undefined || excelValue === null || excelValue === '') continue

              const currentValue = existingRow[columnConfig.name]
              
              // Special handling for date columns - only update if current value is empty
              if (columnConfig.type === 'date') {
                if (currentValue && currentValue !== '') {
                  continue // Skip if date already has a value
                }

                // Parse and validate date format (DD-MMM-YYYY or similar)
                let formattedDate = excelValue.toString()
                
                // If it's an Excel date number, convert it
                if (typeof excelValue === 'number') {
                  const date = XLSX.SSF.parse_date_code(excelValue)
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                  formattedDate = `${date.d.toString().padStart(2, '0')}-${monthNames[date.m - 1]}-${date.y}`
                } else if (typeof excelValue === 'string') {
                  // Try to parse and reformat to DD-MMM-YYYY
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                  const monthMap: Record<string, number> = {
                    'jan': 0, 'january': 0,
                    'feb': 1, 'february': 1,
                    'mar': 2, 'march': 2,
                    'apr': 3, 'april': 3,
                    'may': 4,
                    'jun': 5, 'june': 5,
                    'jul': 6, 'july': 6,
                    'aug': 7, 'august': 7,
                    'sep': 8, 'september': 8,
                    'oct': 9, 'october': 9,
                    'nov': 10, 'november': 10,
                    'dec': 11, 'december': 11
                  }
                  
                  const dateParts = excelValue.split(/[\/-]/)
                  if (dateParts.length === 3) {
                    let day: number, month: number, year: number
                    
                    // Check if middle part is month name (DD/MMM/YYYY or DD-MMM-YYYY)
                    const middlePart = dateParts[1].toLowerCase().trim()
                    if (monthMap[middlePart] !== undefined) {
                      day = parseInt(dateParts[0])
                      month = monthMap[middlePart] + 1
                      year = parseInt(dateParts[2])
                    } else if (dateParts[0].length <= 2) {
                      // Try DD-MM-YYYY or DD/MM/YYYY
                      day = parseInt(dateParts[0])
                      month = parseInt(dateParts[1])
                      year = parseInt(dateParts[2])
                    } else {
                      // YYYY-MM-DD
                      year = parseInt(dateParts[0])
                      month = parseInt(dateParts[1])
                      day = parseInt(dateParts[2])
                    }
                    
                    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 1 && month <= 12) {
                      formattedDate = `${day.toString().padStart(2, '0')}-${monthNames[month - 1]}-${year}`
                    }
                  }
                }

                if (formattedDate !== currentValue) {
                  // Add to row updates map
                  if (!rowUpdates.has(originalDuid)) {
                    rowUpdates.set(originalDuid, new Map())
                  }
                  rowUpdates.get(originalDuid)!.set(columnConfig.name, {
                    value: formattedDate,
                    oldValue: currentValue
                  })
                  rowHasUpdates = true
                  rowChangesList.push(`${columnConfig.displayName}: "${currentValue}" → "${formattedDate}"`)
                }
              } else {
                // For non-date columns, update if values are different
                const newValue = excelValue.toString()
                if (newValue !== currentValue?.toString()) {
                  // Add to row updates map
                  if (!rowUpdates.has(originalDuid)) {
                    rowUpdates.set(originalDuid, new Map())
                  }
                  rowUpdates.get(originalDuid)!.set(columnConfig.name, {
                    value: newValue,
                    oldValue: currentValue
                  })
                  rowHasUpdates = true
                  rowChangesList.push(`${columnConfig.displayName}: "${currentValue}" → "${newValue}"`)
                  
                  if (i < 3) {
                    console.log(`    ✏️ Will update: ${columnConfig.displayName}`)
                  }
                }
              }
            }

            if (rowHasUpdates) {
              updatedCount++
              if (i < 3) {
                console.log(`  ✅ Row ${i + 1} (${duid}): ${rowChangesList.length} updates: ${rowChangesList.join(', ')}`)
              }
            } else if (i < 3) {
              console.log(`  ⏭️ Row ${i + 1} (${duid}): No changes detected`)
            }
          }

          // Apply all cell updates using SINGLE batch API call
          const totalUpdates = Array.from(rowUpdates.values()).reduce((sum, cols) => sum + cols.size, 0)
          console.log(`\n📤 Preparing single batch update: ${rowUpdates.size} rows with ${totalUpdates} total cell changes...`)
          
          // Breakdown by column
          const updatesByColumn = new Map<string, number>()
          rowUpdates.forEach((columns) => {
            columns.forEach((_, colId) => {
              updatesByColumn.set(colId, (updatesByColumn.get(colId) || 0) + 1)
            })
          })
          console.log(`   Breakdown by column:`)
          updatesByColumn.forEach((count, col) => {
            const config = columnConfigs.find(c => c.name === col)
            console.log(`   - ${config?.displayName || col}: ${count} rows`)
          })
          
          if (rowUpdates.size > 0) {
            // Convert rowUpdates Map to array of cell updates for single API call
            const cellUpdates: Array<{
              duid: string;
              columnId: string;
              value: any;
              oldValue: any;
            }> = []
            
            rowUpdates.forEach((columns, duid) => {
              columns.forEach((data, colId) => {
                cellUpdates.push({
                  duid,
                  columnId: colId,
                  value: data.value,
                  oldValue: data.oldValue
                })
              })
            })
            
            console.log(`🚀 Sending SINGLE batch update API call for ${cellUpdates.length} cells...`)
            
            try {
              // Call batch update API ONCE with all changes
              const response = await fetch('/api/sheets/itc-huawei/batch-update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  cellUpdates,
                  rowIdentifierColumn: rowIdColumn,
                  sheetName: selectedSheet
                })
              })
              
              if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Batch update failed')
              }
              
              const result = await response.json()
              console.log(`✅ Batch update completed: ${result.updatedCells} cells updated in ${result.updateTime}ms`)
            } catch (error) {
              console.error(`❌ Batch update failed:`, error)
              throw error
            }
          }

          setImportSuccess({ updated: updatedCount, skipped: skippedCount })
          
          // Clear success message after 10 seconds
          setTimeout(() => setImportSuccess(null), 10000)

        } catch (error) {
          console.error('Error processing Excel file:', error)
          alert('Failed to process Excel file: ' + (error instanceof Error ? error.message : 'Unknown error'))
        } finally {
          setImporting(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      }

      reader.onerror = () => {
        alert('Failed to read file')
        setImporting(false)
      }

      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('Error importing Excel:', error)
      alert('Failed to import Excel file')
      setImporting(false)
    }
  }

  const handleUndoImport = async () => {
    if (backupData.length === 0) {
      alert('No import to undo')
      return
    }

    if (!confirm('Are you sure you want to undo the last import? This will restore the previous data.')) {
      return
    }

    try {
      setImporting(true)

      // Restore each row from backup
      if (onUpdateData) {
        for (const backupRow of backupData) {
          const duid = backupRow[rowIdColumn]?.toString().trim()
          if (!duid) continue

          const currentRow = data.find(row => row[rowIdColumn]?.toString().trim() === duid)
          if (!currentRow) continue

          // Restore each editable column
          for (const columnConfig of columnConfigs) {
            if (!columnConfig.editable) continue
            if (columnConfig.name === rowIdColumn) continue

            const backupValue = backupRow[columnConfig.name]
            const currentValue = currentRow[columnConfig.name]

            if (backupValue !== currentValue) {
              await onUpdateData(duid, columnConfig.name, backupValue, currentValue)
            }
          }
        }
      }

      setBackupData([])
      setImportSuccess(null)
      alert('Import successfully undone')
    } catch (error) {
      console.error('Error undoing import:', error)
      alert('Failed to undo import: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setImporting(false)
    }
  }

  const hasActiveFilters = columnFilters.length > 0

  // Avoid early return if column configs haven't loaded yet. We'll render the table and rely on the
  // table overlay to display a loading spinner instead of the full-page configuration message.

  // Empty state - no project selected
  if (!selectedSheet) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-full flex items-center justify-center">
            <Database className="h-8 w-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Project</h3>
          <p className="text-sm text-gray-500">
            Please select a project from the dropdown above to view rollout data
          </p>
        </div>
      </div>
    )
  }

  // Loading state - render normally and rely on table overlay so the rest of the page remains visible.
  // NOTE: Avoid full-screen return; the table overlay will indicate loading instead.

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-100 rounded-md hover:bg-blue-100"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Enhanced Filter Bar - Professional Design */}
      <div className="flex-none bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 space-x-4">
          {/* Left Section: Date Filter */}
          <div className="flex items-center space-x-3">
            {/* Custom Date Range */}
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
              />
              <span className="text-xs text-gray-500 font-medium">to</span>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
              />
            </div>

            {/* Reset Date Button */}
            {(dateFilter.startDate !== (() => {
              const today = new Date()
              const oneMonthAgo = new Date(today)
              oneMonthAgo.setMonth(today.getMonth() - 1)
              return oneMonthAgo.toISOString().split('T')[0]
            })() || dateFilter.endDate !== new Date().toISOString().split('T')[0]) && (
              <button
                onClick={() => {
                  const today = new Date()
                  const oneMonthAgo = new Date(today)
                  oneMonthAgo.setMonth(today.getMonth() - 1)
                  setDateFilter({
                    startDate: oneMonthAgo.toISOString().split('T')[0],
                    endDate: today.toISOString().split('T')[0]
                  })
                }}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                title="Reset date filter to last 30 days"
              >
                Reset Date
              </button>
            )}

            {/* Action Buttons: Import, Export, Refresh, Load PO Status */}
            {(onExport || onRefresh || onImport) && (
              <div className="flex items-center space-x-2 border-l border-gray-300 pl-3">
                {/* Import Excel Button */}
                {onImport && (
                  <button
                    onClick={onImport}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-600 rounded-md hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors duration-200 shadow-sm"
                    title="Import Excel to update data (matches by DUID)"
                  >
                    <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import
                  </button>
                )}
                
                <button
                  onClick={handleExport}
                  disabled={localExporting}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-600 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  title="Export filtered data to Excel (local data, no server fetch)"
                >
                  <Download className={`h-3.5 w-3.5 mr-1.5 ${localExporting ? 'animate-bounce' : ''}`} />
                  {localExporting ? 'Exporting...' : 'Export'}
                </button>
                {/* Refresh is now placed in the search area (right side) */}
                {!showPOStatus ? (
                  <button
                    onClick={() => {
                      setShowPOStatus(true)
                      setPoColumnVisible(true)
                      setColumnVisibility(prev => ({ ...prev, PO_Status: true }))
                    }}
                    disabled={poLoading}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-600 rounded-md hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    title="Load PO Status column"
                  >
                    <Database className="h-3.5 w-3.5 mr-1.5" />
                    Load PO Status
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowPOStatus(false)
                      setColumnVisibility(prev => ({ ...prev, PO_Status: false }))
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-600 rounded-md hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors duration-200 shadow-sm"
                    title="Hide PO Status column"
                  >
                    <Database className="h-3.5 w-3.5 mr-1.5" />
                    Hide PO Status
                  </button>
                )}
                
                {/* Undo Import Button */}
                {backupData.length > 0 && (
                  <button
                    onClick={handleUndoImport}
                    disabled={importing}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-100 rounded-md hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Undo last import and restore previous data"
                  >
                    <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Undo Import
                  </button>
                )}
              </div>
            )}

            {/* Save/Cancel Buttons */}
            {pendingChanges.size > 0 && (
              <div className="flex items-center space-x-1 border-l border-gray-300 pl-3">
                <button
                  onClick={handleBatchSave}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-semibold text-green-800 bg-green-50 border border-green-600 rounded hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-200 transition-colors duration-200 flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Save ({pendingChanges.size})</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleCancelAll}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-900 bg-gray-50 border border-gray-500 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-300 transition-colors duration-200 flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Section: Search & Controls */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search all columns"
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors w-80"
              />
              {(globalFilter || hasActiveFilters) && (
                <button
                  onClick={handleClearAllFilters}
                  className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-200 flex items-center space-x-2 shadow-sm"
                  title="Clear all filters"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </button>
              )}

              {/* Icon-only Refresh aligned next to search */}
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  title="Refresh data"
                  aria-label="Refresh data"
                  className="p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar - Messages */}
      {pendingChanges.size > 0 && saveError && (
        <div className="flex-none p-2 bg-gray-50 border-b border-gray-200 flex items-center justify-center gap-2">
          <span className="text-xs text-red-600">{saveError}</span>
        </div>
      )}
      
      {/* Import Success Message */}
      {importSuccess && (
        <div className="flex-none p-2 bg-emerald-50 border-b border-emerald-200 flex items-center justify-center gap-2">
          <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs text-emerald-700 font-medium">
            Import successful! Updated: {importSuccess.updated} rows, Skipped: {importSuccess.skipped} rows
          </span>
          <button
            onClick={() => setImportSuccess(null)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto relative" id="huawei-table-container">
        {/* Table-level loading overlay: show when initial column config is not loaded or when table refresh is ongoing */}
        {(loading || columnConfigs.length === 0) && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center" style={{ position: 'fixed' }}>
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent mb-4"></div>
              <p className="text-sm text-gray-600 font-medium">Loading table configuration...</p>
            </div>
          </div>
        )}
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 z-20">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const isPinned = header.column.getIsPinned()
                  const pinStyles = isPinned
                    ? {
                        position: 'sticky' as const,
                        left: isPinned === 'left' ? `${header.column.getStart('left')}px` : undefined,
                        right: isPinned === 'right' ? `${header.column.getAfter('right')}px` : undefined,
                        zIndex: 30,
                        backgroundColor: 'rgb(249 250 251)',
                        boxShadow: isPinned === 'left' ? '2px 0 4px rgba(0,0,0,0.1)' : isPinned === 'right' ? '-2px 0 4px rgba(0,0,0,0.1)' : undefined,
                      }
                    : {}

                  return (
                    <th
                      key={header.id}
                      style={{
                        ...pinStyles,
                        width: header.getSize(),
                        position: isPinned ? 'sticky' : 'relative',
                      }}
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b-2 border-gray-300 border-r border-gray-200"
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center justify-between">
                          <div
                            className="cursor-pointer select-none flex items-center flex-1"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span className="ml-1.5 text-gray-500 text-sm font-bold">
                              {{
                                asc: '↑',
                                desc: '↓',
                              }[header.column.getIsSorted() as string] ?? '↕'}
                            </span>
                          </div>
                          
                          {/* Filter Button */}
                          <button
                            onClick={(e) => handleFilterDropdownToggle(e, header.column.id)}
                            className={`relative p-1.5 rounded hover:bg-gray-200 transition-colors ${
                              getSelectedCount(header.column.id) > 0 ? 'bg-blue-100 text-blue-600' : 'text-gray-500'
                            }`}
                            title="Filter column"
                          >
                            <Filter className="h-3.5 w-3.5" />
                            {getSelectedCount(header.column.id) > 0 && (
                              <span className="absolute -top-1 -right-1 bg-blue-50 text-blue-700 border border-blue-100 text-[9px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-bold shadow-sm">
                                {getSelectedCount(header.column.id)}
                              </span>
                            )}
                          </button>
                        </div>
                      )}
                      
                      {/* Resize Handle */}
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none bg-transparent hover:bg-blue-400 ${
                          header.column.getIsResizing() ? 'bg-blue-500' : ''
                        }`}
                        style={{ userSelect: 'none' }}
                      />
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.map((row, rowIndex) => {
              const isLastRow = rowIndex === table.getRowModel().rows.length - 1
              return (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50"
                  style={{ borderBottom: isLastRow ? '1px solid #e5e7eb' : undefined }}
                >
                  {row.getVisibleCells().map(cell => {
                    const isPinned = cell.column.getIsPinned()
                    const pinStyles = isPinned
                      ? {
                          position: 'sticky' as const,
                          left: isPinned === 'left' ? `${cell.column.getStart('left')}px` : undefined,
                          right: isPinned === 'right' ? `${cell.column.getAfter('right')}px` : undefined,
                          zIndex: 10,
                          backgroundColor: 'white',
                          boxShadow: isPinned === 'left' ? '2px 0 4px rgba(0,0,0,0.05)' : isPinned === 'right' ? '-2px 0 4px rgba(0,0,0,0.05)' : undefined,
                        }
                      : {}

                    return (
                      <td
                        key={cell.id}
                        style={{
                          ...pinStyles,
                          width: cell.column.getSize(),
                        }}
                        className="px-2 py-1.5 whitespace-nowrap text-xs border-r border-gray-200"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex-none p-2 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="text-gray-600">
              Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}{' '}
              of {table.getFilteredRowModel().rows.length} rows
              {table.getFilteredRowModel().rows.length !== data.length && (
                <span className="ml-1 text-blue-600">
                  (filtered from {data.length})
                </span>
              )}
            </div>
            
            {/* Page Size Selector */}
            <div className="flex items-center gap-1">
              <span className="text-gray-600">Show:</span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={e => table.setPageSize(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ««
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              »»
            </button>
          </div>
        </div>
      </div>

      {/* Filter Dropdown Portal */}
      {activeFilterColumn && filterDropdownPosition && (
        <div 
          ref={filterDropdownRef}
          className="fixed bg-white border border-gray-300 rounded-lg shadow-2xl z-[100] w-[280px] max-h-[500px] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
          style={{
            top: `${filterDropdownPosition.top}px`,
            left: `${filterDropdownPosition.left}px`,
          }}
        >
          {/* Date Presets (only for date columns) */}
          {columnConfigs.some(c => c.name === activeFilterColumn && c.type === 'date') && (
            <div className="border-b border-gray-200">
              {/* Preset Buttons */}
              <div className="p-2 bg-blue-50">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    onClick={() => handleDatePresetFilter(activeFilterColumn, 'thisweek')}
                    className="text-[10px] px-2 py-1 rounded bg-white border hover:bg-blue-100"
                  >
                    This Week
                  </button>
                  <button
                    onClick={() => handleDatePresetFilter(activeFilterColumn, 'lastweek')}
                    className="text-[10px] px-2 py-1 rounded bg-white border hover:bg-blue-100"
                  >
                    Last Week
                  </button>
                  <button
                    onClick={() => handleDatePresetFilter(activeFilterColumn, 'thismonth')}
                    className="text-[10px] px-2 py-1 rounded bg-white border hover:bg-blue-100"
                  >
                    This Month
                  </button>
                  <button
                    onClick={() => handleDatePresetFilter(activeFilterColumn, 'lastmonth')}
                    className="text-[10px] px-2 py-1 rounded bg-white border hover:bg-blue-100"
                  >
                    Last Month
                  </button>
                  <button
                    onClick={() => handleDatePresetFilter(activeFilterColumn, 'thisyear')}
                    className="text-[10px] px-2 py-1 rounded bg-white border hover:bg-blue-100"
                  >
                    This Year
                  </button>
                </div>
              </div>
              
              {/* Manual Date Range */}
              <div className="p-3 bg-white">
                <div className="text-xs font-semibold text-gray-700 mb-2">Custom Range:</div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-gray-600 block mb-1">From:</label>
                    <input
                      type="date"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={(() => {
                        const filterValue = getColumnFilterValue(activeFilterColumn) as DateRangeFilterValue
                        return filterValue?.startDate || ''
                      })()}
                      onChange={(e) => {
                        const currentFilter = getColumnFilterValue(activeFilterColumn) as DateRangeFilterValue
                        const newFilter: DateRangeFilterValue = {
                          preset: 'custom',
                          startDate: e.target.value,
                          endDate: currentFilter?.endDate || ''
                        }
                        table.getColumn(activeFilterColumn)?.setFilterValue(newFilter)
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-600 block mb-1">To:</label>
                    <input
                      type="date"
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={(() => {
                        const filterValue = getColumnFilterValue(activeFilterColumn) as DateRangeFilterValue
                        return filterValue?.endDate || ''
                      })()}
                      onChange={(e) => {
                        const currentFilter = getColumnFilterValue(activeFilterColumn) as DateRangeFilterValue
                        const newFilter: DateRangeFilterValue = {
                          preset: 'custom',
                          startDate: currentFilter?.startDate || '',
                          endDate: e.target.value
                        }
                        table.getColumn(activeFilterColumn)?.setFilterValue(newFilter)
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header with Search (hidden for date columns) */}
          {!columnConfigs.some(c => c.name === activeFilterColumn && c.type === 'date') && (
            <div className="p-3 border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white">
              <input
                type="text"
                placeholder="🔍 Search values..."
                value={filterSearchQuery}
                onChange={(e) => setFilterSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                autoFocus
              />
              
              {/* Selected Count Badge */}
              {getSelectedCount(activeFilterColumn) > 0 && (
                <div className="mt-2 flex items-center justify-center">
                  <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                    <span className="mr-1">✓</span>
                    {getSelectedCount(activeFilterColumn)} selected
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Options List (hidden for date columns) */}
          {!columnConfigs.some(c => c.name === activeFilterColumn && c.type === 'date') && (
            <div className="max-h-[300px] overflow-y-auto py-2 flex-1">
              <div className="px-2 space-y-0.5">
                {getUniqueColumnValues(activeFilterColumn)
                  .filter(value => 
                    filterSearchQuery === '' || 
                    value.toLowerCase().includes(filterSearchQuery.toLowerCase())
                  )
                  .map((value, idx) => {
                    const isSelected = isValueSelected(activeFilterColumn, value)
                    return (
                      <button
                        key={idx}
                        onClick={() => handleColumnFilter(activeFilterColumn, 'toggleValue', value)}
                        className={`
                          w-full text-left px-3 py-2 text-xs rounded-md flex items-center space-x-2 transition-all
                          ${isSelected 
                            ? 'bg-blue-50 hover:bg-blue-100 border border-blue-200' 
                            : 'hover:bg-gray-50 border border-transparent'
                          }
                        `}
                      >
                        <span className={`${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                          {isSelected ? '☑' : '☐'}
                        </span>
                        <span className={`truncate flex-1 ${isSelected ? 'text-blue-900 font-semibold' : 'text-gray-700'}`}>
                          {value}
                        </span>
                      </button>
                    )
                  })}
                
                {/* No Results Message */}
                {getUniqueColumnValues(activeFilterColumn)
                  .filter(value => filterSearchQuery === '' || value.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                  .length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-gray-500">
                      No matching values
                    </div>
                )}
              </div>
            </div>
          )}
          
          {/* Footer with Clear Button */}
          <div className="p-2 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => {
                table.getColumn(activeFilterColumn)?.setFilterValue(undefined)
                setActiveFilterColumn(null)
                setFilterDropdownPosition(null)
              }}
              className="w-full px-3 py-2 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
            >
              Clear Filter
            </button>
          </div>
        </div>
      )}
      
      {/* Site Detail Modal */}
      <SiteDetailModal
        isOpen={siteDetailModalOpen}
        onClose={() => {
          setSiteDetailModalOpen(false)
          setSelectedSite(null)
        }}
        duid={selectedSite?.duid || ''}
        duName={selectedSite?.duName}
        selectedSheet={selectedSheet}
      />
    </div>
  )
}
