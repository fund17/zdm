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
import { Check, X, Edit2, XCircle, ChevronLeft, ChevronRight, Filter, Calendar, Download, Database, Search } from 'lucide-react'
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
  selectedSheet = ''
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
    right: ['SiteStatus'] 
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  
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
          handleCellSave()
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingCell, handleCellSave])

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
        setColumnVisibility(initialVisibility)

      } catch (error) {
        console.error('Failed to load column configuration:', error)
      }
    }

    fetchColumnConfig()
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
    
    return filtered.map((config): ColumnDef<any> => {
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
          
          // Use new value if changed, otherwise use original
          const displayValue = hasChanges ? changedCells.get(changeKey)?.newValue : cellValue

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
              return (
                <div className="flex items-center gap-1 text-xs">
                  {hasChanges && <div className="w-1 h-1 bg-orange-500 rounded-full" />}
                  <span className={hasChanges ? 'text-orange-700 font-medium' : ''}>
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
            const cellClasses = `group flex items-center justify-between cursor-pointer px-1 py-0.5 rounded transition-colors text-xs ${
              hasChanges 
                ? 'bg-orange-50 border border-orange-200 hover:bg-orange-100' 
                : 'hover:bg-gray-50'
            }`
            
            return (
              <div 
                className={cellClasses}
                onDoubleClick={() => handleCellEdit(row.original, columnId, displayValue)}
                title={hasChanges ? "Modified - not saved yet. Double-click to edit." : "Double-click to edit"}
              >
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  {hasChanges && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0" />}
                  <span className={hasChanges ? 'text-orange-700 font-medium' : ''}>
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
              <div className="flex items-center gap-1 px-1 py-0.5" data-editing-cell>
                {config.type === 'textarea' ? (
                  <textarea
                    autoFocus
                    value={editingCell.value || ''}
                    onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                    onBlur={() => handleCellSave()}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') handleCellCancel()
                      if (e.key === 'Enter' && e.ctrlKey) handleCellSave()
                    }}
                    className="w-full min-h-20 p-1 border-2 border-blue-500 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                    rows={3}
                  />
                ) : (
                  <input
                    autoFocus
                    type={config.type === 'date' ? 'date' : 'text'}
                    value={editingCell.value || ''}
                    onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                    onBlur={() => handleCellSave()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCellSave()
                      if (e.key === 'Escape') handleCellCancel()
                    }}
                    className="w-full p-1 border-2 border-blue-500 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
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
          
          return (
            <div className="flex items-center gap-1 text-xs">
              {hasChanges && <div className="w-1 h-1 bg-orange-500 rounded-full" />}
              <span className={hasChanges ? 'text-orange-700 font-medium' : ''}>
                {displayValue?.toString() || ''}
              </span>
            </div>
          )
        },
      })
    })
  }, [columnConfigs, editingCell, pendingChanges, changedCells, rowIdColumn, handleCellEdit, handleCellSave, handleCellCancel, data])

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

  // Notify parent of filtered data changes
  useEffect(() => {
    if (onFilteredDataChange) {
      const filteredRows = table.getFilteredRowModel().rows.map(row => row.original)
      onFilteredDataChange(filteredRows)
    }
  }, [table, onFilteredDataChange])

  // Get unique values for a column
  const getUniqueColumnValues = (columnId: string) => {
    const values = new Set<string>()
    const config = columnConfigs.find(c => c.name === columnId)
    
    filteredData.forEach(row => {
      // Use same matching strategy as accessorFn
      let value = row[columnId]
      
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
      
      if (value !== null && value !== undefined && value !== '') {
        values.add(value.toString())
      }
    })
    return Array.from(values).sort()
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
    setColumnFilters([])
  }

  const hasActiveFilters = columnFilters.length > 0

  if (columnConfigs.length === 0) {
    return <div className="p-4 text-center text-gray-500">Loading table configuration...</div>
  }

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

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent mb-4"></div>
          <p className="text-sm text-gray-600">Loading data...</p>
        </div>
      </div>
    )
  }

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
            className="inline-flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search and Date Range Filter */}
      <div className="flex-none p-3 bg-white border-b border-gray-200">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
            {/* Global Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search all columns..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {globalFilter && (
                <button
                  onClick={() => setGlobalFilter('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Date Range */}
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Date:</span>
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">
                ({filteredData.length} of {data.length} rows)
              </span>
            </div>
          </div>
          
          {/* Export Button */}
          {onExport && (
            <button 
              onClick={onExport}
              disabled={exporting}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Download className={`h-3.5 w-3.5 mr-1.5 ${exporting ? 'animate-bounce' : ''}`} />
              {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
          )}
        </div>
      </div>

      {/* Action Bar */}
      {(pendingChanges.size > 0 || hasActiveFilters) && (
        <div className="flex-none p-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {pendingChanges.size > 0 && (
              <>
                <span className="text-xs text-gray-600">
                  {pendingChanges.size} unsaved change{pendingChanges.size !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={handleBatchSave}
                  disabled={isSaving}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  {isSaving ? 'Saving...' : 'Save All'}
                </button>
                <button
                  onClick={handleCancelAll}
                  disabled={isSaving}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </>
            )}
            {saveError && (
              <span className="text-xs text-red-600">{saveError}</span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearAllFilters}
              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-1"
            >
              <XCircle className="h-3 w-3" />
              Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
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
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b-2 border-gray-300"
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
                            className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${
                              getSelectedCount(header.column.id) > 0 ? 'bg-blue-100 text-blue-600' : 'text-gray-500'
                            }`}
                            title="Filter column"
                          >
                            <Filter className="h-3.5 w-3.5" />
                            {getSelectedCount(header.column.id) > 0 && (
                              <span className="ml-0.5 text-[10px] font-bold">{getSelectedCount(header.column.id)}</span>
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
                        className="px-2 py-1.5 whitespace-nowrap text-xs"
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
                <div className="mt-2 inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  <span className="mr-1">✓</span>
                  {getSelectedCount(activeFilterColumn)} selected
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
