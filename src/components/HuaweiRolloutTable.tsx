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
import { Check, X, Edit2, XCircle, ChevronLeft, ChevronRight, Filter, Calendar, Download, Database } from 'lucide-react'

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

  // Callback functions for editing
  const handleStartEdit = useCallback((rowId: string, columnId: string, value: any) => {
    setEditingCell({ rowId, columnId, value, oldValue: value })
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (!editingCell) return

    const changeKey = `${editingCell.rowId}-${editingCell.columnId}`
    const newChanges = new Map(pendingChanges)
    newChanges.set(changeKey, editingCell)
    setPendingChanges(newChanges)
    setEditingCell(null)
  }, [editingCell, pendingChanges])

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

        // Debug: Check column names from config vs data
        console.log('📊 Column Configs:', configs.map(c => ({
          name: c.name,
          display: c.displayName,
          type: c.type,
          show: c.show
        })))

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

    return columnConfigs
      .filter(config => config.show)
      .map((config): ColumnDef<any> => ({
        id: config.name,
        accessorFn: (row) => {
          // Try exact match first
          let value = row[config.name]
          
          // If not found, try case-insensitive match
          if (value === undefined || value === null) {
            const matchingKey = Object.keys(row).find(
              key => key.toLowerCase() === config.name.toLowerCase()
            )
            if (matchingKey) {
              value = row[matchingKey]
            }
          }
          
          // If still not found, try trimmed match
          if (value === undefined || value === null) {
            const matchingKey = Object.keys(row).find(
              key => key.trim() === config.name.trim()
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
          const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === config.name
          const hasPendingChange = pendingChanges.has(`${rowId}-${config.name}`)

          // Fallback: try to get value if getValue() returns empty but data exists
          if (!cellValue) {
            // Try exact match with config.name
            cellValue = row.original[config.name]
            
            // If still empty, try case-insensitive match
            if (!cellValue) {
              const matchingKey = Object.keys(row.original).find(
                key => key.toLowerCase() === config.name.toLowerCase()
              )
              if (matchingKey) {
                cellValue = row.original[matchingKey]
              }
            }
            
            // If still empty, try trimmed match
            if (!cellValue) {
              const matchingKey = Object.keys(row.original).find(
                key => key.trim() === config.name.trim()
              )
              if (matchingKey) {
                cellValue = row.original[matchingKey]
              }
            }
          }

          // Date display with format dd-MMM-yyyy
          if (config.type === 'date' && cellValue) {
            let dateValue: Date | null = null
            
            if (typeof cellValue === 'string') {
              // Handle DD/MM/YYYY or DD-MM-YYYY format
              const parts = cellValue.split(/[\/\-]/)
              if (parts.length === 3) {
                const day = parseInt(parts[0], 10)
                const month = parseInt(parts[1], 10) - 1
                const year = parseInt(parts[2], 10)
                dateValue = new Date(year, month, day)
              }
            } else {
              dateValue = new Date(cellValue)
            }
            
            if (dateValue && !isNaN(dateValue.getTime())) {
              const day = dateValue.getDate().toString().padStart(2, '0')
              const month = dateValue.toLocaleDateString('en-US', { month: 'short' })
              const year = dateValue.getFullYear()
              return (
                <div className="text-xs">
                  {`${day}-${month}-${year}`}
                </div>
              )
            }
          }

          // Editable cell
          if (config.editable && !isEditing) {
            return (
              <div className="group relative">
                <div className={`text-xs ${hasPendingChange ? 'font-semibold text-blue-600' : ''}`}>
                  {cellValue?.toString() || ''}
                </div>
                <button
                  onClick={() => handleStartEdit(rowId, config.name, cellValue)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded"
                >
                  <Edit2 className="h-3 w-3 text-gray-400" />
                </button>
              </div>
            )
          }

          // Editing state
          if (isEditing) {
            if (config.type === 'textarea') {
              return (
                <textarea
                  autoFocus
                  value={editingCell.value || ''}
                  onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                  onBlur={() => handleSaveEdit()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelEdit()
                    if (e.key === 'Enter' && e.ctrlKey) handleSaveEdit()
                  }}
                  className="w-full min-h-20 p-1 border border-blue-500 rounded text-xs"
                  rows={3}
                />
              )
            }

            return (
              <input
                autoFocus
                type={config.type === 'date' ? 'date' : 'text'}
                value={editingCell.value || ''}
                onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                onBlur={() => handleSaveEdit()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit()
                  if (e.key === 'Escape') handleCancelEdit()
                }}
                className="w-full p-1 border border-blue-500 rounded text-xs"
              />
            )
          }

          return <div className="text-xs">{cellValue?.toString() || ''}</div>
        },
      }))
  }, [columnConfigs, editingCell, pendingChanges, rowIdColumn, handleSaveEdit, handleCancelEdit, handleStartEdit])

  // Filter data by date range
  const filteredData = useMemo(() => {
    if (!dateFilter.startDate || !dateFilter.endDate) return data
    
    // Debug: Log actual data keys from first row
    if (data.length > 0) {
      console.log('📋 Actual Data Keys:', Object.keys(data[0]))
      console.log('🔍 DU Name value:', data[0]['DU Name'])
      console.log('🔍 Site Status value:', data[0]['Site Status'])
    }
    
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
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
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
    filteredData.forEach(row => {
      const value = row[columnId]
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
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        end = new Date(start)
        break
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
      console.log(`✅ Batch save completed: ${changes.length} cells in ${(endTime - startTime).toFixed(0)}ms`)

      setPendingChanges(new Map())
    } catch (error) {
      console.error('Batch save error:', error)
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
      {/* Date Range Filter */}
      <div className="flex-none p-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
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
                  onClick={() => setPendingChanges(new Map())}
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
                    onClick={() => handleDatePresetFilter(activeFilterColumn, 'today')}
                    className="text-[10px] px-2 py-1 rounded bg-white border hover:bg-blue-100"
                  >
                    Today
                  </button>
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
    </div>
  )
}
