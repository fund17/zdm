'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { HuaweiRolloutTable } from '@/components/HuaweiRolloutTable'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { RefreshCcw, Download, Database, Upload, X, CheckCircle, AlertCircle } from 'lucide-react'
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

export default function ItcHuaweiPage() {
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
  const [importedCells, setImportedCells] = useState<Set<string>>(new Set()) // Track imported cells: "DUID-columnId"
  
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

  const fetchData = useCallback(async (sheetName?: string, options?: { showFullLoading?: boolean }) => {
    try {
      if (options?.showFullLoading !== false) setLoading(true)
      
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
      if (options?.showFullLoading !== false) setLoading(false)
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
    setTableRefreshing(true)
    // Suppress full-page loading when refresh is triggered from the table
    await fetchData(selectedSheet, { showFullLoading: false })
    setTableRefreshing(false)
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
          rowIdentifierColumn: 'DUID',
          sheetName: selectedSheet
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update data')
      }
      
    } catch (error) {
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
      
      if (dataToExport.length === 0) {
        displayToast('No data to export', 'error')
        setExporting(false)
        return
      }

      // Use LOCAL data from table (no server fetch)
      const { columns: visibleColumns, poStatusMap } = exportData

      // Helper: robust resolver to find the actual key in row for given column config
      const resolveRowValue = (row: Record<string, any>, col: { name: string; displayName: string }) => {
        if (!row || !col) return ''
        let value = row[col.name]
        if (value === undefined || value === null) {
          value = row[col.displayName]
        }
        if (value === undefined || value === null) {
          const matchingKey = Object.keys(row).find(
            key => key.toLowerCase() === col.name.toLowerCase() ||
                   key.toLowerCase() === col.displayName.toLowerCase()
          )
          if (matchingKey) value = row[matchingKey]
        }
        if (value === undefined || value === null) {
          const matchingKey = Object.keys(row).find(
            key => key.replace(/\s+/g, '') === col.name.replace(/\s+/g, '') ||
                   key.replace(/\s+/g, '') === col.displayName.replace(/\s+/g, '')
          )
          if (matchingKey) value = row[matchingKey]
        }
        if (value === undefined || value === null) {
          const matchingKey = Object.keys(row).find(
            key => key.trim() === col.name.trim() ||
                   key.trim() === col.displayName.trim()
          )
          if (matchingKey) value = row[matchingKey]
        }
        return value === undefined || value === null ? '' : value
      }
      
      // Prepare data for XLSX (optimized - build array directly)
      const includePOStatus = exportData.includePOStatus ?? false
      const headers = [...visibleColumns.map((col) => col.displayName), ...(includePOStatus ? ['PO Status'] : [])]
      
      // Build data array (faster than creating objects)
      const excelData = [headers]
      
      // Process rows - use ONLY visible columns from table
      for (let i = 0; i < dataToExport.length; i++) {
        const row = dataToExport[i]
        const rowData: any[] = []
        
        // Add visible column values
        for (let j = 0; j < visibleColumns.length; j++) {
          const col = visibleColumns[j]
          const value = resolveRowValue(row, col)
          rowData.push(value !== null && value !== undefined ? value : '')
        }
        
        // Add PO Status (case-insensitive lookup) if visible
        const duid = row['DUID'] || row['duid']
        if (includePOStatus && duid) {
          const poKey = Object.keys(poStatusMap || {}).find(k => k.toLowerCase() === duid.toString().toLowerCase())
          const status = poKey ? poStatusMap[poKey] : null
          rowData.push(status?.percentage !== undefined ? `${status.percentage}%` : '-')
        } else {
          if (includePOStatus) rowData.push('-')
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

  // Validate and convert date format to DD-MMM-YYYY
  const validateAndConvertDate = (value: any): string | null => {
    if (!value) return null
    
    const dateStr = value.toString().trim()
    if (!dateStr) return null
    
    // Check if already in DD-MMM-YYYY format (e.g., "05-Jan-2024" or "05/Jan/2024")
    const ddMmmYyyyPattern = /^\d{1,2}[-\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\/]\d{4}$/i
    if (ddMmmYyyyPattern.test(dateStr)) {
      // Normalize separator to dash
      return dateStr.replace(/\//g, '-')
    }
    
    // If it's Excel serial number, convert it
    if (typeof value === 'number' && value > 0 && value < 100000) {
      const date = new Date((value - 25569) * 86400 * 1000)
      const day = String(date.getDate()).padStart(2, '0')
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = months[date.getMonth()]
      const year = date.getFullYear()
      return `${day}-${month}-${year}`
    }
    
    // Reject other formats (like dd/mm/yy or mm/dd/yy - ambiguous!)
    return null
  }

  // Handle file selection and analyze
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImportFile(file)
    setImportPreview(null)
    setAnalyzingFile(true)
    
    try {
      // Read and analyze Excel file
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

      // Get date column names (flexible matching)
      const dateColumnNames = ['Survey', 'MOS', 'Installation', 'Integration', 'ATP Approved', 'ATP CME', 'TSSR Closed', 'BPUJL', 'Inbound']
      
      // Convert date formats in jsonData
      jsonData = jsonData.map(row => {
        const newRow: any = {}
        for (const [key, value] of Object.entries(row)) {
          const isDateColumn = dateColumnNames.some(dateCol => 
            key.toLowerCase().includes(dateCol.toLowerCase()) ||
            dateCol.toLowerCase().includes(key.toLowerCase())
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

      // Analyze data based on PER-CELL rules
      let cellsWillUpdate = 0
      let duidColumnCount = 0
      let dateColumnsProtected = 0
      let invalidDateFormat = 0
      let totalCells = 0
      
      for (const excelRow of jsonData) {
        const duid = excelRow['DUID'] || excelRow['duid']
        
        // Find existing row in current data
        const existingRow = data.find(row => row.DUID === duid || row.duid === duid)
        
        // Count cells in this row
        const cellsInRow = Object.keys(excelRow).length
        totalCells += cellsInRow
        
        // Analyze each cell
        for (const [excelKey, excelValue] of Object.entries(excelRow)) {
          // Rule 1: DUID column cannot be updated (always skip)
          if (excelKey.toLowerCase() === 'duid') {
            duidColumnCount++
            continue
          }
          
          // Check if this is a date column
          const isDateColumn = dateColumnNames.some(dateCol => 
            excelKey.toLowerCase().includes(dateCol.toLowerCase()) ||
            dateCol.toLowerCase().includes(excelKey.toLowerCase())
          )
          
          // Rule 2: Date column - validate format
          if (isDateColumn && excelValue) {
            const convertedDate = validateAndConvertDate(excelValue)
            if (!convertedDate) {
              invalidDateFormat++
              continue // Skip invalid date format
            }
          }
          
          // Rule 3: Date column with existing value is protected
          if (isDateColumn && existingRow) {
            const existingValue = existingRow[excelKey]
            if (existingValue && existingValue !== '' && existingValue !== null) {
              dateColumnsProtected++
              continue // Skip this cell only, not entire row
            }
          }
          
          // Rule 4: All other cells can be updated if value is different
          if (!existingRow) {
            // New row - all cells (except DUID) will be added
            cellsWillUpdate++
          } else {
            // Existing row - check if value is different
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

  // Handle register file selection and analyze
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
      let jsonData: any[] = XLSX.utils.sheet_to_json(worksheet)
      
      // Validate max 20 rows
      if (jsonData.length > 20) {
        displayToast('Maximum 20 rows allowed for registration', 'error')
        setAnalyzingRegisterFile(false)
        return
      }
      
      // Required fields
      const requiredFields = ['DUID', 'DU Name', 'Region', 'Project Code']
      
      // Validate and check duplicates
      const validRows: any[] = []
      const duplicates: string[] = []
      let missingFieldsCount = 0
      
      // Get existing DUIDs from current data
      const existingDUIDs = new Set(data.map(row => row.DUID || row.duid))
      
      for (const row of jsonData) {
        // Check required fields
        const hasMissingFields = requiredFields.some(field => {
          const value = row[field] || row[field.toLowerCase()] || row[field.replace(/\s+/g, '')]
          return !value || value.toString().trim() === ''
        })
        
        if (hasMissingFields) {
          missingFieldsCount++
          continue
        }
        
        // Get DUID
        const duid = row['DUID'] || row['duid'] || row['Duid']
        
        // Check for duplicates in existing data
        if (existingDUIDs.has(duid)) {
          duplicates.push(duid)
          continue
        }
        
        // Check for duplicates in current file
        if (validRows.some(r => r.DUID === duid)) {
          duplicates.push(duid)
          continue
        }
        
        validRows.push({
          DUID: duid,
          'DU Name': row['DU Name'] || row['DUName'] || row['du name'] || row['duname'],
          Region: row['Region'] || row['region'],
          'Project Code': row['Project Code'] || row['ProjectCode'] || row['project code'] || row['projectcode']
        })
      }
      
      const previewData = {
        validRows,
        duplicates,
        missingFields: missingFieldsCount,
        totalRows: jsonData.length
      }
      
      
      setRegisterPreview(previewData)
      
    } catch (error) {
      displayToast('Failed to analyze file', 'error')
    } finally {
      setAnalyzingRegisterFile(false)
    }
  }

  // Handle register execution
  const handleRegisterDUID = async () => {
    if (!registerFile || !selectedSheet || !registerPreview || registerPreview.validRows.length === 0) {
      displayToast('No valid rows to register', 'error')
      return
    }
    
    if (registerPreview.duplicates.length > 0) {
      displayToast(`Cannot register: ${registerPreview.duplicates.length} duplicate DUID(s) found`, 'error')
      return
    }
    
    setRegistering(true)
    
    try {
      const response = await fetch('/api/sheets/itc-huawei/register', {
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
        throw new Error(errorData.error || 'Failed to register DUIDs')
      }

      const result = await response.json()
      
      // Close modal
      setImportModalOpen(false)
      setRegisterFile(null)
      setRegisterPreview(null)
      setActiveTab('import')
      
      // Show success toast
      displayToast(`✅ Successfully registered ${result.count || registerPreview.validRows.length} DUID(s)!`, 'success')
      
      // Refresh data
      setTableRefreshing(true)
      await fetchData(selectedSheet, { showFullLoading: false })
      setTableRefreshing(false)
      
    } catch (error) {
      displayToast(`Register failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setRegistering(false)
    }
  }

  // Handle import execution
  const handleImportExcel = async () => {
    if (!importFile || !selectedSheet) {
      displayToast('Please select a file and project first', 'error')
      return
    }
    
    setImporting(true)
    
    try {
      // Read Excel file
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

      // Send to batch update API with rules
      const response = await fetch('/api/sheets/itc-huawei/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetName: selectedSheet,
          updates: jsonData, // Send all rows, API will apply rules
          bulkImport: true
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to import data')
      }

      const result = await response.json()
      
      // Track which cells were imported for highlighting
      const importedCellsSet = new Set<string>()
      if (result.importedCells && Array.isArray(result.importedCells)) {
        result.importedCells.forEach((cell: { duid: string; column: string }) => {
          importedCellsSet.add(`${cell.duid}-${cell.column}`)
        })
      }
      setImportedCells(importedCellsSet)
      
      // Auto-clear highlight after 10 seconds
      setTimeout(() => {
        setImportedCells(new Set())
      }, 10000)
      
      // Close modal
      setImportModalOpen(false)
      setImportFile(null)
      setImportPreview(null)
      
      // Show success toast
      displayToast(`✅ Successfully imported ${result.updatedCount || importPreview?.cellsWillUpdate || 0} cells!`, 'success')
      
      // Refresh data
      setTableRefreshing(true)
      await fetchData(selectedSheet, { showFullLoading: false })
      setTableRefreshing(false)
      
    } catch (error) {
      displayToast(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setImporting(false)
    }
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
        
        <div className="flex-1 overflow-hidden">
          <HuaweiRolloutTable 
            data={data} 
            onUpdateData={handleUpdateData}
            rowIdColumn="DUID"
            onFilteredDataChange={setFilteredData}
            onExport={handleExport}
            exporting={exporting}
            loading={tableRefreshing}
            error={error}
            selectedSheet={selectedSheet}
            onExportDataReady={setExportData}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            onImport={() => setImportModalOpen(true)}
            importedCells={importedCells}
          />
        </div>
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

                  {/* Preview Table for Valid Rows */}
                  {registerPreview.validRows.length > 0 && (
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">DUID</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">DU Name</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Region</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Project Code</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {registerPreview.validRows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-gray-900 font-medium">{row.DUID}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-gray-700">{row['DU Name']}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-gray-700">{row.Region}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-gray-700">{row['Project Code']}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(registerPreview.duplicates.length > 0 || registerPreview.missingFields > 0) && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-red-900">Issues Found:</span>
                        <span className="text-lg font-bold text-red-700">
                          {registerPreview.duplicates.length + registerPreview.missingFields}
                        </span>
                      </div>
                      <div className="text-xs text-red-600 space-y-0.5">
                        {registerPreview.duplicates.length > 0 && (
                          <div>
                            <p className="font-semibold">• Duplicate DUIDs ({registerPreview.duplicates.length}):</p>
                            <div className="ml-4 mt-1 max-h-20 overflow-y-auto bg-red-100 rounded p-2">
                              {registerPreview.duplicates.map((duid, idx) => (
                                <div key={idx} className="text-red-800">- {duid}</div>
                              ))}
                            </div>
                          </div>
                        )}
                        {registerPreview.missingFields > 0 && (
                          <p>• {registerPreview.missingFields} row(s) with missing required fields</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-2 rounded-lg bg-gray-100 border border-gray-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700">Total Rows in File:</span>
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
                    setActiveTab('import')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegisterDUID}
                  disabled={
                    !registerFile || 
                    registering || 
                    analyzingRegisterFile || 
                    !registerPreview || 
                    registerPreview.validRows.length === 0 ||
                    (registerPreview.duplicates && registerPreview.duplicates.length > 0)
                  }
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
