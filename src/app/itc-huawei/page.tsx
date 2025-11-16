'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { HuaweiRolloutTable } from '@/components/HuaweiRolloutTable'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { RefreshCcw, Download, Database } from 'lucide-react'
import * as XLSX from 'xlsx'

interface SheetData {
  [key: string]: string | number
}

interface SheetListItem {
  sheetName: string
  title: string
}

export default function ItcHuaweiPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filteredData, setFilteredData] = useState<any[]>([])
  const [sheetList, setSheetList] = useState<SheetListItem[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [loadingSheetList, setLoadingSheetList] = useState(true)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [exportData, setExportData] = useState<{
    columns: { name: string; displayName: string }[],
    poStatusMap: Record<string, any>
  } | null>(null)

  const fetchData = useCallback(async (sheetName?: string) => {
    try {
      setLoading(true)
      
      const sheetToFetch = sheetName || selectedSheet
      const response = await fetch(`/api/sheets/itc-huawei?sheetName=${sheetToFetch}`)
      
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
  }, [selectedSheet])

  const fetchSheetList = async () => {
    try {
      setLoadingSheetList(true)
      const response = await fetch('/api/sheets/itc-huawei/sheet-list')
      
      if (!response.ok) {
        throw new Error('Failed to fetch sheet list')
      }
      
      const result = await response.json()
      setSheetList(result.data || [])
    } catch (err) {
      console.error('Failed to fetch sheet list:', err)
      // Use fallback data if API fails
      setSheetList([
        { sheetName: 'ITCHIOH', title: 'Huawei IOH Project' },
        { sheetName: 'ITCHWXL', title: 'Huawei XLS Project' },
        { sheetName: 'ITCHTSEL', title: 'Huawei TSEL Project' },
        { sheetName: 'ITCHUSO', title: 'Huawei USO Project' },
        { sheetName: 'ITCHWXLCME', title: 'Huawei XLS CME Project' },
      ])
    } finally {
      setLoadingSheetList(false)
    }
  }

  useEffect(() => {
    fetchSheetList()
  }, [])

  useEffect(() => {
    if (selectedSheet) {
      fetchData(selectedSheet)
    }
  }, [selectedSheet, fetchData])

  const handleRefresh = async () => {
    if (!selectedSheet) {
      alert('Please select a project first')
      return
    }
    setRefreshing(true)
    await fetchData(selectedSheet)
    setRefreshing(false)
  }

  const handleUpdateData = async (rowId: string, columnId: string, value: any, oldValue: any) => {
    try {
      const response = await fetch('/api/sheets/itc-huawei/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          rowId, 
          columnId, 
          value, 
          oldValue,
          rowIdentifierColumn: 'DUID'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update data')
      }
      
    } catch (error) {
      console.error('❌ Update error:', error)
      throw error
    }
  }

  const handleExport = () => {
    if (!selectedSheet) {
      alert('Please select a project first')
      return
    }
    
    if (!exportData) {
      alert('Export data not ready. Please wait...')
      return
    }
    
    try {
      setExporting(true)
      
      // Use filtered data from table - already includes all filters
      const dataToExport = filteredData.length > 0 ? filteredData : data
      
      console.log('📥 Export data:', {
        filteredDataLength: filteredData.length,
        allDataLength: data.length,
        exportingCount: dataToExport.length,
        visibleColumns: exportData.columns.length,
        isFiltered: filteredData.length !== data.length && filteredData.length > 0
      })
      
      if (dataToExport.length === 0) {
        displayToast('No data to export', 'error')
        setExporting(false)
        return
      }

      // Use LOCAL data from table (no server fetch)
      const { columns: visibleColumns, poStatusMap } = exportData
      
      // Prepare data for XLSX (optimized - build array directly)
      const headers = [...visibleColumns.map((col) => col.displayName), 'PO Status']
      
      // Build data array (faster than creating objects)
      const excelData = [headers]
      
      // Process rows - use ONLY visible columns from table
      for (let i = 0; i < dataToExport.length; i++) {
        const row = dataToExport[i]
        const rowData: any[] = []
        
        // Add visible column values
        for (let j = 0; j < visibleColumns.length; j++) {
          const col = visibleColumns[j]
          const value = row[col.name] || row[col.displayName]
          rowData.push(value !== null && value !== undefined ? value : '')
        }
        
        // Add PO Status
        const duid = row['DUID'] || row['duid']
        if (duid && poStatusMap[duid]) {
          rowData.push(`${poStatusMap[duid].percentage}%`)
        } else {
          rowData.push('-')
        }
        
        excelData.push(rowData)
      }
      
      // Create worksheet from array (faster than json_to_sheet)
      const worksheet = XLSX.utils.aoa_to_sheet(excelData)
      
      // Set column widths (simplified calculation)
      const colWidths = headers.map((header, idx) => {
        let maxLength = header.length
        // Sample first 100 rows for width calculation (faster)
        const sampleSize = Math.min(100, excelData.length - 1)
        for (let i = 1; i <= sampleSize; i++) {
          const cellValue = excelData[i][idx]
          if (cellValue) {
            const len = String(cellValue).length
            if (len > maxLength) maxLength = len
          }
        }
        return { wch: Math.min(maxLength + 2, 50) }
      })
      worksheet['!cols'] = colWidths
      
      // Create workbook
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
      
      // Generate filename
      const isFiltered = filteredData.length > 0 && filteredData.length < data.length
      const filename = `itc-huawei-${isFiltered ? 'filtered-' : ''}export-${new Date().toISOString().split('T')[0]}.xlsx`
      
      // Write file (writeFile is optimized internally)
      XLSX.writeFile(workbook, filename, { compression: true })
      
      // Show success toast
      displayToast('Export completed successfully', 'success')
    } catch (error) {
      console.error('❌ Export failed:', error)
      displayToast(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setExporting(false)
    }
  }

  // Toast notification function
  const displayToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => {
      setShowToast(false)
    }, 3000)
  }

  return (
    <div className="h-full flex flex-col pb-2">
      {/* Toast Notification */}
      {showToast && (
        <div 
          className="fixed top-20 right-4 z-50 bg-white border-l-4 border-green-500 shadow-lg rounded-lg p-4 max-w-md animate-slide-in"
          style={{
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-900">{toastMessage}</p>
            </div>
            <button
              onClick={() => setShowToast(false)}
              className="ml-4 inline-flex text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex-none">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center">
              <Database className="h-5 w-5 mr-2 text-blue-600" />
              ITC HUAWEI
            </h1>
            <p className="mt-0.5 text-xs text-gray-500">
              Manage ITC HUAWEI rollout data from Google Sheets
            </p>
          </div>
          
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Project Tabs */}
        <div className="flex items-center gap-1 border-b border-gray-200 mb-3 overflow-x-auto">
          {loadingSheetList ? (
            <div className="text-xs text-gray-500 py-2 px-3">Loading projects...</div>
          ) : (
            sheetList.map((sheet) => (
              <button
                key={sheet.sheetName}
                onClick={() => setSelectedSheet(sheet.sheetName)}
                className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  selectedSheet === sheet.sheetName
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {sheet.title}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 bg-white shadow-sm rounded-lg border border-gray-200 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <HuaweiRolloutTable 
            data={data} 
            onUpdateData={handleUpdateData}
            rowIdColumn="DUID"
            onFilteredDataChange={setFilteredData}
            onExport={handleExport}
            exporting={exporting}
            loading={loading}
            error={error}
            selectedSheet={selectedSheet}
            onExportDataReady={setExportData}
          />
        </div>
      </div>
    </div>
  )
}
