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
  ColumnResizeMode,
  ColumnPinningState,
} from '@tanstack/react-table'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Check, X, Edit2, Shield, AlertTriangle, Settings, Eye, EyeOff, Lock, CalendarRange, Filter, XCircle, Activity as ActivityIcon, Download } from 'lucide-react'

interface ColumnConfig {
  name: string
  type: 'string' | 'date' | 'time' | 'textarea' | 'currency' | 'list'
  show: boolean
  editable: boolean
  displayName: string
}

interface DataTableProps {
  data: Record<string, any>[]
  onUpdateData?: (rowId: string, columnId: string, value: any, oldValue: any) => Promise<void>
  rowIdColumn?: string
  onFilteredDataChange?: (filteredData: Record<string, any>[]) => void // Add callback for filtered data
  onDateFilterChange?: (dateFilter: { startDate: string; endDate: string }) => void // Add callback for date filter changes
  statusFilter?: string | null // Add status filter prop
  activityFilter?: string | null // Add activity filter prop
  initialDateFilter?: DateFilter // Add prop to control date filter from parent
  showFilters?: boolean // Add prop to control filter visibility
  onExport?: () => Promise<void> // Add export callback prop
  onSaveComplete?: () => Promise<void> // Add callback after save completes
  loading?: boolean // Add loading state for table body
  onImport?: () => void // Add import trigger prop
  onRefresh?: () => Promise<void> // Add refresh callback prop
  refreshing?: boolean // Add refresh state prop
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

// Badge helper functions
const getStatusBadgeStyle = (status: string) => {
  const normalizedStatus = status.toLowerCase().trim()
  
  switch (normalizedStatus) {
    case 'on plan':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'on going':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'carry over':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'done':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'idle':
      return 'bg-gray-100 text-gray-700 border-gray-200'
    case 'off':
      return 'bg-slate-100 text-slate-600 border-slate-200'
  }
  
  // Fallback for partial matches
  if (normalizedStatus.includes('plan')) return 'bg-blue-100 text-blue-800 border-blue-200'
  if (normalizedStatus.includes('going') || normalizedStatus.includes('progress') || normalizedStatus.includes('ongoing')) 
    return 'bg-orange-100 text-orange-800 border-orange-200'
  if (normalizedStatus.includes('carry') || normalizedStatus.includes('pending') || normalizedStatus.includes('waiting')) 
    return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  if (normalizedStatus.includes('done') || normalizedStatus.includes('complete') || normalizedStatus.includes('finish')) 
    return 'bg-green-100 text-green-800 border-green-200'
  if (normalizedStatus.includes('fail') || normalizedStatus.includes('error') || normalizedStatus.includes('reject')) 
    return 'bg-red-100 text-red-800 border-red-200'
  if (normalizedStatus.includes('idle') || normalizedStatus.includes('inactive')) 
    return 'bg-gray-100 text-gray-700 border-gray-200'
  if (normalizedStatus.includes('off') || normalizedStatus.includes('disabled')) 
    return 'bg-slate-100 text-slate-600 border-slate-200'
  if (normalizedStatus.includes('no status') || normalizedStatus === '') 
    return 'bg-gray-50 text-gray-500 border-gray-200'
  
  return 'bg-purple-100 text-purple-800 border-purple-200'
}

const getActivityBadgeStyle = (activity: string) => {
  const normalized = activity.toLowerCase().trim()
  
  switch (normalized) {
    case 'survey':
      return 'bg-blue-100 text-blue-700 border-blue-300'
    case 'mos':
      return 'bg-purple-100 text-purple-700 border-purple-300'
    case 'installation':
      return 'bg-emerald-100 text-emerald-700 border-emerald-300'
    case 'integration':
      return 'bg-teal-100 text-teal-700 border-teal-300'
    case 'atp / sir':
    case 'atp/sir':
    case 'atp':
      return 'bg-indigo-100 text-indigo-700 border-indigo-300'
    case 'rectification':
      return 'bg-orange-100 text-orange-700 border-orange-300'
    case 'tagging':
      return 'bg-pink-100 text-pink-700 border-pink-300'
    case 'commissioning':
      return 'bg-cyan-100 text-cyan-700 border-cyan-300'
    case 'testing':
      return 'bg-violet-100 text-violet-700 border-violet-300'
    case 'maintenance':
      return 'bg-amber-100 text-amber-700 border-amber-300'
    case 'troubleshooting':
      return 'bg-red-100 text-red-700 border-red-300'
    case 'documentation':
      return 'bg-slate-100 text-slate-700 border-slate-300'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-300'
  }
}

export function DailyPlanTable({ data, onUpdateData, rowIdColumn = 'RowId', onFilteredDataChange, onDateFilterChange, statusFilter, activityFilter, initialDateFilter, showFilters = false, onExport, onSaveComplete, loading = false, onImport, onRefresh, refreshing = false }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'Date', desc: true }]) // Sort by Date descending (newest first)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dailyplan-columnFilters')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [globalFilter, setGlobalFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dailyplan-globalFilter') || ''
    }
    return ''
  })
  const [editingCell, setEditingCell] = useState<EditingState | null>(null)
  const [localData, setLocalData] = useState(data)
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>([])
  const [configLoading, setConfigLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)
  const [menuData, setMenuData] = useState<Record<string, string[]>>({}) // Add menu data state
  const [columnSizing, setColumnSizing] = useState({})
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ 
    left: ['Site ID'],
    right: ['Status']
  })
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null)
  const [filterDropdownPosition, setFilterDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const [filterSearchQuery, setFilterSearchQuery] = useState('')
  const filterDropdownRef = useRef<HTMLDivElement>(null)

  // Filter states for the new filters section
  const [selectedActivity, setSelectedActivity] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dailyplan-selectedActivity') || null
    }
    return null
  })
  const [selectedStatus, setSelectedStatus] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dailyplan-selectedStatus') || null
    }
    return null
  })
  const [selectedVendor, setSelectedVendor] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dailyplan-selectedVendor') || null
    }
    return null
  })
  const [selectedTeamCategory, setSelectedTeamCategory] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dailyplan-selectedTeamCategory') || null
    }
    return null
  })

  const [uniqueActivities, setUniqueActivities] = useState<string[]>([])
  const [uniqueStatuses, setUniqueStatuses] = useState<string[]>([])
  const [uniqueVendors, setUniqueVendors] = useState<string[]>([])
  const [uniqueTeamCategories, setUniqueTeamCategories] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  
  // Batch editing states
  const [changedCells, setChangedCells] = useState<Map<string, { rowId: string, columnId: string, oldValue: any, newValue: any }>>(new Map())
  const [isSaving, setIsSaving] = useState(false)
  
  const [dateFilter, setDateFilter] = useState<DateFilter>(() => {
    // Use parent's initialDateFilter if provided
    if (initialDateFilter) {
      return initialDateFilter
    }
    
    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dailyplan-dateFilter')
      if (saved) {
        return JSON.parse(saved)
      }
    }
    
    // Default to yesterday, today, tomorrow
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    
    return {
      startDate: yesterday.toISOString().split('T')[0],
      endDate: tomorrow.toISOString().split('T')[0]
    }
  })
  
  // Sync dateFilter with parent's initialDateFilter when it changes
  useEffect(() => {
    if (initialDateFilter && (initialDateFilter.startDate !== dateFilter.startDate || initialDateFilter.endDate !== dateFilter.endDate)) {
      setDateFilter(initialDateFilter)
    }
  }, [initialDateFilter, dateFilter.startDate, dateFilter.endDate])

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dailyplan-columnFilters', JSON.stringify(columnFilters))
    }
  }, [columnFilters])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dailyplan-globalFilter', globalFilter)
    }
  }, [globalFilter])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dailyplan-dateFilter', JSON.stringify(dateFilter))
    }
  }, [dateFilter])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedActivity) {
        localStorage.setItem('dailyplan-selectedActivity', selectedActivity)
      } else {
        localStorage.removeItem('dailyplan-selectedActivity')
      }
    }
  }, [selectedActivity])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedStatus) {
        localStorage.setItem('dailyplan-selectedStatus', selectedStatus)
      } else {
        localStorage.removeItem('dailyplan-selectedStatus')
      }
    }
  }, [selectedStatus])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedVendor) {
        localStorage.setItem('dailyplan-selectedVendor', selectedVendor)
      } else {
        localStorage.removeItem('dailyplan-selectedVendor')
      }
    }
  }, [selectedVendor])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedTeamCategory) {
        localStorage.setItem('dailyplan-selectedTeamCategory', selectedTeamCategory)
      } else {
        localStorage.removeItem('dailyplan-selectedTeamCategory')
      }
    }
  }, [selectedTeamCategory])

  // Close filter dropdown and editing cell when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close filter dropdown
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setActiveFilterColumn(null)
        setFilterDropdownPosition(null)
        setFilterSearchQuery('')
      }

      // Auto-save editing cell when clicking outside
      if (editingCell) {
        const target = event.target as Element
        const isInsideEditingCell = target.closest('[data-editing-cell]')

        if (!isInsideEditingCell) {
          handleCellSave()
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingCell])

  // Fetch column configuration on mount
  useEffect(() => {
    const fetchColumnConfig = async () => {
      try {
        setConfigLoading(true)
        setConfigError(null)
        
        const response = await fetch('/api/sheets/settings')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const result = await response.json()
        
        if (!result.data || !result.data.columns) {
          throw new Error('Invalid response format - missing columns data')
        }
        
        setColumnConfigs(result.data.columns || [])
        
      } catch (error) {
        setConfigError(error instanceof Error ? error.message : 'Failed to load settings')
        
        // Fallback: generate basic config from data
        if (data.length > 0) {
          const fallbackConfig = Object.keys(data[0]).map(key => ({
            name: key,
            type: 'string' as const,
            show: key !== rowIdColumn, // Hide RowId if present
            editable: key !== rowIdColumn,
            displayName: key.charAt(0).toUpperCase() + key.slice(1)
          }))
          setColumnConfigs(fallbackConfig)
        }
      } finally {
        setConfigLoading(false)
      }
    }

    fetchColumnConfig()
    
    // Fetch menu data for dropdowns
    const fetchMenuData = async () => {
      try {
        const response = await fetch('/api/sheets/menu')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const result = await response.json()
        
        if (result.success && result.data) {
          setMenuData(result.data)
        }
        
      } catch (error) {
        
        // Fallback to data matching sheet Menu structure exactly
        const fallbackMenuData = {
          'Activity': ['Survey', 'MOS', 'Installation', 'Integration', 'ATP / SIR', 'Rectification', 'Tagging', 'Dismantle', 'Inbound', 'Outbound', 'Troubleshoot', 'RF Audit', 'PLN Upgrade', 'Others'],
          'Team Category': ['Internal', 'External', 'B2B', 'SP'],
          'SOW': ['TE', 'MW', 'DISM', 'TSS', 'PLN'],
          'Vendor': ['HUAWEI', 'ZTE'],
          'Status': ['On Plan', 'On Going', 'Carry Over', 'Done', 'Failed', 'Idle', 'Off'],
          'Projects': ['IOH', 'XLS', 'TSEL']
        }
        
        setMenuData(fallbackMenuData)
      }
    }

    fetchMenuData()
  }, [data, rowIdColumn])

  // Update local data when props change and apply client-side date filtering
  useEffect(() => {
    setLocalData(data)
    // Don't notify parent here, let the client-side filtering handle it
  }, [data])

  // Extract unique activities, statuses, vendors, and team categories from data
  useEffect(() => {
    if (data.length > 0) {
      const activities = Array.from(new Set(
        data
          .map((row: any) => row.Activity || row.activity || '')
          .filter((activity: string) => activity && activity.trim() !== '')
      )) as string[]

      const statuses = Array.from(new Set(
        data
          .map((row: any) => row.Status || row.status || '')
          .filter((status: string) => status && status.trim() !== '')
      )) as string[]

      const vendors = Array.from(new Set(
        data
          .map((row: any) => row.Vendor || row.vendor || '')
          .filter((vendor: string) => vendor && vendor.trim() !== '')
      )) as string[]

      const teamCategories = Array.from(new Set(
        data
          .map((row: any) => row['Team Category'] || row.teamCategory || row.team_category || '')
          .filter((category: string) => category && category.trim() !== '')
      )) as string[]

      setUniqueActivities(activities.sort())
      setUniqueStatuses(statuses.sort())
      setUniqueVendors(vendors.sort())
      setUniqueTeamCategories(teamCategories.sort())
    }
  }, [data])

  // Parse Google Sheets date format (e.g., "04-Jan-2024")
  const parseSheetDate = (dateStr: string): Date | null => {
    if (!dateStr) return null
    
    try {
      // Handle format like "04-Jan-2024"
      const parts = dateStr.split('-')
      if (parts.length === 3) {
        const day = parseInt(parts[0])
        const monthMap: { [key: string]: number } = {
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        }
        const month = monthMap[parts[1].toLowerCase()]
        const year = parseInt(parts[2])
        
        if (!isNaN(day) && month !== undefined && !isNaN(year)) {
          return new Date(year, month, day)
        }
      }
      
      // Fallback to standard date parsing
      return new Date(dateStr)
    } catch {
      return null
    }
  }

  // Client-side date filtering for faster preset responses
  const filteredData = useMemo(() => {
    let result = data

    // Apply date filter
    if (dateFilter.startDate && dateFilter.endDate && data.length > 0) {
      const startDate = new Date(dateFilter.startDate)
      const endDate = new Date(dateFilter.endDate)

      result = result.filter(row => {
        const rowDate = parseSheetDate(row.Date)
        if (!rowDate) return false

        // Set time to start of day for proper comparison
        const rowDateOnly = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate())
        const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())

        return rowDateOnly >= startDateOnly && rowDateOnly <= endDateOnly
      })
    }

    // Apply status filter from parent (existing)
    if (statusFilter) {
      result = result.filter(row => row.Status === statusFilter)
    }

    // Apply activity filter from parent (existing)
    if (activityFilter) {
      result = result.filter(row => row.Activity === activityFilter)
    }

    // Apply new activity filter (from showFilters section)
    if (selectedActivity) {
      result = result.filter((row: any) => {
        const rowActivity = row.Activity || row.activity || ''
        return rowActivity === selectedActivity
      })
    }

    // Apply new status filter (from showFilters section)
    if (selectedStatus) {
      result = result.filter((row: any) => {
        const rowStatus = row.Status || row.status || ''
        return rowStatus === selectedStatus
      })
    }

    // Apply new vendor filter (from showFilters section)
    if (selectedVendor) {
      result = result.filter((row: any) => {
        const rowVendor = row.Vendor || row.vendor || ''
        return rowVendor === selectedVendor
      })
    }

    // Apply new team category filter (from showFilters section)
    if (selectedTeamCategory) {
      result = result.filter((row: any) => {
        const rowTeamCategory = row['Team Category'] || row.teamCategory || row.team_category || ''
        return rowTeamCategory === selectedTeamCategory
      })
    }

    return result
  }, [data, dateFilter, statusFilter, activityFilter, selectedActivity, selectedStatus, selectedVendor, selectedTeamCategory])

  // Update parent with client-side filtered data
  useEffect(() => {
    if (onFilteredDataChange) {
      onFilteredDataChange(filteredData)
    }
  }, [filteredData, onFilteredDataChange])

  // Check if date range is within default window (yesterday to tomorrow)
  const isWithinDefaultRange = (startDate: string, endDate: string) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    return start >= yesterday && end <= tomorrow
  }

  // Handle custom date input changes
  const handleDateInputChange = (type: 'startDate' | 'endDate', value: string) => {
    const newDateFilter = { ...dateFilter, [type]: value }
    setDateFilter(newDateFilter)
    
    // Only call server if date range is outside default window
    if (!isWithinDefaultRange(newDateFilter.startDate, newDateFilter.endDate)) {
      if (onDateFilterChange) {
        onDateFilterChange(newDateFilter)
      }
    }
    // If within default range, client-side filtering will handle it automatically
  }



  // Clear all filters
  const handleClearAllFilters = () => {
    // Clear column filters
    setColumnFilters([])

    // Clear global search
    setGlobalFilter('')

    // Clear active filter dropdown
    setActiveFilterColumn(null)
    setFilterDropdownPosition(null)

    // Clear advanced filters
    setSelectedActivity(null)
    setSelectedStatus(null)
    setSelectedVendor(null)
    setSelectedTeamCategory(null)

    // Clear from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dailyplan-columnFilters')
      localStorage.removeItem('dailyplan-globalFilter')
      localStorage.removeItem('dailyplan-selectedActivity')
      localStorage.removeItem('dailyplan-selectedStatus')
      localStorage.removeItem('dailyplan-selectedVendor')
      localStorage.removeItem('dailyplan-selectedTeamCategory')
    }
  }

  // Get visible column configs
  const visibleColumnConfigs = useMemo(() => {
    const visible = columnConfigs.filter(config => config.show)
    return visible
  }, [columnConfigs])

  // Get all column configs including hidden ones for operations
  const allColumnConfigs = useMemo(() => {
    return columnConfigs
  }, [columnConfigs])

  // Get unique values for a column
  const getUniqueColumnValues = (columnId: string) => {
    const values = new Set<string>()
    filteredData.forEach(row => {
      const value = row[columnId]
      if (value !== null && value !== undefined && value !== '') {
        values.add(String(value))
      }
    })
    return Array.from(values).sort()
  }

  // Handle column filter
  const handleColumnFilter = (columnId: string, filterType: 'empty' | 'notEmpty' | 'value' | 'reset' | 'toggleValue', value?: string) => {
    setColumnFilters(prev => {
      const existing = prev.filter(f => f.id !== columnId)
      const currentFilter = prev.find(f => f.id === columnId)
      
      if (filterType === 'reset') {
        setFilterSearchQuery('')
        return existing
      }
      
      if (filterType === 'empty') {
        setFilterSearchQuery('')
        setActiveFilterColumn(null)
        setFilterDropdownPosition(null)
        return [...existing, { 
          id: columnId, 
          value: 'FILTER_EMPTY'
        }]
      }
      
      if (filterType === 'notEmpty') {
        setFilterSearchQuery('')
        setActiveFilterColumn(null)
        setFilterDropdownPosition(null)
        return [...existing, { 
          id: columnId, 
          value: 'FILTER_NOT_EMPTY'
        }]
      }
      
      if (filterType === 'toggleValue' && value) {
        // Multi-selection logic
        const currentValue = currentFilter?.value
        
        // If current filter is special (empty/not empty), replace with new value
        if (currentValue === 'FILTER_EMPTY' || currentValue === 'FILTER_NOT_EMPTY') {
          return [...existing, { id: columnId, value: [value] }]
        }
        
        // If current filter is array, toggle the value
        if (Array.isArray(currentValue)) {
          const newValues = currentValue.includes(value)
            ? currentValue.filter(v => v !== value)
            : [...currentValue, value]
          
          // If no values left, remove filter
          if (newValues.length === 0) {
            return existing
          }
          
          return [...existing, { id: columnId, value: newValues }]
        }
        
        // If current filter is single value, convert to array and toggle
        if (currentValue) {
          const newValues = currentValue === value ? [] : [currentValue, value]
          if (newValues.length === 0) {
            return existing
          }
          return [...existing, { id: columnId, value: newValues }]
        }
        
        // No current filter, create new array filter
        return [...existing, { id: columnId, value: [value] }]
      }
      
      if (filterType === 'value' && value) {
        setFilterSearchQuery('')
        setActiveFilterColumn(null)
        setFilterDropdownPosition(null)
        return [...existing, { id: columnId, value }]
      }
      
      return existing
    })
  }

  // Custom filter function for columns
  const customColumnFilter = (row: any, columnId: string, filterValue: any) => {
    const cellValue = row.getValue(columnId)
    
    // Handle special filter types
    if (filterValue === 'FILTER_EMPTY') {
      return cellValue === null || cellValue === undefined || cellValue === ''
    }
    
    if (filterValue === 'FILTER_NOT_EMPTY') {
      return cellValue !== null && cellValue !== undefined && cellValue !== ''
    }
    
    // Handle array of values (multi-selection)
    if (Array.isArray(filterValue)) {
      return filterValue.some(val => String(cellValue) === String(val))
    }
    
    // Handle exact value match
    return String(cellValue) === String(filterValue)
  }

  // Get current filter for a column
  const getColumnFilterValue = useCallback((columnId: string): string | string[] | undefined => {
    const filter = columnFilters.find(f => f.id === columnId)
    return filter?.value as string | string[] | undefined
  }, [columnFilters])
  
  // Check if a value is selected in the filter
  const isValueSelected = (columnId: string, value: string): boolean => {
    const currentFilter = getColumnFilterValue(columnId)
    if (Array.isArray(currentFilter)) {
      return currentFilter.includes(value)
    }
    return currentFilter === value
  }
  
  // Get selected count for display
  const getSelectedCount = (columnId: string): number => {
    const currentFilter = getColumnFilterValue(columnId)
    if (Array.isArray(currentFilter)) {
      return currentFilter.length
    }
    if (currentFilter && currentFilter !== 'FILTER_EMPTY' && currentFilter !== 'FILTER_NOT_EMPTY') {
      return 1
    }
    return 0
  }

  // Get RowId column config
  const rowIdConfig = useMemo(() => {
    const config = allColumnConfigs.find(config => config.name === rowIdColumn)
    return config
  }, [allColumnConfigs, rowIdColumn])

  // Get row ID for a table row - use RowId column or fallback to index
  const getRowId = (rowIndex: number) => {
    const row = localData[rowIndex]
    if (!row) return null
    
    // Try to get RowId from data
    const rowIdValue = row[rowIdColumn]
    if (rowIdValue) {
      return rowIdValue.toString()
    }
    
    // Fallback: generate ID from row index and some unique data
    // This is safer than using just index in case of data shifts
    const fallbackId = `row_${rowIndex}_${row.Date || row['Site ID'] || rowIndex}`
    return fallbackId
  }

  // Handle cell editing
  const handleCellEdit = useCallback((rowData: any, columnId: string, currentValue: any) => {
    const rowId = rowData[rowIdColumn]?.toString()
    if (!rowId) {
      return
    }

    // Check if column is editable
    const columnConfig = columnConfigs.find(c => c.name === columnId)
    if (!columnConfig?.editable) {
      return
    }

    setEditingCell({ rowId, columnId, value: currentValue, oldValue: currentValue })
  }, [rowIdColumn, columnConfigs])

  const handleCellSave = useCallback(() => {
    if (!editingCell) return

    const { rowId, columnId, value, oldValue } = editingCell
    
    // Check if value actually changed
    if (value === oldValue) {
      setEditingCell(null)
      return
    }

    // Update local data immediately
    const newData = [...localData]
    const actualRowIndex = localData.findIndex(row => row[rowIdColumn]?.toString() === rowId)
    if (actualRowIndex !== -1) {
      newData[actualRowIndex] = { ...newData[actualRowIndex], [columnId]: value }
      setLocalData(newData)
    }

    // Store change for batch save
    const changeKey = `${rowId}-${columnId}`
    const newChanges = new Map(changedCells)
    newChanges.set(changeKey, { rowId, columnId, oldValue, newValue: value })
    setChangedCells(newChanges)
    
    setEditingCell(null)
  }, [editingCell, localData, rowIdColumn, changedCells])

  const handleCellCancel = useCallback(() => {
    setEditingCell(null)
  }, [])

  // Batch save all changes
  const handleBatchSave = async () => {
    if (changedCells.size === 0) return
    
    setIsSaving(true)
    const startTime = performance.now()
    
    try {
      if (onUpdateData) {
        // Process all changes in parallel using Promise.all for better performance
        const changes = Array.from(changedCells.entries())
        
        // Create array of update promises
        const updatePromises = changes.map(([changeKey, change]) => 
          onUpdateData(change.rowId, change.columnId, change.newValue, change.oldValue)
            .catch(error => {
              throw error // Re-throw to be caught by Promise.all
            })
        )
        
        // Execute all updates in parallel
        await Promise.all(updatePromises)
        
        const endTime = performance.now()
        const duration = ((endTime - startTime) / 1000).toFixed(2)
        
        setChangedCells(new Map()) // Clear changes after successful save
        
        // Notify parent to refresh data (without full page reload)
        if (onSaveComplete) {
          await onSaveComplete()
        }
      }
    } catch (error) {
      // Revert all changes on error
      setLocalData([...data])
      setChangedCells(new Map())
      
      // Show error to user
      alert('Failed to save some changes. All changes have been reverted.')
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel all changes and revert to original data
  const handleBatchCancel = () => {
    setLocalData([...data]) // Revert to original data
    setChangedCells(new Map()) // Clear all changes
    setEditingCell(null) // Cancel any active editing
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave()
    } else if (e.key === 'Escape') {
      handleCellCancel()
    }
  }, [handleCellSave, handleCellCancel])

  // Render cell content based on type
  const renderCellContent = useCallback((value: any, type: ColumnConfig['type']) => {
    if (!value && value !== 0) return ''
    
    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0
        }).format(Number(value) || 0)
      
      case 'date':
        try {
          if (!value) return ''
          const date = new Date(value)
          if (isNaN(date.getTime())) return value?.toString() || ''
          
          // Format DD-MMM-YYYY
          const day = String(date.getDate()).padStart(2, '0')
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const month = months[date.getMonth()]
          const year = date.getFullYear()
          
          return `${day}-${month}-${year}`
        } catch {
          return value?.toString() || ''
        }
      
      case 'time':
        return value?.toString() || ''
      
      case 'textarea':
        return (
          <div className="max-w-xs truncate" title={value?.toString()}>
            {value?.toString() || ''}
          </div>
        )
      
      default:
        return value?.toString() || ''
    }
  }, [])

  // Render edit input based on type
  const renderEditInput = useCallback((editState: EditingState, config: ColumnConfig) => {
    const commonProps = {
      value: editState.value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => 
        setEditingCell({ ...editState, value: e.target.value }),
      onKeyDown: handleKeyDown,
      className: "flex-1 px-1 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-left",
      autoFocus: true,
      dir: "ltr" as const,
      style: { 
        direction: 'ltr' as const, 
        textAlign: 'left' as const,
        unicodeBidi: 'bidi-override' as const 
      }
    }

    switch (config.type) {
      case 'list':
        // Get dropdown options from menu data with improved matching
        const columnAliases: Record<string, string[]> = {
          'Activity': ['Activity', 'activity', 'Activities', 'ACTIVITY'],
          'Status': ['Status', 'status', 'STATUS', 'Project Status'],
          'Vendor': ['Vendor', 'vendor', 'VENDOR', 'Vendors'],
          'Projects': ['Projects', 'Project', 'projects', 'project', 'PROJECT', 'PROJECTS'],
          'SOW': ['SOW', 'sow', 'Sow', 'Scope Of Work', 'ScopeOfWork'],
          'Team Category': ['Team Category', 'TeamCategory', 'Team', 'team', 'TEAM', 'Category', 'team_category', 'teamcategory']
        }
        
        let menuOptions: string[] = []
        
        // Try exact match first (case-sensitive)
        if (menuData[config.name] && menuData[config.name].length > 0) {
          menuOptions = menuData[config.name]
        } else {
          // Try using aliases for common columns
          const columnKey = Object.keys(columnAliases).find(key => 
            columnAliases[key].some(alias => 
              alias.toLowerCase() === config.name.toLowerCase()
            )
          )
          
          if (columnKey && menuData[columnKey]) {
            menuOptions = menuData[columnKey]
          } else {
            // Try case-insensitive match in menuData keys
            const menuKey = Object.keys(menuData).find(key => 
              key.toLowerCase() === config.name.toLowerCase()
            )
            
            if (menuKey && menuData[menuKey]) {
              menuOptions = menuData[menuKey]
            } else {
              // Try partial match (contains)
              const partialKey = Object.keys(menuData).find(key => 
                key.toLowerCase().includes(config.name.toLowerCase()) ||
                config.name.toLowerCase().includes(key.toLowerCase())
              )
              
              if (partialKey && menuData[partialKey]) {
                menuOptions = menuData[partialKey]
              }
            }
          }
        }
        
        return (
          <select
            {...commonProps}
            className={`${commonProps.className} cursor-pointer`}
          >
            <option value="">-- Select {config.displayName} --</option>
            {menuOptions.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
      
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={2}
            className={`${commonProps.className} resize-none`}
            dir="ltr"
            style={{ 
              ...commonProps.style,
              direction: 'ltr',
              textAlign: 'left',
              unicodeBidi: 'bidi-override',
              writingMode: 'horizontal-tb'
            }}
          />
        )
      
      case 'date':
        return <input {...commonProps} type="date" />
      
      case 'time':
        return <input {...commonProps} type="time" />
      
      case 'currency':
        return <input {...commonProps} type="number" step="1000" />
      
      default:
        return <input {...commonProps} type="text" />
    }
  }, [handleKeyDown, menuData])

  // Generate columns based on configuration
  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (filteredData.length === 0 || visibleColumnConfigs.length === 0) return []

    return visibleColumnConfigs.map((config) => ({
      accessorKey: config.name,
      filterFn: customColumnFilter,
      minSize: 80,
      size: 150,
      maxSize: 500,
      header: () => (
        <div className="flex items-center space-x-1 px-2 py-1 text-sm relative">
          <span className="font-medium">{config.displayName}</span>
          <div className="flex items-center space-x-1">
            {config.name === rowIdColumn && (
              <Shield className="h-3 w-3 text-blue-600" />
            )}
            {!config.editable && config.name !== rowIdColumn && (
              <Lock className="h-3 w-3 text-gray-400" />
            )}
            {!config.show && (
              <EyeOff className="h-3 w-3 text-gray-400" />
            )}
          </div>
        </div>
      ),
      cell: ({ getValue, row, column }) => {
        const originalValue = getValue()
        const rowIndex = row.index
        const columnId = column.id
        // Get rowId directly from the row data, not from index
        const actualRowData = row.original
        const rowId = actualRowData[rowIdColumn]?.toString() || `fallback_${row.index}`
        const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId
        // Check if this cell has been changed
        const changeKey = `${rowId}-${columnId}`
        const hasChanges = changedCells.has(changeKey)
        // Use new value if changed, otherwise use original
        const value = hasChanges ? changedCells.get(changeKey)?.newValue : originalValue
        const isIdColumn = columnId === rowIdColumn

        // ID Column (not editable)
        if (isIdColumn) {
          return (
            <div className="flex items-center space-x-1 px-1 py-0.5 text-xs">
              <Shield className="h-2 w-2 text-blue-600" />
              <span className="font-mono text-blue-800 bg-blue-50 px-1 py-0.5 rounded text-xs">
                {value?.toString() || 'NO_ID'}
              </span>
            </div>
          )
        }

        // Currently editing
        if (isEditing) {
          return (
            <div
              className="flex items-center space-x-1 px-1 py-0.5 text-xs"
              dir="ltr"
              style={{ direction: 'ltr', textAlign: 'left' }}
              data-editing-cell
            >
              {renderEditInput(editingCell, config)}
            </div>
          )
        }

        // Not editable column
        if (!config.editable) {
          // Special rendering for Status column with badge
          if (columnId === 'Status' && value) {
            return (
              <div className="flex items-center space-x-1 px-1 py-0.5 text-xs">
                <Lock className="h-2 w-2 text-gray-400" />
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded ${getStatusBadgeStyle(value.toString())}`}>
                  {value.toString()}
                </span>
              </div>
            )
          }
          
          // Special rendering for Activity column with badge
          if (columnId === 'Activity' && value) {
            return (
              <div className="flex items-center space-x-1 px-1 py-0.5 text-xs">
                <Lock className="h-2 w-2 text-gray-400" />
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded ${getActivityBadgeStyle(value.toString())}`}>
                  {value.toString()}
                </span>
              </div>
            )
          }
          
          return (
            <div className="flex items-center space-x-1 px-1 py-0.5 text-xs">
              <Lock className="h-2 w-2 text-gray-400" />
              <div className="text-gray-700">
                {renderCellContent(value, config.type)}
              </div>
            </div>
          )
        }

        // No row ID - show warning but still allow editing with fallback
        if (!rowId) {
          return (
            <div className="group flex items-center justify-between cursor-pointer hover:bg-amber-50 px-1 py-0.5 rounded transition-colors min-h-[1rem] text-xs"
                 onDoubleClick={() => handleCellEdit(actualRowData, columnId, value)}
                 title="No RowId found - using fallback identifier. Double-click to edit.">
              <div className="flex items-center space-x-1">
                <AlertTriangle className="h-2 w-2 text-amber-600" />
                <div className="flex-1 min-w-0 text-amber-700">
                  {renderCellContent(value, config.type)}
                </div>
              </div>
              <Edit2 className="h-2 w-2 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
            </div>
          )
        }

        // Editable cell
        const cellClasses = `group flex items-center justify-between cursor-pointer px-1 py-0.5 rounded transition-colors min-h-[1rem] text-xs ${
          hasChanges 
            ? 'bg-orange-50 border border-orange-200 hover:bg-orange-100' 
            : 'hover:bg-gray-50'
        }`
        
        // Special rendering for Status column with badge
        if (columnId === 'Status' && value) {
          return (
            <div 
              className={cellClasses}
              onDoubleClick={() => handleCellEdit(actualRowData, columnId, value)}
              title={hasChanges ? "Modified - not saved yet. Double-click to edit." : "Double-click to edit"}
            >
              <div className="flex-1 min-w-0 flex items-center space-x-1">
                {hasChanges && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0" />}
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded ${getStatusBadgeStyle(value.toString())}`}>
                  {value.toString()}
                </span>
              </div>
              <Edit2 className="h-2 w-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
            </div>
          )
        }
        
        // Special rendering for Activity column with badge
        if (columnId === 'Activity' && value) {
          return (
            <div 
              className={cellClasses}
              onDoubleClick={() => handleCellEdit(actualRowData, columnId, value)}
              title={hasChanges ? "Modified - not saved yet. Double-click to edit." : "Double-click to edit"}
            >
              <div className="flex-1 min-w-0 flex items-center space-x-1">
                {hasChanges && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0" />}
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded ${getActivityBadgeStyle(value.toString())}`}>
                  {value.toString()}
                </span>
              </div>
              <Edit2 className="h-2 w-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
            </div>
          )
        }
        
        return (
          <div 
            className={cellClasses}
            onDoubleClick={() => handleCellEdit(actualRowData, columnId, value)}
            title={hasChanges ? "Modified - not saved yet. Double-click to edit." : "Double-click to edit"}
          >
            <div className="flex-1 min-w-0 flex items-center space-x-1">
              {hasChanges && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0" />}
              <div className={hasChanges ? 'font-medium text-orange-900' : ''}>
                {renderCellContent(value, config.type)}
              </div>
            </div>
            <Edit2 className="h-2 w-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
          </div>
        )
      },
    }))
  }, [filteredData, visibleColumnConfigs, editingCell, rowIdColumn, changedCells, getColumnFilterValue, handleCellEdit, handleCellSave, renderEditInput, handleCellCancel, renderCellContent])

  const table = useReactTable({
    data: filteredData,
    columns,
    defaultColumn: {
      minSize: 80,
      size: 150,
      maxSize: 500,
    },
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnSizing,
      columnPinning,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
    enableColumnResizing: false,
    enablePinning: true,
    onColumnPinningChange: setColumnPinning,
  })

  // Update parent with table filtered data (including search filter)
  useEffect(() => {
    if (onFilteredDataChange && table) {
      const tableFilteredData = table.getFilteredRowModel().rows.map(row => row.original)
      onFilteredDataChange(tableFilteredData)
    }
  }, [table, onFilteredDataChange])

  if (configLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Settings className="h-8 w-8 mx-auto text-blue-600 animate-spin mb-2" />
          <p className="text-gray-600">Loading column configuration...</p>
        </div>
      </div>
    )
  }

  if (configError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center bg-red-50 border border-red-200 rounded-lg p-6">
          <AlertTriangle className="h-8 w-8 mx-auto text-red-600 mb-2" />
          <h3 className="font-medium text-red-800 mb-2">Configuration Error</h3>
          <p className="text-red-600 text-sm">{configError}</p>
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
            {/* Quick Presets */}
            <div className="flex space-x-1">
              <button
                onClick={() => {
                  const today = new Date()
                  const todayStr = today.toISOString().split('T')[0]
                  setDateFilter({ startDate: todayStr, endDate: todayStr })
                  if (onDateFilterChange) {
                    onDateFilterChange({ startDate: todayStr, endDate: todayStr })
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                title="Filter to today's records"
              >
                Today
              </button>
            </div>

            {/* Custom Date Range */}
            <div className="flex items-center space-x-2 border-l border-gray-300 pl-3">
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => handleDateInputChange('startDate', e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
              />
              <span className="text-xs text-gray-500 font-medium">to</span>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => handleDateInputChange('endDate', e.target.value)}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
              />
            </div>

            {/* Action Buttons: Import, Export, Refresh */}
            {(onImport || onExport || onRefresh) && (
              <div className="flex items-center space-x-2 border-l border-gray-300 pl-3">
                {onImport && (
                  <button
                    onClick={onImport}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 border border-transparent rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200"
                    title="Import Excel file"
                  >
                    <svg className="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import
                  </button>
                )}
                {onExport && (
                  <button
                    onClick={async () => {
                      setExporting(true)
                      try {
                        await onExport()
                      } finally {
                        setExporting(false)
                      }
                    }}
                    disabled={exporting}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export filtered data to Excel"
                  >
                    <Download className={`h-3.5 w-3.5 mr-1.5 ${exporting ? 'animate-bounce' : ''}`} />
                    {exporting ? 'Exporting...' : 'Export'}
                  </button>
                )}
                {onRefresh && (
                  <button
                    onClick={async () => {
                      if (onRefresh) await onRefresh()
                    }}
                    disabled={refreshing}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh data from Google Sheets"
                  >
                    <svg className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                  </button>
                )}
              </div>
            )}

            {/* Save/Cancel Buttons */}
            {changedCells.size > 0 && (
              <div className="flex items-center space-x-1 border-l border-gray-300 pl-3">
                <button
                  onClick={handleBatchSave}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white border border-green-600 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save ({changedCells.size})</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleBatchCancel}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-600 text-white border border-gray-600 rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all duration-200 flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
                placeholder="Search all columns..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors w-80"
              />
              {(globalFilter || columnFilters.length > 0) && (
                <button
                  onClick={handleClearAllFilters}
                  className="px-3 py-2 text-sm font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all duration-200 flex items-center space-x-2 shadow-sm"
                  title="Clear all filters"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Clear</span>
                </button>
              )}
            </div>


          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto relative">
        {/* Loading Overlay for Table Body */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-40 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent mb-2"></div>
              <p className="text-sm text-gray-600 font-medium">Refreshing data...</p>
            </div>
          </div>
        )}
        <table className="table" style={{ width: table.getTotalSize(), position: 'relative', borderSpacing: 0, borderCollapse: 'collapse' }}>
          <thead className="table-header sticky top-0 z-30">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} style={{ width: '100%' }}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id
                  const isPinned = header.column.getIsPinned()
                  const isFilterActive = activeFilterColumn === columnId
                  const currentFilter = getColumnFilterValue(columnId)
                  const hasFilter = !!currentFilter
                  
                  // Check if this is the last left pinned column or first right pinned column (for shadow effect)
                  const isLastLeftPinnedColumn = 
                    isPinned === 'left' && 
                    header.column.getPinnedIndex() === table.getLeftLeafColumns().filter(col => col.getIsPinned()).length - 1
                  
                  const isFirstRightPinnedColumn = 
                    isPinned === 'right' && 
                    header.column.getPinnedIndex() === 0
                  
                  const isFirstLeftPinnedColumn = 
                    isPinned === 'left' && 
                    header.column.getPinnedIndex() === 0
                  
                  const isLastRightPinnedColumn = 
                    isPinned === 'right' && 
                    header.column.getPinnedIndex() === table.getRightLeafColumns().filter(col => col.getIsPinned()).length - 1
                  
                  // Determine padding based on position in pinned group
                  let paddingLeft = '0.375rem'
                  let paddingRight = '0.375rem'
                  
                  if (isPinned === 'left') {
                    paddingLeft = isFirstLeftPinnedColumn ? '0.375rem' : '0.125rem'
                    paddingRight = isLastLeftPinnedColumn ? '0.375rem' : '0.125rem'
                  } else if (isPinned === 'right') {
                    paddingLeft = isFirstRightPinnedColumn ? '0.375rem' : '0.125rem'
                    paddingRight = isLastRightPinnedColumn ? '0.375rem' : '0.125rem'
                  }
                  
                  return (
                    <th
                      key={header.id}
                      className="table-header-cell select-none relative"
                      style={{ 
                        width: header.getSize(),
                        borderRight: isPinned === 'right' ? 'none' : (isPinned === 'left' ? 'none' : '1px solid #e5e7eb'),
                        borderLeft: 'none',
                        position: isPinned ? 'sticky' : 'relative',
                        left: isPinned === 'left' ? `${header.column.getStart('left')}px` : undefined,
                        right: isPinned === 'right' ? `${header.column.getAfter('right')}px` : undefined,
                        zIndex: isPinned ? 31 : 30,
                        backgroundColor: '#f9fafb',
                        boxShadow: isLastLeftPinnedColumn 
                          ? '2px 0 4px -1px rgba(0, 0, 0, 0.1)' 
                          : isFirstRightPinnedColumn
                          ? '-2px 0 4px -1px rgba(0, 0, 0, 0.1)'
                          : undefined,
                        margin: 0,
                        paddingTop: '0.125rem',
                        paddingBottom: '0.125rem',
                        paddingLeft,
                        paddingRight,
                      }}
                    >
                      <div 
                        className="flex items-center justify-between"
                        style={{ backgroundColor: 'transparent' }}
                      >
                        <div 
                          className="flex items-center space-x-1 cursor-pointer flex-1"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="text-gray-400">
                            {{
                              asc: ' ↑',
                              desc: ' ↓',
                            }[header.column.getIsSorted() as string] ?? ' ↕'}
                          </span>
                        </div>
                        
                        {/* Filter Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isFilterActive) {
                              setActiveFilterColumn(null)
                              setFilterDropdownPosition(null)
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setFilterDropdownPosition({
                                top: rect.bottom + 4,
                                left: rect.left
                              })
                              setActiveFilterColumn(columnId)
                            }
                          }}
                          className={`p-0.5 rounded hover:bg-gray-200 ${hasFilter ? 'text-blue-600' : 'text-gray-400'}`}
                          title="Filter column"
                        >
                          <Filter className="h-3 w-3" />
                        </button>
                      </div>
                      

                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="table-body">
            {table.getRowModel().rows.map((row, rowIndex) => {
              const isLastRow = rowIndex === table.getRowModel().rows.length - 1
              
              return (
              <tr key={row.id} className="table-row" style={{ borderBottom: isLastRow ? '1px solid #e5e7eb' : undefined }}>
                {row.getVisibleCells().map((cell) => {
                  const isPinned = cell.column.getIsPinned()
                  
                  // Check if this is the last left pinned column or first right pinned column (for shadow effect)
                  const isLastLeftPinnedColumn = 
                    isPinned === 'left' && 
                    cell.column.getPinnedIndex() === table.getLeftLeafColumns().filter(col => col.getIsPinned()).length - 1
                  
                  const isFirstRightPinnedColumn = 
                    isPinned === 'right' && 
                    cell.column.getPinnedIndex() === 0
                  
                  const isFirstLeftPinnedColumn = 
                    isPinned === 'left' && 
                    cell.column.getPinnedIndex() === 0
                  
                  const isLastRightPinnedColumn = 
                    isPinned === 'right' && 
                    cell.column.getPinnedIndex() === table.getRightLeafColumns().filter(col => col.getIsPinned()).length - 1
                  
                  // Determine padding based on position in pinned group
                  let paddingLeft = '0.5rem'
                  let paddingRight = '0.5rem'
                  
                  if (isPinned === 'left') {
                    paddingLeft = isFirstLeftPinnedColumn ? '0.5rem' : '0.25rem'
                    paddingRight = isLastLeftPinnedColumn ? '0.5rem' : '0.25rem'
                  } else if (isPinned === 'right') {
                    paddingLeft = isFirstRightPinnedColumn ? '0.5rem' : '0.25rem'
                    paddingRight = isLastRightPinnedColumn ? '0.5rem' : '0.25rem'
                  }
                  
                  return (
                    <td 
                      key={cell.id} 
                      className="table-cell"
                      style={{ 
                        width: cell.column.getSize(),
                        borderRight: isPinned === 'right' ? 'none' : (isPinned === 'left' ? 'none' : '1px solid #e5e7eb'),
                        borderLeft: 'none',
                        position: isPinned ? 'sticky' : 'relative',
                        left: isPinned === 'left' ? `${cell.column.getStart('left')}px` : undefined,
                        right: isPinned === 'right' ? `${cell.column.getAfter('right')}px` : undefined,
                        zIndex: isPinned ? 1 : 0,
                        backgroundColor: isPinned ? '#ffffff' : '#ffffff',
                        boxShadow: isLastLeftPinnedColumn 
                          ? '2px 0 4px -1px rgba(0, 0, 0, 0.1)' 
                          : isFirstRightPinnedColumn
                          ? '-2px 0 4px -1px rgba(0, 0, 0, 0.1)'
                          : undefined,
                        margin: 0,
                        paddingTop: '0.375rem',
                        paddingBottom: '0.375rem',
                        paddingLeft,
                        paddingRight,
                      }}
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
      <div className="flex-none flex items-center justify-between px-3 py-2 bg-gray-50 border-t">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>

        <span className="text-sm text-gray-600">
          {data.length.toLocaleString()} records
        </span>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
          >
            {[10, 20, 30, 40, 50].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </div>
      </div>
      

      
      {/* Filter Dropdown Portal - Outside table to prevent column resize */}
      {activeFilterColumn && filterDropdownPosition && (
        <div 
          ref={filterDropdownRef}
          className="fixed bg-white border border-gray-300 rounded-lg shadow-2xl z-[100] w-[280px]"
          onClick={(e) => e.stopPropagation()}
          style={{
            top: `${filterDropdownPosition.top}px`,
            left: `${filterDropdownPosition.left}px`,
          }}
        >
          {/* Header with Search */}
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
          
          {/* Options List */}
          <div className="max-h-[350px] overflow-y-auto py-2">
            {/* Date Presets - Only show for Date column */}
            {activeFilterColumn === 'Date' && (
              <div className="px-2 mb-2">
                <div className="text-xs font-semibold text-gray-500 px-2 py-1 mb-1">Quick Filters</div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => {
                      // Find today's date in the actual data format
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      
                      // Get unique values and find matching date
                      const allDates = getUniqueColumnValues(activeFilterColumn)
                      const matchingDate = allDates.find(dateStr => {
                        const parsedDate = new Date(dateStr)
                        parsedDate.setHours(0, 0, 0, 0)
                        return parsedDate.getTime() === today.getTime()
                      })
                      
                      if (matchingDate) {
                        handleColumnFilter(activeFilterColumn, 'toggleValue', matchingDate)
                      }
                    }}
                    className="px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      const yesterday = new Date()
                      yesterday.setDate(yesterday.getDate() - 1)
                      yesterday.setHours(0, 0, 0, 0)
                      
                      const allDates = getUniqueColumnValues(activeFilterColumn)
                      const matchingDate = allDates.find(dateStr => {
                        const parsedDate = new Date(dateStr)
                        parsedDate.setHours(0, 0, 0, 0)
                        return parsedDate.getTime() === yesterday.getTime()
                      })
                      
                      if (matchingDate) {
                        handleColumnFilter(activeFilterColumn, 'toggleValue', matchingDate)
                      }
                    }}
                    className="px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    Yesterday
                  </button>
                  <button
                    onClick={() => {
                      // This week (Monday - Sunday)
                      const now = new Date()
                      const dayOfWeek = now.getDay()
                      const monday = new Date(now)
                      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
                      monday.setHours(0, 0, 0, 0)
                      
                      const sunday = new Date(monday)
                      sunday.setDate(monday.getDate() + 6)
                      
                      // Find all dates in this week from actual data
                      const allDates = getUniqueColumnValues(activeFilterColumn)
                      const weekDates = allDates.filter(dateStr => {
                        const parsedDate = new Date(dateStr)
                        parsedDate.setHours(0, 0, 0, 0)
                        return parsedDate >= monday && parsedDate <= sunday
                      })
                      
                      if (weekDates.length > 0) {
                        setColumnFilters(prev => prev.filter(f => f.id !== activeFilterColumn))
                        setColumnFilters(prev => [...prev, { id: activeFilterColumn, value: weekDates }])
                      }
                    }}
                    className="px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    This Week
                  </button>
                  <button
                    onClick={() => {
                      // This month
                      const now = new Date()
                      const year = now.getFullYear()
                      const month = now.getMonth()
                      const firstDay = new Date(year, month, 1)
                      firstDay.setHours(0, 0, 0, 0)
                      const lastDay = new Date(year, month + 1, 0)
                      lastDay.setHours(23, 59, 59, 999)
                      
                      // Find all dates in this month from actual data
                      const allDates = getUniqueColumnValues(activeFilterColumn)
                      const monthDates = allDates.filter(dateStr => {
                        const parsedDate = new Date(dateStr)
                        parsedDate.setHours(0, 0, 0, 0)
                        return parsedDate >= firstDay && parsedDate <= lastDay
                      })
                      
                      if (monthDates.length > 0) {
                        setColumnFilters(prev => prev.filter(f => f.id !== activeFilterColumn))
                        setColumnFilters(prev => [...prev, { id: activeFilterColumn, value: monthDates }])
                      }
                    }}
                    className="px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    This Month
                  </button>
                </div>
                <div className="border-t border-gray-200 my-2"></div>
              </div>
            )}
            
            {/* Special Filters - Hide for Date column */}
            {activeFilterColumn !== 'Date' && (
              <>
                <div className="px-2 mb-2 space-y-1">
                  <button
                    onClick={() => handleColumnFilter(activeFilterColumn, 'empty')}
                    className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-md flex items-center space-x-2 transition-colors group"
                  >
                    <span className="text-gray-400 group-hover:text-gray-600">⊘</span>
                    <span className="font-medium">(Empty)</span>
                  </button>
                  <button
                    onClick={() => handleColumnFilter(activeFilterColumn, 'notEmpty')}
                    className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-md flex items-center space-x-2 transition-colors group"
                  >
                    <span className="text-gray-400 group-hover:text-gray-600">✓</span>
                    <span className="font-medium">(Not Empty)</span>
                  </button>
                </div>
                
                {/* Divider */}
                {getUniqueColumnValues(activeFilterColumn).length > 0 && (
                  <div className="border-t border-gray-200 my-2"></div>
                )}
                
                {/* Value Options */}
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
                          <span className={`text-sm ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                            {isSelected ? '☑' : '☐'}
                          </span>
                          <span className={`truncate flex-1 ${isSelected ? 'text-blue-900 font-semibold' : 'text-gray-700'}`}>
                            {value}
                          </span>
                        </button>
                      )
                    })}
                  
                  {/* No Results Message */}
                  {filterSearchQuery && getUniqueColumnValues(activeFilterColumn)
                    .filter(value => value.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                    .length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-8">
                      <div className="text-2xl mb-2">🔍</div>
                      <div>No matching values</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          
          {/* Footer Actions */}
          <div className="p-2 border-t border-gray-200 bg-gray-50 flex gap-2">
            {getColumnFilterValue(activeFilterColumn) && (
              <button
                onClick={() => handleColumnFilter(activeFilterColumn, 'reset')}
                className="flex-1 px-3 py-2 text-xs font-medium text-red-600 bg-white hover:bg-red-50 border border-red-200 rounded-md transition-colors flex items-center justify-center gap-1.5"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            )}
            <button
              onClick={() => {
                setActiveFilterColumn(null)
                setFilterDropdownPosition(null)
                setFilterSearchQuery('')
              }}
              className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

