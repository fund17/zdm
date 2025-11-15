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
import { Check, X, Edit2, Shield, AlertTriangle } from 'lucide-react'

interface DataTableProps {
  data: Record<string, any>[]
  onUpdateData?: (rowId: string, columnId: string, value: any, oldValue: any) => Promise<void>
  rowIdColumn?: string // Which column contains unique row identifiers
}

interface EditingState {
  rowId: string
  columnId: string
  value: any
  oldValue: any
}

export function SafeDataTable({ data, onUpdateData, rowIdColumn = 'id' }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [editingCell, setEditingCell] = useState<EditingState | null>(null)
  const [localData, setLocalData] = useState(data)

  // Update local data when props change
  useEffect(() => {
    setLocalData(data)
  }, [data])

  // Validate data has required ID column
  const hasValidRowIds = useMemo(() => {
    if (localData.length === 0) return false
    return localData.every(row => row[rowIdColumn] !== undefined && row[rowIdColumn] !== null && row[rowIdColumn] !== '')
  }, [localData, rowIdColumn])

  // Get unique row ID for a table row
  const getRowId = useCallback((rowIndex: number) => {
    return localData[rowIndex]?.[rowIdColumn]?.toString()
  }, [localData, rowIdColumn])

  // Handle cell editing
  const handleCellEdit = useCallback((rowIndex: number, columnId: string, currentValue: any) => {
    const rowId = getRowId(rowIndex)
    if (!rowId) {
      console.error('Cannot edit: Row ID not found', { rowIndex, rowIdColumn })
      return
    }
    setEditingCell({ rowId, columnId, value: currentValue, oldValue: currentValue })
  }, [getRowId, rowIdColumn])

  const handleCellSave = useCallback(async () => {
    if (!editingCell) return

    const { rowId, columnId, value, oldValue } = editingCell

    // Find current row index by ID (it might have changed!)
    const currentRowIndex = localData.findIndex(row => row[rowIdColumn]?.toString() === rowId)
    if (currentRowIndex === -1) {
      console.error('Row not found by ID', { rowId, rowIdColumn })
      setEditingCell(null)
      return
    }

    // Update local data immediately for UI responsiveness
    const newData = [...localData]
    newData[currentRowIndex] = { ...newData[currentRowIndex], [columnId]: value }
    setLocalData(newData)

    // Call API to update backend with ROW ID (not index!)
    if (onUpdateData) {
      try {
        await onUpdateData(rowId, columnId, value, oldValue)
      } catch (error) {
        // Revert local changes on error
        setLocalData([...data])
        console.error('❌ Safe cell update failed:', error)
      }
    }

    setEditingCell(null)
  }, [editingCell, localData, rowIdColumn, onUpdateData, data])

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

  // Generate columns from data
  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (localData.length === 0) return []
    
    const keys = Object.keys(localData[0])
    return keys.map((key) => ({
      accessorKey: key,
      header: () => {
        const isIdColumn = key === rowIdColumn
        return (
          <div className="flex items-center space-x-1">
            <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
            {isIdColumn && (
              <span title="Row Identifier Column">
                <Shield className="h-3 w-3 text-blue-600" />
              </span>
            )}
          </div>
        )
      },
      cell: ({ getValue, row, column }) => {
        const value = getValue()
        const rowIndex = row.index
        const columnId = column.id
        const rowId = getRowId(rowIndex)
        const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId
        const isIdColumn = columnId === rowIdColumn

        // Don't allow editing the ID column
        if (isIdColumn) {
          return (
            <div className="flex items-center space-x-2 px-2 py-1">
              <Shield className="h-3 w-3 text-blue-600" />
              <span className="font-mono text-sm text-blue-800 bg-blue-50 px-2 py-1 rounded">
                {value?.toString() || 'NO_ID'}
              </span>
            </div>
          )
        }

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
                title="Save (Enter)"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={handleCellCancel}
                className="p-1 text-red-600 hover:bg-red-100 rounded"
                title="Cancel (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        }

        // Show warning if no valid row ID
        if (!rowId) {
          return (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 px-2 py-1 rounded">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-sm">No Row ID - Cannot Edit</span>
            </div>
          )
        }

        return (
          <div 
            className="group flex items-center justify-between cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors"
            onClick={() => handleCellEdit(rowIndex, columnId, value)}
          >
            <span className="flex-1 min-w-0 truncate">
              {value?.toString() || ''}
            </span>
            <Edit2 className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
          </div>
        )
      },
    }))
  }, [localData, editingCell, rowIdColumn, getRowId, handleCellEdit, handleCellSave, handleKeyDown, handleCellCancel])

  const table = useReactTable({
    data: localData,
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

  return (
    <div className="h-full flex flex-col">
      {/* Data Integrity Alert */}
      {!hasValidRowIds && (
        <div className="flex-none bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800">Data Integrity Warning</h4>
              <p className="text-sm text-red-700 mt-1">
                Some rows are missing unique identifiers in column &apos;{rowIdColumn}&apos;. 
                Safe editing is disabled for these rows to prevent data corruption.
              </p>
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
            {table.getFilteredRowModel().rows.length} of {localData.length} rows
          </div>
          <div className="flex items-center text-green-600">
            <Shield className="h-4 w-4 mr-1" />
            Safe Mode: ID-based updates
          </div>
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
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
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

// Export as SafeDataTable
export { SafeDataTable as DataTable }