'use client'

import { useState, useEffect, useMemo } from 'react'
import { DailyPlanTable } from '@/components/DailyPlanTable'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { RefreshCcw, Calendar, Upload, X, CheckCircle, AlertCircle, Download } from 'lucide-react'
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
  const [tableRefreshing, setTableRefreshing] = useState(false)
  const [filteredData, setFilteredData] = useState<any[]>([])
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null)
  const [activeActivityFilter, setActiveActivityFilter] = useState<string | null>(null)
  
  // Date filter state - starts with default 3 days range (yesterday-today-tomorrow)
  const [dateFilter, setDateFilter] = useState(getDefaultDateFilter)
  
  // Import Excel state
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; count?: number } | null>(null)
  
  // Success notification state
  const [showSuccessNotification, setShowSuccessNotification] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

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

  // Check if date range is within loaded data range
  const isWithinLoadedRange = (startDate: string, endDate: string) => {
    // If we have data loaded, check if new range needs server fetch
    // For now, we load all data on mount, so any preset is within range
    // Only fetch from server if explicitly needed (large custom range)
    return true // All presets use client-side filtering
  }

  // Handle date filter changes - use client-side filtering when possible
  const handleDateFilterChange = async (newDateFilter: { startDate: string; endDate: string }) => {
    setDateFilter(newDateFilter)
    
    // Only fetch from server if range is outside loaded data
    // For typical presets (today, this week, etc.), client-side filtering is sufficient
    if (!isWithinLoadedRange(newDateFilter.startDate, newDateFilter.endDate)) {
      await fetchData(newDateFilter.startDate, newDateFilter.endDate)
    }
    // Otherwise, DailyPlanTable will handle client-side filtering automatically
  }

  const handleRefresh = async () => {
    setTableRefreshing(true)
    await fetchData(dateFilter.startDate, dateFilter.endDate)
    setTableRefreshing(false)
  }

  const handleSaveComplete = async () => {
    // Refresh data after save without full page reload
    setTableRefreshing(true)
    await fetchData(dateFilter.startDate, dateFilter.endDate)
    setTableRefreshing(false)
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
      
      // Optionally refresh data after successful update
      // await fetchData()
      
    } catch (error) {
      console.error('❌ Safe update error:', error)
      throw error // Re-throw to let DataTable handle the error
    }
  }

  const handleImportExcel = async () => {
    if (!importFile) {
      alert('Please select a file first')
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      // Read Excel file
      const data = await importFile.arrayBuffer()
      
      const workbook = XLSX.read(data, { type: 'array' })
      
      const sheetName = workbook.SheetNames[0]
      
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (jsonData.length === 0) {
        setImportResult({
          success: false,
          message: 'No data found in Excel file'
        })
        setImporting(false)
        return
      }

      // Validate dates - only allow today and tomorrow
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const invalidRows: number[] = []
      const validData = jsonData.filter((row: any, index: number) => {
        if (!row.Date) {
          invalidRows.push(index + 1)
          return false
        }
        
        // Parse date from Excel (can be in various formats)
        let rowDate: Date
        if (typeof row.Date === 'number') {
          // Excel serial date
          rowDate = new Date((row.Date - 25569) * 86400 * 1000)
        } else {
          // String date
          rowDate = new Date(row.Date)
        }
        rowDate.setHours(0, 0, 0, 0)
        
        const isValid = rowDate.getTime() === today.getTime() || rowDate.getTime() === tomorrow.getTime()
        if (!isValid) {
          invalidRows.push(index + 1)
        }
        return isValid
      })

      if (invalidRows.length > 0) {
        setImportResult({
          success: false,
          message: `Import failed: ${invalidRows.length} row(s) have invalid dates. Only today and tomorrow are allowed`
        })
        setImporting(false)
        return
      }

      if (validData.length === 0) {
        setImportResult({
          success: false,
          message: 'No valid data to import. All rows have dates outside allowed range (today/tomorrow).'
        })
        setImporting(false)
        return
      }

      // Send to API
      const response = await fetch('/api/sheets/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: validData }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to import data')
      }

      const result = await response.json()
      
      // Close modal immediately
      setImportModalOpen(false)
      setImportFile(null)
      setImportResult(null)
      
      // Show success notification
      setSuccessMessage(`✅ Successfully imported ${result.count} rows!`)
      setShowSuccessNotification(true)
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setShowSuccessNotification(false)
      }, 3000)

      // Refresh only table data (not full page)
      setTableRefreshing(true)
      await fetchData(dateFilter.startDate, dateFilter.endDate)
      setTableRefreshing(false)

    } catch (error) {
      console.error('Import error:', error)
      console.error('Error details:', error instanceof Error ? error.stack : error)
      
      let errorMessage = 'An error occurred during import'
      
      if (error instanceof Error) {
        errorMessage = error.message
        
        // Try to parse additional error details from message
        if (errorMessage.includes('Failed to import data')) {
          errorMessage = 'Failed to import data. Please check browser console for details.'
        }
      }
      
      setImportResult({
        success: false,
        message: errorMessage
      })
    } finally {
      setImporting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportFile(file)
      setImportResult(null)
    }
  }

  const handleExport = async () => {
    try {
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
    } catch (error) {
      console.error('❌ Export failed:', error)
      alert(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
    <div className="h-full flex flex-col pb-2">
      {/* Header */}
      <div className="mb-6">
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
                    
                    // Exact matches for specific statuses with soft colors
                    switch (normalizedStatus) {
                      case 'on plan':
                        return isActive 
                          ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-200 shadow-md' 
                          : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 hover:border-blue-200' // Soft blue - Planning phase
                      case 'on going':
                        return isActive 
                          ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-200 shadow-md' 
                          : 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100 hover:border-orange-200' // Soft orange - In progress
                      case 'carry over':
                        return isActive 
                          ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-200 shadow-md' 
                          : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 hover:border-amber-200' // Soft amber - Pending/delayed
                      case 'done':
                        return isActive 
                          ? 'bg-emerald-500 text-white border-emerald-600 ring-2 ring-emerald-200 shadow-md' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 hover:border-emerald-200' // Soft emerald - Completed
                      case 'failed':
                        return isActive 
                          ? 'bg-rose-500 text-white border-rose-600 ring-2 ring-rose-200 shadow-md' 
                          : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100 hover:border-rose-200' // Soft rose - Failed
                      case 'idle':
                        return isActive 
                          ? 'bg-slate-500 text-white border-slate-600 ring-2 ring-slate-200 shadow-md' 
                          : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 hover:border-slate-200' // Soft slate - Inactive
                      case 'off':
                        return isActive 
                          ? 'bg-gray-500 text-white border-gray-600 ring-2 ring-gray-200 shadow-md' 
                          : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100 hover:border-gray-200' // Soft gray - Off/disabled
                    }
                    
                    // Fallback for partial matches
                    if (normalizedStatus.includes('plan')) {
                      return isActive 
                        ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-200 shadow-md' 
                        : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 hover:border-blue-200'
                    }
                    if (normalizedStatus.includes('going') || normalizedStatus.includes('progress') || normalizedStatus.includes('ongoing')) {
                      return isActive 
                        ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-200 shadow-md' 
                        : 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100 hover:border-orange-200'
                    }
                    if (normalizedStatus.includes('carry') || normalizedStatus.includes('pending') || normalizedStatus.includes('waiting')) {
                      return isActive 
                        ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-200 shadow-md' 
                        : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 hover:border-amber-200'
                    }
                    if (normalizedStatus.includes('done') || normalizedStatus.includes('complete') || normalizedStatus.includes('finish')) {
                      return isActive 
                        ? 'bg-emerald-500 text-white border-emerald-600 ring-2 ring-emerald-200 shadow-md' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 hover:border-emerald-200'
                    }
                    if (normalizedStatus.includes('fail') || normalizedStatus.includes('error') || normalizedStatus.includes('reject')) {
                      return isActive 
                        ? 'bg-rose-500 text-white border-rose-600 ring-2 ring-rose-200 shadow-md' 
                        : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100 hover:border-rose-200'
                    }
                    if (normalizedStatus.includes('idle') || normalizedStatus.includes('inactive')) {
                      return isActive 
                        ? 'bg-slate-500 text-white border-slate-600 ring-2 ring-slate-200 shadow-md' 
                        : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 hover:border-slate-200'
                    }
                    if (normalizedStatus.includes('off') || normalizedStatus.includes('disabled')) {
                      return isActive 
                        ? 'bg-gray-500 text-white border-gray-600 ring-2 ring-gray-200 shadow-md' 
                        : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100 hover:border-gray-200'
                    }
                    if (normalizedStatus.includes('no status') || normalizedStatus === '') {
                      return isActive 
                        ? 'bg-gray-500 text-white border-gray-600 ring-2 ring-gray-200 shadow-md' 
                        : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100 hover:border-gray-200'
                    }
                    
                    // Default fallback with soft purple
                    return isActive 
                      ? 'bg-purple-500 text-white border-purple-600 ring-2 ring-purple-200 shadow-md' 
                      : 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100 hover:border-purple-200'
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
                          ? 'bg-sky-500 text-white border-sky-600 ring-2 ring-sky-200 shadow-md' 
                          : 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100 hover:border-sky-200'
                      case 'mos':
                        return isActive 
                          ? 'bg-purple-500 text-white border-purple-600 ring-2 ring-purple-200 shadow-md' 
                          : 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100 hover:border-purple-200'
                      case 'installation':
                        return isActive 
                          ? 'bg-emerald-500 text-white border-emerald-600 ring-2 ring-emerald-200 shadow-md' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 hover:border-emerald-200'
                      case 'integration':
                        return isActive 
                          ? 'bg-teal-500 text-white border-teal-600 ring-2 ring-teal-200 shadow-md' 
                          : 'bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100 hover:border-teal-200'
                      case 'atp / sir':
                      case 'atp/sir':
                      case 'atp':
                        return isActive 
                          ? 'bg-indigo-500 text-white border-indigo-600 ring-2 ring-indigo-200 shadow-md' 
                          : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200'
                      case 'rectification':
                        return isActive 
                          ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-200 shadow-md' 
                          : 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100 hover:border-orange-200'
                      case 'tagging':
                        return isActive 
                          ? 'bg-pink-500 text-white border-pink-600 ring-2 ring-pink-200 shadow-md' 
                          : 'bg-pink-50 text-pink-700 border-pink-100 hover:bg-pink-100 hover:border-pink-200'
                      case 'dismantle':
                        return isActive 
                          ? 'bg-rose-500 text-white border-rose-600 ring-2 ring-rose-200 shadow-md' 
                          : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100 hover:border-rose-200'
                      case 'inbound':
                        return isActive 
                          ? 'bg-cyan-500 text-white border-cyan-600 ring-2 ring-cyan-200 shadow-md' 
                          : 'bg-cyan-50 text-cyan-700 border-cyan-100 hover:bg-cyan-100 hover:border-cyan-200'
                      case 'outbound':
                        return isActive 
                          ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-200 shadow-md' 
                          : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 hover:border-blue-200'
                      case 'troubleshoot':
                        return isActive 
                          ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-200 shadow-md' 
                          : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 hover:border-amber-200'
                      case 'rf audit':
                        return isActive 
                          ? 'bg-violet-500 text-white border-violet-600 ring-2 ring-violet-200 shadow-md' 
                          : 'bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100 hover:border-violet-200'
                      case 'pln upgrade':
                        return isActive 
                          ? 'bg-lime-500 text-white border-lime-600 ring-2 ring-lime-200 shadow-md' 
                          : 'bg-lime-50 text-lime-700 border-lime-100 hover:bg-lime-100 hover:border-lime-200'
                      case 'others':
                        return isActive 
                          ? 'bg-fuchsia-500 text-white border-fuchsia-600 ring-2 ring-fuchsia-200 shadow-md' 
                          : 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100 hover:bg-fuchsia-100 hover:border-fuchsia-200'
                      default:
                        return isActive 
                          ? 'bg-red-500 text-white border-red-600 ring-2 ring-red-200 shadow-md' 
                          : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100 hover:border-red-200'
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
            showFilters={true} // Enable the new filters section
            onExport={handleExport} // Pass export function to table header
            onSaveComplete={handleSaveComplete} // Callback after save completes
            loading={tableRefreshing} // Pass loading state for table body
            onImport={() => setImportModalOpen(true)} // Pass import trigger
            onRefresh={handleRefresh} // Pass refresh function
            refreshing={refreshing} // Pass refresh state
          />
        </div>
      </div>

      {/* Success Notification Toast */}
      {showSuccessNotification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className="bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center space-x-3 min-w-[300px]">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{successMessage}</p>
            <button
              onClick={() => setShowSuccessNotification(false)}
              className="ml-auto hover:bg-emerald-700 rounded p-1 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Upload className="h-5 w-5 mr-2 text-emerald-600" />
                Import Excel File
              </h3>
              <button
                onClick={() => {
                  setImportModalOpen(false)
                  setImportFile(null)
                  setImportResult(null)
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  Upload an Excel file to import new data.
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-blue-900 mb-1">📋 Important Notes:</p>
                  <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
                    <li>All other columns must match existing table structure</li>
                    <li>This will create NEW rows, not update existing ones</li>
                    <li className="font-semibold text-blue-900">⚠️ Only dates for TODAY and TOMORROW are allowed</li>
                  </ul>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-gray-700 mb-2 block">Select Excel File</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-600
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-emerald-50 file:text-emerald-700
                      hover:file:bg-emerald-100
                      cursor-pointer"
                  />
                </label>

                {importFile && (
                  <div className="mt-3 flex items-center text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 mr-2" />
                    <span className="truncate">{importFile.name}</span>
                  </div>
                )}
              </div>

              {/* Import Result */}
              {importResult && (
                <div className={`mb-4 p-3 rounded-lg ${
                  importResult.success 
                    ? 'bg-emerald-50 border border-emerald-200' 
                    : 'bg-rose-50 border border-rose-200'
                }`}>
                  <div className="flex items-start">
                    {importResult.success ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 mr-2 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-rose-600 mr-2 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${
                        importResult.success ? 'text-emerald-900' : 'text-rose-900'
                      }`}>
                        {importResult.success ? 'Import Successful!' : 'Import Failed'}
                      </p>
                      <p className={`text-xs mt-1 ${
                        importResult.success ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {importResult.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setImportModalOpen(false)
                    setImportFile(null)
                    setImportResult(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportExcel}
                  disabled={!importFile || importing}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  {importing ? (
                    <>
                      <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Data
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}