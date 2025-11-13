'use client'

import { useState, useEffect, useMemo } from 'react'
import { DailyPlanTable } from '@/components/DailyPlanTable'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { RefreshCcw, Download, Calendar } from 'lucide-react'
import * as XLSX from 'xlsx'
import { getDefaultDateFilter } from '@/lib/dateFilterUtils'

interface SheetData {
  [key: string]: string | number
}

export default function DailyPlanPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filteredData, setFilteredData] = useState<any[]>([])
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null)
  const [activeActivityFilter, setActiveActivityFilter] = useState<string | null>(null)
  
  // Date filter state - starts with default 3 days range (yesterday-today-tomorrow)
  const [dateFilter, setDateFilter] = useState(getDefaultDateFilter)

  const fetchData = async (startDate?: string, endDate?: string) => {
    try {
      setLoading(true)
      
      // Build URL with date parameters
      const url = new URL('/api/sheets', window.location.origin)
      if (startDate && endDate) {
        url.searchParams.set('startDate', startDate)
        url.searchParams.set('endDate', endDate)
      }
      
      const response = await fetch(url.toString())
      
      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }
      
      const result = await response.json()
      
      setData(result.data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Initial data fetch with default date range (load full dataset for client-side filtering)
  useEffect(() => {
    // Load full dataset initially for faster preset filtering
    fetchData() // No date parameters - load all data
  }, []) // Only run on mount

  // Refetch data when date filter changes
  const handleDateFilterChange = async (newDateFilter: { startDate: string; endDate: string }) => {
    setDateFilter(newDateFilter)
    await fetchData(newDateFilter.startDate, newDateFilter.endDate)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData(dateFilter.startDate, dateFilter.endDate)
    setRefreshing(false)
  }

  // Calculate status summary from filtered/rendered data
  const statusSummary = useMemo(() => {
    const summary: Record<string, number> = {}
    let total = 0
    
    // Use filtered data instead of all data
    filteredData.forEach(row => {
      const status = row.Status || 'No Status'
      summary[status] = (summary[status] || 0) + 1
      total++
    })
    
    return {
      summary,
      total,
      statuses: Object.entries(summary).sort(([,a], [,b]) => b - a)
    }
  }, [filteredData]) // Depend on filteredData instead of data

  // Calculate activity summary from filtered data
  const activitySummary = useMemo(() => {
    const summary: Record<string, number> = {}
    
    filteredData.forEach(row => {
      const activity = row.Activity
      if (activity) {
        summary[activity] = (summary[activity] || 0) + 1
      }
    })
    
    return Object.entries(summary).sort(([,a], [,b]) => b - a)
  }, [filteredData])

  const handleUpdateData = async (rowId: string, columnId: string, value: any, oldValue: any) => {
    try {
      const response = await fetch('/api/sheets/safe-update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          rowId, 
          columnId, 
          value, 
          oldValue,
          rowIdentifierColumn: 'RowId' // Specify which column contains unique IDs
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update data')
      }

      const result = await response.json()
      console.log('✅ Safe update success:', result)
      
      // Optionally refresh data after successful update
      // await fetchData()
      
    } catch (error) {
      console.error('❌ Safe update error:', error)
      throw error // Re-throw to let DataTable handle the error
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      console.log('📥 Starting Excel export...')
      
      // Use filtered data for export
      const dataToExport = filteredData.length > 0 ? filteredData : data
      
      if (dataToExport.length === 0) {
        alert('No data to export')
        return
      }

      // Fetch column configuration to know which columns are visible
      const configResponse = await fetch('/api/sheets/settings')
      if (!configResponse.ok) throw new Error('Failed to fetch column settings')
      
      const settingsResponse = await configResponse.json()
      console.log('📋 Settings response:', settingsResponse)
      
      // Extract columns from the response structure
      const configs = settingsResponse?.data?.columns || []
      
      if (!Array.isArray(configs) || configs.length === 0) {
        throw new Error('Invalid column configuration received')
      }
      
      // Filter only visible columns
      const visibleColumns = configs.filter((col: any) => col.show === true)
      
      if (visibleColumns.length === 0) {
        throw new Error('No visible columns found')
      }
      
      console.log('📊 Export details:', {
        totalRows: dataToExport.length,
        totalColumns: configs.length,
        visibleColumns: visibleColumns.length,
        columns: visibleColumns.map((c: any) => c.displayName)
      })
      
      // Prepare data for Excel
      const excelData = dataToExport.map(row => {
        const excelRow: any = {}
        visibleColumns.forEach((col: any) => {
          const value = row[col.name]
          // Use displayName as header in Excel
          excelRow[col.displayName] = value !== null && value !== undefined ? value : ''
        })
        return excelRow
      })
      
      // Create worksheet from data
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      
      // Auto-size columns
      const columnWidths = visibleColumns.map((col: any) => {
        const headerLength = col.displayName.length
        const maxDataLength = Math.max(
          ...dataToExport.map(row => {
            const value = row[col.name]
            return value ? String(value).length : 0
          })
        )
        return { wch: Math.min(Math.max(headerLength, maxDataLength) + 2, 50) }
      })
      worksheet['!cols'] = columnWidths
      
      // Create workbook and add worksheet
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Plan')
      
      // Generate filename with timestamp
      const filename = `daily-plan-export-${new Date().toISOString().split('T')[0]}.xlsx`
      
      // Write and download file
      XLSX.writeFile(workbook, filename)
      
      console.log(`✅ Exported ${dataToExport.length} rows with ${visibleColumns.length} visible columns to ${filename}`)
    } catch (error) {
      console.error('❌ Export failed:', error)
      alert(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
        <span className="ml-2 text-sm text-gray-600">Loading daily plan data from Google Sheets...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
            <Calendar className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-base font-medium text-gray-900 mb-2">Error Loading Daily Plan Data</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button 
            onClick={handleRefresh}
            className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header Section - Fixed */}
      <div className="flex-none">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-blue-600" />
              Daily Plan Management
            </h1>
            <p className="mt-0.5 text-xs text-gray-500">
              Manage and view your daily planning data from Google Sheets
            </p>
            
            {/* Status Summary Cards */}
            {filteredData.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {/* Status Group */}
                {statusSummary.statuses.slice(0, 6).map(([status, count]) => {
                  // Define status colors with specific matching for your status values
                  const getStatusStyle = (status: string) => {
                    const normalizedStatus = status.toLowerCase().trim()
                    const isActive = activeStatusFilter === status
                    
                    // Exact matches for specific statuses
                    switch (normalizedStatus) {
                      case 'on plan':
                        return isActive 
                          ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300' 
                          : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200' // Blue - Planning phase
                      case 'on going':
                        return isActive 
                          ? 'bg-orange-600 text-white border-orange-700 ring-2 ring-orange-300' 
                          : 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200' // Orange - In progress
                      case 'carry over':
                        return isActive 
                          ? 'bg-yellow-600 text-white border-yellow-700 ring-2 ring-yellow-300' 
                          : 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200' // Yellow - Pending/delayed
                      case 'done':
                        return isActive 
                          ? 'bg-green-600 text-white border-green-700 ring-2 ring-green-300' 
                          : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' // Green - Completed
                      case 'failed':
                        return isActive 
                          ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-300' 
                          : 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200' // Red - Failed
                      case 'idle':
                        return isActive 
                          ? 'bg-gray-600 text-white border-gray-700 ring-2 ring-gray-300' 
                          : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200' // Gray - Inactive
                      case 'off':
                        return isActive 
                          ? 'bg-slate-600 text-white border-slate-700 ring-2 ring-slate-300' 
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' // Slate - Off/disabled
                    }
                    
                    // Fallback for partial matches
                    if (normalizedStatus.includes('plan')) {
                      return isActive 
                        ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300' 
                        : 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200'
                    }
                    if (normalizedStatus.includes('going') || normalizedStatus.includes('progress') || normalizedStatus.includes('ongoing')) {
                      return isActive 
                        ? 'bg-orange-600 text-white border-orange-700 ring-2 ring-orange-300' 
                        : 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200'
                    }
                    if (normalizedStatus.includes('carry') || normalizedStatus.includes('pending') || normalizedStatus.includes('waiting')) {
                      return isActive 
                        ? 'bg-yellow-600 text-white border-yellow-700 ring-2 ring-yellow-300' 
                        : 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200'
                    }
                    if (normalizedStatus.includes('done') || normalizedStatus.includes('complete') || normalizedStatus.includes('finish')) {
                      return isActive 
                        ? 'bg-green-600 text-white border-green-700 ring-2 ring-green-300' 
                        : 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                    }
                    if (normalizedStatus.includes('fail') || normalizedStatus.includes('error') || normalizedStatus.includes('reject')) {
                      return isActive 
                        ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-300' 
                        : 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200'
                    }
                    if (normalizedStatus.includes('idle') || normalizedStatus.includes('inactive')) {
                      return isActive 
                        ? 'bg-gray-600 text-white border-gray-700 ring-2 ring-gray-300' 
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }
                    if (normalizedStatus.includes('off') || normalizedStatus.includes('disabled')) {
                      return isActive 
                        ? 'bg-slate-600 text-white border-slate-700 ring-2 ring-slate-300' 
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }
                    if (normalizedStatus.includes('no status') || normalizedStatus === '') {
                      return isActive 
                        ? 'bg-gray-600 text-white border-gray-700 ring-2 ring-gray-300' 
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }
                    
                    // Default fallback
                    return isActive 
                      ? 'bg-purple-600 text-white border-purple-700 ring-2 ring-purple-300' 
                      : 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200'
                  }
                  
                  return (
                    <button
                      key={status}
                      onClick={() => setActiveStatusFilter(activeStatusFilter === status ? null : status)}
                      className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium border rounded transition-all cursor-pointer ${getStatusStyle(status)}`}
                    >
                      <span className="truncate max-w-16">{status || 'No Status'}</span>
                      <span className="ml-1 font-semibold">{count}</span>
                    </button>
                  )
                })}
                {statusSummary.statuses.length > 6 && (
                  <div className="inline-flex items-center px-1.5 py-0.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded">
                    +{statusSummary.statuses.length - 6} more
                  </div>
                )}
                
                {/* Separator */}
                {activitySummary.length > 0 && (
                  <div className="h-5 w-px bg-gray-300 mx-0.5"></div>
                )}
                
                {/* Activity Group */}
                {activitySummary.map(([activity, count]) => {
                  // Define activity colors - all unique, colorful but soft
                  const getActivityStyle = (activity: string) => {
                    const normalized = activity.toLowerCase().trim()
                    const isActive = activeActivityFilter === activity
                    
                    switch (normalized) {
                      case 'survey':
                        return isActive 
                          ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300' 
                          : 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                      case 'mos':
                        return isActive 
                          ? 'bg-purple-600 text-white border-purple-700 ring-2 ring-purple-300' 
                          : 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200'
                      case 'installation':
                        return isActive 
                          ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-300' 
                          : 'bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200'
                      case 'integration':
                        return isActive 
                          ? 'bg-teal-600 text-white border-teal-700 ring-2 ring-teal-300' 
                          : 'bg-teal-100 text-teal-700 border-teal-300 hover:bg-teal-200'
                      case 'atp / sir':
                      case 'atp/sir':
                      case 'atp':
                        return isActive 
                          ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-300' 
                          : 'bg-indigo-100 text-indigo-700 border-indigo-300 hover:bg-indigo-200'
                      case 'rectification':
                        return isActive 
                          ? 'bg-orange-600 text-white border-orange-700 ring-2 ring-orange-300' 
                          : 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200'
                      case 'tagging':
                        return isActive 
                          ? 'bg-pink-600 text-white border-pink-700 ring-2 ring-pink-300' 
                          : 'bg-pink-100 text-pink-700 border-pink-300 hover:bg-pink-200'
                      case 'dismantle':
                        return isActive 
                          ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-300' 
                          : 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200'
                      case 'inbound':
                        return isActive 
                          ? 'bg-cyan-600 text-white border-cyan-700 ring-2 ring-cyan-300' 
                          : 'bg-cyan-100 text-cyan-700 border-cyan-300 hover:bg-cyan-200'
                      case 'outbound':
                        return isActive 
                          ? 'bg-sky-600 text-white border-sky-700 ring-2 ring-sky-300' 
                          : 'bg-sky-100 text-sky-700 border-sky-300 hover:bg-sky-200'
                      case 'troubleshoot':
                        return isActive 
                          ? 'bg-amber-600 text-white border-amber-700 ring-2 ring-amber-300' 
                          : 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200'
                      case 'rf audit':
                        return isActive 
                          ? 'bg-violet-600 text-white border-violet-700 ring-2 ring-violet-300' 
                          : 'bg-violet-100 text-violet-700 border-violet-300 hover:bg-violet-200'
                      case 'pln upgrade':
                        return isActive 
                          ? 'bg-lime-600 text-white border-lime-700 ring-2 ring-lime-300' 
                          : 'bg-lime-100 text-lime-700 border-lime-300 hover:bg-lime-200'
                      case 'others':
                        return isActive 
                          ? 'bg-fuchsia-600 text-white border-fuchsia-700 ring-2 ring-fuchsia-300' 
                          : 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300 hover:bg-fuchsia-200'
                      default:
                        return isActive 
                          ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-300' 
                          : 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                    }
                  }
                  
                  return (
                    <button
                      key={activity}
                      onClick={() => setActiveActivityFilter(activeActivityFilter === activity ? null : activity)}
                      className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium border rounded transition-all cursor-pointer ${getActivityStyle(activity)}`}
                    >
                      <span className="truncate max-w-16">{activity}</span>
                      <span className="ml-1 font-semibold">{count}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          
          <div className="mt-2 sm:mt-0 flex items-center space-x-2">
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button 
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className={`h-3.5 w-3.5 mr-1.5 ${exporting ? 'animate-bounce' : ''}`} />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>

      {/* Data Table - Scrollable */}
      <div className="flex-1 bg-white shadow-sm rounded-lg border border-gray-200 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <DailyPlanTable 
            data={data} 
            onUpdateData={handleUpdateData}
            rowIdColumn="RowId" // Use the actual column name from Google Sheets
            onFilteredDataChange={setFilteredData} // Pass callback to get filtered data
            onDateFilterChange={handleDateFilterChange} // Add callback for date filter changes
            statusFilter={activeStatusFilter} // Pass status filter
            activityFilter={activeActivityFilter} // Pass activity filter
            initialDateFilter={dateFilter} // Pass date filter from parent
          />
        </div>
      </div>
    </div>
  )
}