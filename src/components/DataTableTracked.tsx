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
} from '@tanstack/react-table'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Check, X, Edit2, Clock, AlertCircle, Filter, Calendar, Activity as ActivityIcon } from 'lucide-react'

interface DataTableProps {
  data: Record<string, any>[]
  onUpdateData?: (rowIndex: number, columnId: string, value: any, oldValue: any) => Promise<void>
  showFilters?: boolean
}

interface EditingState {
  rowIndex: number
  columnId: string
  value: any
  oldValue: any
}

interface CellStatus {
  rowIndex: number
  columnId: string
  status: 'updating' | 'success' | 'error'
  timestamp: number
}

export function DataTableWithTracking({ data, onUpdateData, showFilters = false }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [editingCell, setEditingCell] = useState<EditingState | null>(null)
  const [localData, setLocalData] = useState(data)
  const [cellStatuses, setCellStatuses] = useState<CellStatus[]>([])

  // Filter states
  const [selectedActivity, setSelectedActivity] = useState<string>('All')
  const [selectedStatus, setSelectedStatus] = useState<string>('All')
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('All')
  const [activities, setActivities] = useState<string[]>(['All'])
  const [statuses, setStatuses] = useState<string[]>(['All'])

  // Update local data when props change
  useEffect(() => {
    setLocalData(data)
  }, [data])

  // Extract unique activities and statuses from data
  useEffect(() => {
    if (data.length > 0) {
      const uniqueActivities = Array.from(new Set(
        data
          .map((row: any) => row.Activity || row.activity || '')
          .filter((activity: string) => activity && activity.trim() !== '')
      )) as string[]

      const uniqueStatuses = Array.from(new Set(
        data
          .map((row: any) => row.Status || row.status || '')
          .filter((status: string) => status && status.trim() !== '')
      )) as string[]

      setActivities(['All', ...uniqueActivities.sort()])
      setStatuses(['All', ...uniqueStatuses.sort()])
    }
  }, [data])

  // Get cell status
  const getCellStatus = useCallback((rowIndex: number, columnId: string) => {
    return cellStatuses.find(s => s.rowIndex === rowIndex && s.columnId === columnId)
  }, [cellStatuses])

  // Update cell status
  const updateCellStatus = useCallback((rowIndex: number, columnId: string, status: CellStatus['status']) => {
    setCellStatuses(prev => {
      const filtered = prev.filter(s => !(s.rowIndex === rowIndex && s.columnId === columnId))
      if (status === 'success') {
        // Remove success status after 2 seconds
        setTimeout(() => {
          setCellStatuses(current => 
            current.filter(s => !(s.rowIndex === rowIndex && s.columnId === columnId))
          )
        }, 2000)
      }
      return [...filtered, { rowIndex, columnId, status, timestamp: Date.now() }]
    })
  }, [])

  // Handle cell editing
  const handleCellEdit = useCallback((rowIndex: number, columnId: string, currentValue: any) => {
    setEditingCell({ rowIndex, columnId, value: currentValue, oldValue: currentValue })
  }, [])

  const handleCellSave = useCallback(async () => {
    if (!editingCell) return

    const { rowIndex, columnId, value, oldValue } = editingCell

    // Update local data immediately for UI responsiveness
    const newData = [...localData]
    newData[rowIndex] = { ...newData[rowIndex], [columnId]: value }
    setLocalData(newData)

    // Set updating status
    updateCellStatus(rowIndex, columnId, 'updating')

    // Call API to update backend
    if (onUpdateData) {
      try {
        await onUpdateData(rowIndex, columnId, value, oldValue)
        updateCellStatus(rowIndex, columnId, 'success')
      } catch (error) {
        // Revert local changes on error
        setLocalData([...data])
        updateCellStatus(rowIndex, columnId, 'error')
      }
    }

    setEditingCell(null)
  }, [editingCell, localData, data, onUpdateData, updateCellStatus])

  const handleCellCancel = useCallback(() => {
    setEditingCell(null)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSave()
    } else if (e.key === 'Escape') {
      handleCellCancel()
    }
  }, [handleCellSave, handleCellCancel])

  // Filter data based on selected filters
  const filteredData = useMemo(() => {
    let filtered = localData

    // Apply activity filter
    if (selectedActivity !== 'All') {
      filtered = filtered.filter((row: any) => {
        const rowActivity = row.Activity || row.activity || ''
        return rowActivity === selectedActivity
      })
    }

    // Apply status filter
    if (selectedStatus !== 'All') {
      filtered = filtered.filter((row: any) => {
        const rowStatus = row.Status || row.status || ''
        return rowStatus === selectedStatus
      })
    }

    // Apply date filter
    if (selectedDateFilter !== 'All') {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      if (selectedDateFilter === 'Today') {
        filtered = filtered.filter((row: any) => {
          if (!row.Date) return false
          try {
            const rowDate = new Date(row.Date)
            const rowDateStr = rowDate.toISOString().split('T')[0]
            return rowDateStr === todayStr
          } catch (e) {
            return false
          }
        })
      } else if (selectedDateFilter === 'Tomorrow') {
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]

        filtered = filtered.filter((row: any) => {
          if (!row.Date) return false
          try {
            const rowDate = new Date(row.Date)
            const rowDateStr = rowDate.toISOString().split('T')[0]
            return rowDateStr === tomorrowStr
          } catch (e) {
            return false
          }
        })
      }
    }

    return filtered
  }, [localData, selectedActivity, selectedStatus, selectedDateFilter])

  // Generate columns from data
  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (filteredData.length === 0) return []

    const keys = Object.keys(filteredData[0])
    return keys.map((key) => ({
      accessorKey: key,
      header: key.charAt(0).toUpperCase() + key.slice(1),
      cell: ({ getValue, row, column }) => {
        const value = getValue()
        const rowIndex = row.index
        const columnId = column.id
        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnId === columnId
        const cellStatus = getCellStatus(rowIndex, columnId)

        if (isEditing) {
          return (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editingCell.value}
                onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                onKeyDown={handleKeyDown}
                className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleCellSave}
                className="p-1 text-green-600 hover:bg-green-100 rounded"
                title="Save"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={handleCellCancel}
                className="p-1 text-red-600 hover:bg-red-100 rounded"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        }

        // Cell with status indicators
        return (
          <div
            className={`
              group flex items-center justify-between cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors
              ${cellStatus?.status === 'updating' ? 'bg-yellow-50' : ''}
              ${cellStatus?.status === 'success' ? 'bg-green-50' : ''}
              ${cellStatus?.status === 'error' ? 'bg-red-50' : ''}
            `}
            onClick={() => handleCellEdit(rowIndex, columnId, value)}
          >
            <span className="flex-1 min-w-0 truncate">
              {value?.toString() || ''}
            </span>
            <div className="flex items-center space-x-1 ml-2">
              {cellStatus?.status === 'updating' && (
                <span title="Updating...">
                  <Clock className="h-3 w-3 text-yellow-600 animate-pulse" />
                </span>
              )}
              {cellStatus?.status === 'success' && (
                <span title="Updated successfully">
                  <Check className="h-3 w-3 text-green-600" />
                </span>
              )}
              {cellStatus?.status === 'error' && (
                <span title="Update failed">
                  <AlertCircle className="h-3 w-3 text-red-600" />
                </span>
              )}
              <Edit2 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )
      },
    }))
  }, [filteredData, editingCell, getCellStatus, handleCellSave, handleKeyDown, handleCellCancel, handleCellEdit])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  if (localData.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data available</p>
      </div>
    )
  }

  const dateFilterOptions = ['All', 'Today', 'Tomorrow']

  return (
    <div className="h-full flex flex-col">
      {/* Filters Section - Fixed */}
      {showFilters && (
        <div className="flex-none bg-white border-b border-gray-200 p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>

            {/* Activity Filter */}
            <div className="flex items-center gap-2">
              <ActivityIcon className="h-4 w-4 text-gray-600" />
              <select
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {activities.map((activity) => (
                  <option key={activity} value={activity}>
                    {activity === 'All' ? 'All Activities' : activity}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-gray-600" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status === 'All' ? 'All Statuses' : status}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              <select
                value={selectedDateFilter}
                onChange={(e) => setSelectedDateFilter(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {dateFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'All' ? 'All Dates' : option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Search Filter - Fixed */}
      <div className="flex-none flex items-center justify-between p-4 bg-gray-50 border-b">
        <div className="flex-1 mr-4">
          <input
            type="text"
            placeholder="Search all columns..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="form-input"
          />
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="text-gray-600">
            {table.getFilteredRowModel().rows.length} of {filteredData.length} rows
          </div>
          {cellStatuses.length > 0 && (
            <div className="flex items-center space-x-2">
              {cellStatuses.filter(s => s.status === 'updating').length > 0 && (
                <div className="flex items-center text-yellow-600">
                  <Clock className="h-4 w-4 mr-1" />
                  {cellStatuses.filter(s => s.status === 'updating').length} updating
                </div>
              )}
              {cellStatuses.filter(s => s.status === 'error').length > 0 && (
                <div className="flex items-center text-red-600">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {cellStatuses.filter(s => s.status === 'error').length} errors
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table - Scrollable */}
      <div className="flex-1 overflow-auto">
        <table className="table">
          <thead className="table-header sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="table-header-cell cursor-pointer select-none bg-gray-50"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center space-x-1">
                      <span>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </span>
                      <span className="text-gray-400">
                        {{
                          asc: ' ↑',
                          desc: ' ↓',
                        }[header.column.getIsSorted() as string] ?? ' ↕'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="table-body">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="table-row">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="table-cell">
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination - Fixed */}
      <div className="flex-none flex items-center justify-between p-4 bg-gray-50 border-t">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="form-input w-20"
          >
            {[10, 20, 30, 40, 50].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

// Export with original name for backward compatibility
export { DataTableWithTracking as DataTable }