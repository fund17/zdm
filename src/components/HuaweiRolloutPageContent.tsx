'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { HuaweiRolloutTable } from '@/components/HuaweiRolloutTable'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Database, Upload, RefreshCcw, X, CheckCircle, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

interface SheetData {
  [key: string]: string | number
}

interface SheetListItem {
  sheetName: string
  title: string
}

interface ImportPreview {
  cellsWillUpdate: number
  cellsWillSkip: number
  skipReasons: {
    duidColumn: number
    dateColumnsProtected: number
    invalidDateFormat: number
  }
  totalRows: number
  totalCells: number
}

interface HuaweiRolloutPageContentProps {
  apiBasePath: string // e.g., '/api/sheets/itc-huawei' or '/api/sheets/rno-huawei'
  pageTitle: string // e.g., 'ITC Huawei Rollout' or 'RNO Huawei Rollout'
  userRegion?: string // User's region for server-side filtering
}

export function HuaweiRolloutPageContent({ apiBasePath, pageTitle, userRegion }: HuaweiRolloutPageContentProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tableRefreshing, setTableRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filteredData, setFilteredData] = useState<any[]>([])
  const [sheetList, setSheetList] = useState<SheetListItem[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [loadingSheetList, setLoadingSheetList] = useState(true)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [exportData, setExportData] = useState<{
    columns: { name: string; displayName: string }[],
    poStatusMap: Record<string, any>,
    includePOStatus?: boolean
  } | null>(null)
  
  // Import Excel state
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [analyzingFile, setAnalyzingFile] = useState(false)
  const [importedCells, setImportedCells] = useState<Set<string>>(new Set())
  
  // Register DUID state
  const [activeTab, setActiveTab] = useState<'import' | 'register'>('import')
  const [registerFile, setRegisterFile] = useState<File | null>(null)
  const [registering, setRegistering] = useState(false)
  const [registerPreview, setRegisterPreview] = useState<{
    validRows: any[]
    duplicates: string[]
    missingFields: number
    totalRows: number
  } | null>(null)
  const [analyzingRegisterFile, setAnalyzingRegisterFile] = useState(false)
  
  // Date columns from settings
  const [dateColumns, setDateColumns] = useState<string[]>([])

  const fetchData = useCallback(async (sheetName?: string, options?: { showFullLoading?: boolean; region?: string }) => {
    try {
      if (options?.showFullLoading !== false) setLoading(true)
      
      const sheetToFetch = sheetName || selectedSheet
      const url = new URL(apiBasePath, window.location.origin)
      url.searchParams.set('sheetName', sheetToFetch)
      if (options?.region) {
        url.searchParams.set('region', options.region)
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
      if (options?.showFullLoading !== false) setLoading(false)
    }
  }, [selectedSheet, apiBasePath])

  const fetchSheetList = async () => {
    try {
      setLoadingSheetList(true)
      const response = await fetch(`${apiBasePath}/sheet-list`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch sheet list')
      }
      
      const result = await response.json()
      setSheetList(result.data || [])
    } catch (err) {
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

  const fetchDateColumnsFromSettings = async () => {
    try {
      const response = await fetch(`${apiBasePath}/settings`)
      if (!response.ok) {
        return
      }
      
      const result = await response.json()
      const columns = result.data?.columns || []
      
      // Extract column names where type is 'date'
      const dateColumnNames = columns
        .filter((col: any) => col.type === 'date')
        .map((col: any) => col.name)
      
      setDateColumns(dateColumnNames)
    } catch (err) {
      // Silent catch
    }
  }

  useEffect(() => {
    fetchSheetList()
    fetchDateColumnsFromSettings()
  }, [])

  // Auto-select first project when sheet list loads
  useEffect(() => {
    if (sheetList.length > 0 && !selectedSheet) {
      setSelectedSheet(sheetList[0].sheetName)
    }
  }, [sheetList])

  useEffect(() => {
    if (selectedSheet) {
      fetchData(selectedSheet, { region: userRegion })
    }
  }, [selectedSheet, fetchData, userRegion])

  const handleRefresh = async () => {
    if (!selectedSheet) {
      alert('Please select a project first')
      return
    }
    setRefreshing(true)
    setTableRefreshing(true)
    await fetchData(selectedSheet, { showFullLoading: false, region: userRegion })
    setTableRefreshing(false)
    setRefreshing(false)
  }

  const handleUpdateData = async (rowId: string, columnId: string, value: any, oldValue: any) => {
    try {
      const response = await fetch(`${apiBasePath}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          rowId, 
          columnId, 
          value, 
          oldValue,
          rowIdentifierColumn: 'DUID',
          sheetName: selectedSheet
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update data')
      }

      const result = await response.json()
      
      await fetchData(selectedSheet, { showFullLoading: false })
      
      return result
    } catch (error) {
      throw error
    }
  }

  const handleFilteredDataChange = (filtered: any[]) => {
    setFilteredData(filtered)
  }

  const displayToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 5000)
  }

  const handleExportDataReady = (data: {
    columns: { name: string; displayName: string }[],
    poStatusMap: Record<string, any>,
    includePOStatus?: boolean
  }) => {
    setExportData(data)
  }

  const handleExport = () => {
    if (!exportData) {
      alert('No data to export')
      return
    }

    setExporting(true)
    
    try {
      const { columns, poStatusMap, includePOStatus } = exportData
      
      const headers = columns.map(col => col.displayName)
      if (includePOStatus) {
        headers.push('PO Status')
      }
      
      const rows = filteredData.map(row => {
        const rowData = columns.map(col => {
          const value = row[col.name]
          return value !== undefined && value !== null ? value : ''
        })
        
        if (includePOStatus) {
          const duid = row.DUID || row.duid
          const poStatus = duid && poStatusMap[duid] ? poStatusMap[duid].status : ''
          rowData.push(poStatus)
        }
        
        return rowData
      })
      
      const wsData = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Export')
      
      const timestamp = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `${pageTitle.replace(/\s+/g, '_')}_${selectedSheet}_${timestamp}.xlsx`)
      
      displayToast('✅ Export successful!', 'success')
    } catch (error) {
      displayToast(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setExporting(false)
    }
  }

  const validateAndConvertDate = (value: any): string | null => {
    if (!value) return null

    if (typeof value === 'number') {
      // Excel serial date conversion (same as other components)
      // Excel epoch starts at 1900-01-01
      // Use UTC to avoid timezone offset issues
      if (value >= 1 && value <= 60000) {
        let days = value - 1
        if (value > 60) {
          days = days - 1
        }
        const excelEpoch = Date.UTC(1900, 0, 1)
        const date = new Date(excelEpoch + days * 24 * 60 * 60 * 1000)
        
        const day = String(date.getUTCDate()).padStart(2, '0')
        const month = String(date.getUTCMonth() + 1).padStart(2, '0')
        const year = date.getUTCFullYear()
        return `${day}/${month}/${year}`
      }
      return null
    }

    if (typeof value === 'string') {
      const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
      const match = value.match(ddmmyyyyPattern)
      if (match) {
        const [, day, month, year] = match
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
      }
    }

    return null
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImportFile(file)
    setImportPreview(null)
    setAnalyzingFile(true)
    
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      let jsonData: any[] = XLSX.utils.sheet_to_json(worksheet)
      
      if (jsonData.length === 0) {
        setImportPreview({
          cellsWillUpdate: 0,
          cellsWillSkip: 0,
          skipReasons: { duidColumn: 0, dateColumnsProtected: 0, invalidDateFormat: 0 },
          totalRows: 0,
          totalCells: 0
        })
        setAnalyzingFile(false)
        return
      }
      
      jsonData = jsonData.map(row => {
        const newRow: any = {}
        for (const [key, value] of Object.entries(row)) {
          const normalizedKey = key.replace(/\s+/g, '')
          const isDateColumn = dateColumns.some(dateCol => 
            normalizedKey.toLowerCase() === dateCol.toLowerCase()
          )
          
          if (isDateColumn && value) {
            const convertedDate = validateAndConvertDate(value)
            newRow[key] = convertedDate || value
          } else {
            newRow[key] = value
          }
        }
        return newRow
      })

      let cellsWillUpdate = 0
      let duidColumnCount = 0
      let dateColumnsProtected = 0
      let invalidDateFormat = 0
      let totalCells = 0
      
      for (const excelRow of jsonData) {
        const duid = excelRow['DUID'] || excelRow['duid']
        const existingRow = data.find(row => row.DUID === duid || row.duid === duid)
        const cellsInRow = Object.keys(excelRow).length
        totalCells += cellsInRow
        
        for (const [excelKey, excelValue] of Object.entries(excelRow)) {
          if (excelKey.toLowerCase() === 'duid') {
            duidColumnCount++
            continue
          }
          
          const normalizedKey = excelKey.replace(/\s+/g, '')
          const isDateColumn = dateColumns.some(dateCol => 
            normalizedKey.toLowerCase() === dateCol.toLowerCase()
          )
          
          if (isDateColumn && excelValue) {
            const convertedDate = validateAndConvertDate(excelValue)
            if (!convertedDate) {
              invalidDateFormat++
              continue
            }
          }
          
          if (isDateColumn && existingRow) {
            const existingValue = existingRow[excelKey]
            if (existingValue && existingValue !== '' && existingValue !== null) {
              dateColumnsProtected++
              continue
            }
          }
          
          if (!existingRow) {
            cellsWillUpdate++
          } else {
            const existingValue = existingRow[excelKey]
            if (excelValue !== existingValue && excelValue !== null && excelValue !== undefined && excelValue !== '') {
              cellsWillUpdate++
            }
          }
        }
      }

      setImportPreview({
        cellsWillUpdate,
        cellsWillSkip: duidColumnCount + dateColumnsProtected + invalidDateFormat,
        skipReasons: {
          duidColumn: duidColumnCount,
          dateColumnsProtected,
          invalidDateFormat
        },
        totalRows: jsonData.length,
        totalCells
      })
    } catch (error) {
      displayToast('Failed to analyze file', 'error')
    } finally {
      setAnalyzingFile(false)
    }
  }

  const handleImportExcel = async () => {
    if (!importFile || !selectedSheet) {
      displayToast('Please select a file and project first', 'error')
      return
    }
    
    setImporting(true)
    
    try {
      const arrayBuffer = await importFile.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet)
      
      if (jsonData.length === 0) {
        displayToast('No data found in Excel file', 'error')
        setImporting(false)
        return
      }

      const response = await fetch(`${apiBasePath}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetName: selectedSheet,
          updates: jsonData,
          bulkImport: true
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to import data')
      }

      const result = await response.json()
      
      const importedCellsSet = new Set<string>()
      if (result.importedCells && Array.isArray(result.importedCells)) {
        result.importedCells.forEach((cell: { duid: string; column: string }) => {
          importedCellsSet.add(`${cell.duid}-${cell.column}`)
        })
      }
      setImportedCells(importedCellsSet)
      
      setTimeout(() => {
        setImportedCells(new Set())
      }, 10000)
      
      setImportModalOpen(false)
      setImportFile(null)
      setImportPreview(null)
      
      displayToast(`✅ Successfully imported ${result.updatedCount || importPreview?.cellsWillUpdate || 0} cells!`, 'success')
      
      setTableRefreshing(true)
      await fetchData(selectedSheet, { showFullLoading: false })
      setTableRefreshing(false)
      
    } catch (error) {
      displayToast(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setImporting(false)
    }
  }

  const handleRegisterFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setRegisterFile(file)
    setRegisterPreview(null)
    setAnalyzingRegisterFile(true)
    
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet)
      
      if (jsonData.length === 0) {
        setRegisterPreview({
          validRows: [],
          duplicates: [],
          missingFields: 0,
          totalRows: 0
        })
        setAnalyzingRegisterFile(false)
        return
      }

      const validRows: any[] = []
      const duplicates: string[] = []
      let missingFields = 0
      
      const existingDUIDs = new Set(data.map(row => row.DUID || row.duid))
      
      for (const row of jsonData) {
        const duid = row['DUID'] || row['duid']
        
        if (!duid) {
          missingFields++
          continue
        }
        
        if (existingDUIDs.has(duid)) {
          duplicates.push(duid)
          continue
        }
        
        validRows.push(row)
      }

      setRegisterPreview({
        validRows,
        duplicates,
        missingFields,
        totalRows: jsonData.length
      })
    } catch (error) {
      displayToast('Failed to analyze file', 'error')
    } finally {
      setAnalyzingRegisterFile(false)
    }
  }

  const handleRegisterDUIDs = async () => {
    if (!registerFile || !selectedSheet || !registerPreview || registerPreview.validRows.length === 0) {
      displayToast('No valid rows to register', 'error')
      return
    }
    
    setRegistering(true)
    
    try {
      const response = await fetch(`${apiBasePath}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetName: selectedSheet,
          rows: registerPreview.validRows
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.details || 'Failed to register DUIDs')
      }

      const result = await response.json()
      
      setImportModalOpen(false)
      setRegisterFile(null)
      setRegisterPreview(null)
      setActiveTab('import')
      
      displayToast(`✅ Successfully registered ${result.addedCount || registerPreview.validRows.length} rows!`, 'success')
      
      setTableRefreshing(true)
      await fetchData(selectedSheet, { showFullLoading: false })
      setTableRefreshing(false)
      
    } catch (error) {
      displayToast(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="h-full flex flex-col pb-2 px-4 pt-4">
      {showToast && (
        <div 
          className="fixed top-20 right-4 z-50 bg-white border-l-4 border-green-500 shadow-lg rounded-lg p-4 max-w-md animate-slide-in"
          style={{ animation: 'slideIn 0.3s ease-out' }}
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
              {pageTitle}
            </h1>
            <p className="mt-0.5 text-xs text-gray-500">
              Manage {pageTitle} data from Google Sheets
            </p>
          </div>
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
      <div className="flex-1 bg-white shadow-sm rounded-lg border border-gray-200 flex flex-col overflow-hidden relative">
        {/* Loading Overlay for Tab Switching */}
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-40 rounded-lg">
            <LoadingSpinner />
          </div>
        )}
        
        {error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-red-500">{error}</p>
          </div>
        ) : data.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No data available. Please select a project.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <HuaweiRolloutTable
              data={data}
              onUpdateData={handleUpdateData}
              onFilteredDataChange={handleFilteredDataChange}
              onExport={handleExport}
              exporting={exporting}
              onImport={() => setImportModalOpen(true)}
              selectedSheet={selectedSheet}
              onExportDataReady={handleExportDataReady}
              onRefresh={handleRefresh}
              refreshing={tableRefreshing}
              importedCells={importedCells}
            />
          </div>
        )}
      </div>

      {/* Import Excel Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Upload className="h-5 w-5 mr-2 text-emerald-600" />
                {activeTab === 'import' ? 'Import Excel File' : 'Register New DUID'}
              </h3>
              <button
                onClick={() => {
                  setImportModalOpen(false)
                  setImportFile(null)
                  setImportPreview(null)
                  setRegisterFile(null)
                  setRegisterPreview(null)
                  setActiveTab('import')
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('import')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'import'
                    ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                📊 Import Data
              </button>
              <button
                onClick={() => setActiveTab('register')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'register'
                    ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                ➕ Register DUID
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5">
              {activeTab === 'import' ? (
                /* Import Tab Content */
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Upload an Excel file to import/update data.
                    </p>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-xs font-medium text-blue-900 mb-1">📋 Import Rules:</p>
                      <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
                        <li><strong>DUID cannot be updated</strong> - used for matching rows</li>
                        <li><strong>Date format:</strong> Only DD-MMM-YYYY or DD/MMM/YYYY (e.g., 05-Jan-2024)</li>
                        <li><strong>Date columns with existing values cannot be updated</strong> (Survey, MOS, Installation, etc.)</li>
                        <li>All other columns can be overwritten with new values</li>
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

                  {/* Import Preview */}
                  {analyzingFile && (
                    <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex items-center">
                        <RefreshCcw className="h-4 w-4 text-blue-600 mr-2 animate-spin" />
                        <p className="text-sm text-blue-700">Analyzing file...</p>
                      </div>
                    </div>
                  )}

                  {importPreview && !analyzingFile && (
                    <div className="mb-4 space-y-2">
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-emerald-900">Cells to Update:</span>
                          <span className="text-lg font-bold text-emerald-700">{importPreview.cellsWillUpdate}</span>
                        </div>
                        <p className="text-xs text-emerald-600 mt-1">
                          Cells that will be created or updated
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-amber-900">Cells to Skip:</span>
                          <span className="text-lg font-bold text-amber-700">{importPreview.cellsWillSkip}</span>
                        </div>
                        <div className="text-xs text-amber-600 mt-1 space-y-0.5">
                          {importPreview.skipReasons.duidColumn > 0 && (
                            <p>• {importPreview.skipReasons.duidColumn} cell(s) - DUID column protected</p>
                          )}
                          {importPreview.skipReasons.dateColumnsProtected > 0 && (
                            <p>• {importPreview.skipReasons.dateColumnsProtected} cell(s) - date columns with existing values</p>
                          )}
                          {importPreview.skipReasons.invalidDateFormat > 0 && (
                            <p>• {importPreview.skipReasons.invalidDateFormat} cell(s) - invalid date format (use DD-MMM-YYYY)</p>
                          )}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-gray-100 border border-gray-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-700">Total Rows:</span>
                          <span className="text-gray-600">{importPreview.totalRows}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                          <span className="font-medium text-gray-700">Total Cells:</span>
                          <span className="text-gray-600">{importPreview.totalCells}</span>
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
                        setImportPreview(null)
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImportExcel}
                      disabled={!importFile || importing || analyzingFile || !importPreview || importPreview.cellsWillUpdate === 0}
                      className="px-4 py-2 text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-600 rounded-lg hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center shadow-sm"
                    >
                      {importing ? (
                        <>
                          <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Import {importPreview ? `(${importPreview.cellsWillUpdate} cells)` : ''}
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                /* Register Tab Content */
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Register new DUID entries (maximum 20 rows).
                    </p>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-xs font-medium text-blue-900 mb-1">📋 Required Fields:</p>
                      <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
                        <li><strong>DUID</strong> - Unique identifier (cannot be duplicate)</li>
                        <li><strong>DU Name</strong> - Site name</li>
                        <li><strong>Region</strong> - Project region</li>
                        <li><strong>Project Code</strong> - From ISDP</li>
                      </ul>
                      <p className="text-xs text-blue-700 mt-2">⚠️ Maximum 20 rows per registration</p>
                    </div>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700 mb-2 block">Select Excel File</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleRegisterFileChange}
                        className="block w-full text-sm text-gray-600
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-lg file:border-0
                          file:text-sm file:font-semibold
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100
                          cursor-pointer"
                      />
                    </label>

                    {registerFile && (
                      <div className="mt-3 flex items-center text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                        <CheckCircle className="h-4 w-4 text-blue-600 mr-2" />
                        <span className="truncate">{registerFile.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Register Preview */}
                  {analyzingRegisterFile && (
                    <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex items-center">
                        <RefreshCcw className="h-4 w-4 text-blue-600 mr-2 animate-spin" />
                        <p className="text-sm text-blue-700">Analyzing file...</p>
                      </div>
                    </div>
                  )}

                  {registerPreview && !analyzingRegisterFile && (
                    <div className="mb-4 space-y-2">
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-emerald-900">Valid Rows:</span>
                          <span className="text-lg font-bold text-emerald-700">{registerPreview.validRows.length}</span>
                        </div>
                        <p className="text-xs text-emerald-600 mt-1">
                          Rows ready to be registered
                        </p>
                      </div>

                      {registerPreview.duplicates.length > 0 && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-red-900">Duplicates Found:</span>
                            <span className="text-lg font-bold text-red-700">{registerPreview.duplicates.length}</span>
                          </div>
                          <p className="text-xs text-red-600 mt-1">
                            DUIDs already exist in the sheet
                          </p>
                        </div>
                      )}

                      {registerPreview.missingFields > 0 && (
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-amber-900">Missing Fields:</span>
                            <span className="text-lg font-bold text-amber-700">{registerPreview.missingFields}</span>
                          </div>
                          <p className="text-xs text-amber-600 mt-1">
                            Rows with incomplete required fields
                          </p>
                        </div>
                      )}

                      <div className="p-2 rounded-lg bg-gray-100 border border-gray-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-700">Total Rows:</span>
                          <span className="text-gray-600">{registerPreview.totalRows}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end space-x-3">
                    <button
                      onClick={() => {
                        setImportModalOpen(false)
                        setRegisterFile(null)
                        setRegisterPreview(null)
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRegisterDUIDs}
                      disabled={!registerFile || registering || analyzingRegisterFile || !registerPreview || registerPreview.validRows.length === 0}
                      className="px-4 py-2 text-sm font-semibold text-blue-800 bg-blue-50 border border-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center shadow-sm"
                    >
                      {registering ? (
                        <>
                          <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                          Registering...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Register {registerPreview ? `(${registerPreview.validRows.length} rows)` : ''}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
