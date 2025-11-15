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

  const handleExport = async () => {
    if (!selectedSheet) {
      alert('Please select a project first')
      return
    }
    
    try {
      setExporting(true)
      
      // Use filtered data from table (respects all filters, sorting, etc)
      const dataToExport = filteredData.length > 0 ? filteredData : data
      
      if (dataToExport.length === 0) {
        alert('No data to export')
        return
      }

      // Fetch column configuration and PO status
      const [configResponse, poStatusResponse] = await Promise.all([
        fetch('/api/sheets/itc-huawei/settings'),
        fetch('/api/sheets/po-status')
      ])
      
      if (!configResponse.ok) throw new Error('Failed to fetch column settings')
      if (!poStatusResponse.ok) throw new Error('Failed to fetch PO status')
      
      const settingsResponse = await configResponse.json()
      const configs = settingsResponse?.data?.columns || []
      
      const poStatusResult = await poStatusResponse.json()
      const poStatusMap = poStatusResult?.data || {}
      
      if (!Array.isArray(configs) || configs.length === 0) {
        throw new Error('Invalid column configuration received')
      }
      
      // Filter only visible columns
      const visibleColumns = configs.filter((col: any) => col.show === true)
      
      if (visibleColumns.length === 0) {
        throw new Error('No visible columns found')
      }
      
      // Prepare data for Excel with PO Status
      const excelData = dataToExport.map(row => {
        const excelRow: any = {}
        
        // Add visible columns
        visibleColumns.forEach((col: any) => {
          const value = row[col.name] || row[col.displayName]
          excelRow[col.displayName] = value !== null && value !== undefined ? value : ''
        })
        
        // Add PO Status column
        const duid = row['DUID'] || row['duid']
        if (duid && poStatusMap[duid]) {
          const status = poStatusMap[duid]
          excelRow['PO Status'] = status.display || `${status.percentage}%`
        } else {
          excelRow['PO Status'] = '-'
        }
        
        return excelRow
      })
      
      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      
      // Auto-size columns (including PO Status)
      const allColumns = [...visibleColumns, { displayName: 'PO Status', name: 'PO_Status' }]
      const columnWidths = allColumns.map((col: any) => {
        const headerLength = col.displayName.length
        const maxDataLength = Math.max(
          ...excelData.map(row => {
            const value = row[col.displayName]
            return value ? String(value).length : 0
          })
        )
        return { wch: Math.min(Math.max(headerLength, maxDataLength) + 2, 50) }
      })
      worksheet['!cols'] = columnWidths
      
      // Create workbook
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ITC HUAWEI')
      
      // Generate filename
      const filename = `itc-huawei-export-${new Date().toISOString().split('T')[0]}.xlsx`
      
      // Download
      XLSX.writeFile(workbook, filename)
    } catch (error) {
      console.error('❌ Export failed:', error)
      alert(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
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
          />
        </div>
      </div>
    </div>
  )
}
