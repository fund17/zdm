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
import { Check, X, Edit2 } from 'lucide-react'

interface DataTableProps {
  data: Record<string, any>[]
  onUpdateData?: (rowIndex: number, columnId: string, value: any) => Promise<void>
}

interface EditingState {
  rowIndex: number
  columnId: string
  value: any
}

export function DataTable({ data, onUpdateData }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [editingCell, setEditingCell] = useState<EditingState | null>(null)
  const [localData, setLocalData] = useState(data)

  // Update local data when props change
  React.useEffect(() => {
    setLocalData(data)
  }, [data])

  // Handle cell editing
  const handleCellEdit = useCallback((rowIndex: number, columnId: string, currentValue: any) => {
    setEditingCell({ rowIndex, columnId, value: currentValue })
  }, [])

  const handleCellSave = useCallback(async () => {
    if (!editingCell) return

    const { rowIndex, columnId, value } = editingCell

    // Update local data immediately for UI responsiveness
    const newData = [...localData]
    newData[rowIndex] = { ...newData[rowIndex], [columnId]: value }
    setLocalData(newData)

    // Call API to update backend
    if (onUpdateData) {
      try {
        await onUpdateData(rowIndex, columnId, value)
      } catch (error) {
        // Revert local changes on error
        setLocalData([...data])
        console.error('Failed to update data:', error)
      }
    }

    setEditingCell(null)
  }, [editingCell, localData, data, onUpdateData])

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
  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (localData.length === 0) return []
    
    const keys = Object.keys(localData[0])
    return keys.map((key) => ({
      accessorKey: key,
      header: key.charAt(0).toUpperCase() + key.slice(1),
      cell: ({ getValue, row, column }) => {
        const value = getValue()
        const rowIndex = row.index
        const columnId = column.id
        const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.columnId === columnId

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
  }, [localData, editingCell, handleCellSave, handleKeyDown, handleCellCancel, handleCellEdit])

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
      {/* Search Filter - Fixed */}
      <div className="flex-none flex items-center space-x-4 p-4 bg-gray-50 border-b">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search all columns..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="form-input"
          />
        </div>
        <div className="text-sm text-gray-600">
          {table.getFilteredRowModel().rows.length} of {localData.length} rows
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