'use client'

import { useState, useEffect, useMemo } from 'react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import * as XLSX from 'xlsx'
import { 
  FileText,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart3,
  Clock,
  Download,
  X,
  Calendar
} from 'lucide-react'

type POStatus = 'ACTIVE' | 'CANCELLED' | 'COMPLETED' | string

// Helper function to compress data for localStorage
const compressData = (data: any[]): string => {
  // Remove unnecessary fields and compress
  const compressed = data.map(row => {
    // Only keep essential fields
    const essential: any = {}
    const keepFields = [
      'Project No.', 'Project Name', 'PO Number', 'Line', 'Ship',
      'Site ID', 'Site ID PO', 'Site Name', 'Area', 'Contract Number',
      'SOW', 'Qty', 'Unit', 'Payment terms', 'Start Date', 'End Date',
      'Amount', 'Invoice Amount', 'Invoice Pending', 'Remaining',
      '_sheet', '_spreadsheet'
    ]
    
    // Find and include status field dynamically
    const statusKey = Object.keys(row).find(key => 
      key.toLowerCase().includes('status') && 
      !key.toLowerCase().includes('site') &&
      !key.toLowerCase().includes('payment')
    )
    if (statusKey) keepFields.push(statusKey)
    
    keepFields.forEach(field => {
      if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
        essential[field] = row[field]
      }
    })
    return essential
  })
  return JSON.stringify(compressed)
}

// Helper function to check localStorage size
const getLocalStorageSize = (): number => {
  let total = 0
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length
    }
  }
  return total
}

// Helper function to safely set localStorage with size check
const safeSetItem = (key: string, value: string): boolean => {
  try {
    // Check if storage would exceed 4MB (safe limit)
    const estimatedSize = value.length + key.length
    if (estimatedSize > 4 * 1024 * 1024) {
      console.warn('Data too large for localStorage, skipping cache')
      return false
    }
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, clearing old cache')
      // Try to clear old PO caches and retry
      localStorage.removeItem('po_huawei_full_data_cache')
      localStorage.removeItem('po_huawei_dashboard_cache')
      try {
        localStorage.setItem(key, value)
        return true
      } catch (retryError) {
        console.error('Still failed after clearing cache')
        return false
      }
    }
    console.error('Error setting localStorage:', e)
    return false
  }
}

// Helper function to check if date is in range
const isDateInRange = (dateStr: string, range: string): boolean => {
  if (!dateStr || range === 'all') return true
  
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return true // If invalid date, include it
  
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  
  switch (range) {
    case 'last-year':
      return date.getFullYear() === currentYear - 1
    case 'this-year':
      return date.getFullYear() === currentYear
    case 'last-6-months':
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      return date >= sixMonthsAgo
    case 'this-month':
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth
    default:
      return true
  }
}

// Helper function to get category (ITC/RNO) from spreadsheet ID
const getCategory = (row: any): string => {
  const spreadsheetId = row._spreadsheet || ''
  // Check if it's an ITC spreadsheet
  if (spreadsheetId.includes('1YrW-8wFZJa5oONp7K_NuEXQVBWC4j-7hjjB59N6-aOk') || // ITC XLS
      spreadsheetId.includes('1rU524RD1Euyth90NxxUw4SkH8ZvupS4BJIJ8cWUzgDo') || // ITC XL
      spreadsheetId.includes('1oRUO9-rfRZbSej8nKbLnbYiDxfggywCD_MmsyDAWGr4') || // ITC IOH
      spreadsheetId.includes('1bA71lqL8UYR5JRtXe5VCrDXz_YoSEg_gqJFp5iEiPnA')) { // ITC TSEL
    return 'ITC'
  }
  // Check if it's an RNO spreadsheet
  if (spreadsheetId.includes('1qDVG6D3BlQ1fJgriDCXBh7PPe6p2cz6JG0awuvw7Y_Q') || // RNO XLS
      spreadsheetId.includes('1qWYSneboefEC8IkYPiKl5X8G2Xlwfa-xeVSDaV6G2h4') || // RNO XL
      spreadsheetId.includes('1QxTcZ0hsFFb0ngHmw9f_QJon4lspzAuRcxsqeU-UyRE') || // RNO IOH
      spreadsheetId.includes('1ncirlBNq-n9Fct4xibTL4jd3zEeqDbu1R1Kd3mZKnU4')) { // RNO TSEL
    return 'RNO'
  }
  return 'Unknown'
}

// Helper function to get main project from spreadsheet ID
const getMainProject = (row: any): string => {
  const spreadsheetId = row._spreadsheet || ''
  // ITC spreadsheets
  if (spreadsheetId.includes('1YrW-8wFZJa5oONp7K_NuEXQVBWC4j-7hjjB59N6-aOk')) return 'XLS'
  if (spreadsheetId.includes('1rU524RD1Euyth90NxxUw4SkH8ZvupS4BJIJ8cWUzgDo')) return 'XL'
  if (spreadsheetId.includes('1oRUO9-rfRZbSej8nKbLnbYiDxfggywCD_MmsyDAWGr4')) return 'IOH'
  if (spreadsheetId.includes('1bA71lqL8UYR5JRtXe5VCrDXz_YoSEg_gqJFp5iEiPnA')) return 'TSEL'
  // RNO spreadsheets
  if (spreadsheetId.includes('1qDVG6D3BlQ1fJgriDCXBh7PPe6p2cz6JG0awuvw7Y_Q')) return 'XLS'
  if (spreadsheetId.includes('1qWYSneboefEC8IkYPiKl5X8G2Xlwfa-xeVSDaV6G2h4')) return 'XL'
  if (spreadsheetId.includes('1QxTcZ0hsFFb0ngHmw9f_QJon4lspzAuRcxsqeU-UyRE')) return 'IOH'
  if (spreadsheetId.includes('1ncirlBNq-n9Fct4xibTL4jd3zEeqDbu1R1Kd3mZKnU4')) return 'TSEL'
  return 'Unknown'
}

// Helper function to get status from row (find status column dynamically)
const getStatus = (row: any): string => {
  // First try standardized column name from API normalization
  if (row['PO Status']) {
    return row['PO Status'].toString()
  }
  
  // Fallback: search for status column (case-insensitive)
  const keys = Object.keys(row)
  const statusKey = keys.find(key => {
    const keyLower = key.toLowerCase().trim()
    return (keyLower === 'po status' || 
            keyLower === 'postatus' || 
            keyLower === 'status po') &&
           !keyLower.includes('site') &&
           !keyLower.includes('payment')
  })
  
  return statusKey && row[statusKey] ? row[statusKey].toString() : 'Unknown'
}

// Helper function to normalize status (case-insensitive)
const normalizeStatus = (status: string | undefined | null): string => {
  const normalized = (status?.toString() || '').toUpperCase().trim()
  
  // Handle variations
  if (normalized === 'CANCELLED' || normalized === 'CANCEL') return 'CANCELLED'
  if (normalized === 'CLOSED' || normalized === 'CLOSE') return 'CLOSED'
  if (normalized === 'LONGAGING' || normalized.includes('LONG')) return 'LONG AGING'
  if (normalized === 'NEW') return 'NEW'
  if (normalized === 'OPEN') return 'OPEN'
  if (normalized === 'ACTIVE') return 'ACTIVE'
  if (normalized === 'COMPLETED' || normalized === 'COMPLETE') return 'COMPLETED'
  
  return normalized || 'Unknown'
}

export default function POHuaweiDashboard() {
  const [allData, setAllData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedMainProject, setSelectedMainProject] = useState<string>('all')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalData, setModalData] = useState<{
    title: string
    sites: any[]
  }>({ title: '', sites: [] })

  // Fetch data
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Check cache first
      const cacheKey = 'po_huawei_full_data_cache'
      const cacheTimestampKey = 'po_huawei_full_data_cache_timestamp'
      const cacheExpiry = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
      
      const cachedData = localStorage.getItem(cacheKey)
      const cachedTimestamp = localStorage.getItem(cacheTimestampKey)
      
      // Check if cache exists and is not expired
      if (cachedData && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp)
        const now = Date.now()
        
        if (now - timestamp < cacheExpiry) {
          // Use cached data
          const cached = JSON.parse(cachedData)
          setAllData(cached)
          setLoading(false)
          return
        }
      }

      // No cache or expired - fetch fresh data
      const response = await fetch('/api/sheets/po-huawei')
      const data = await response.json()

      if (data.success) {
        setAllData(data.data)
        
        // Save to cache with compression and size check
        const compressedData = compressData(data.data)
        const cacheSaved = safeSetItem(cacheKey, compressedData)
        
        if (cacheSaved) {
          safeSetItem(cacheTimestampKey, Date.now().toString())
        } else {
          console.warn('Cache not saved due to size limitations')
        }
      } else {
        setError(data.message || 'Failed to load data')
      }
    } catch (err) {
      setError('Failed to connect to server')
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Get unique projects based on category, main project and date range filters
  const projects = useMemo(() => {
    let filtered = [...allData]
    
    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(row => getCategory(row) === selectedCategory)
    }
    
    // Apply main project filter
    if (selectedMainProject !== 'all') {
      filtered = filtered.filter(row => getMainProject(row) === selectedMainProject)
    }
    
    // Apply date range filter
    if (selectedDateRange !== 'all') {
      filtered = filtered.filter(row => isDateInRange(row['Start Date'], selectedDateRange))
    }
    
    const projectSet = new Set<string>()
    filtered.forEach(row => {
      const project = row['Project Name']
      if (project) projectSet.add(project)
    })
    return Array.from(projectSet).sort()
  }, [allData, selectedCategory, selectedMainProject, selectedDateRange])

  // Filter data
  const filteredData = useMemo(() => {
    let filtered = [...allData]

    // Filter by category (ITC/RNO)
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(row => getCategory(row) === selectedCategory)
    }

    // Filter by main project (XL, XLS, IOH, TSEL)
    if (selectedMainProject !== 'all') {
      filtered = filtered.filter(row => getMainProject(row) === selectedMainProject)
    }

    // Filter by date range
    if (selectedDateRange !== 'all') {
      filtered = filtered.filter(row => isDateInRange(row['Start Date'], selectedDateRange))
    }

    if (selectedProject !== 'all') {
      filtered = filtered.filter(row => row['Project Name'] === selectedProject)
    }

    return filtered
  }, [allData, selectedCategory, selectedMainProject, selectedProject, selectedDateRange])

  // Calculate metrics
  const metrics = useMemo(() => {
    if (filteredData.length === 0) return null

    const totalUniqueSites = new Set(filteredData.map(row => row['Site ID'] || row['Site ID PO'])).size
    const totalLines = filteredData.length
    
    let totalAmount = 0
    let totalInvoiced = 0
    let totalPending = 0
    let totalRemaining = 0
    let cancelledAmount = 0
    let cancelledInvoiced = 0
    let cancelledPending = 0

    const statusCounts: Record<string, number> = {}
    const projectCounts: Record<string, number> = {}
    const areaCounts: Record<string, number> = {}

    filteredData.forEach(row => {
      // Parse amounts
      const amount = parseFloat(row['Amount']?.toString().replace(/,/g, '') || '0')
      const invoiced = parseFloat(row['Invoice Amount']?.toString().replace(/,/g, '') || '0')
      const pending = parseFloat(row['Invoice Pending']?.toString().replace(/,/g, '') || '0')
      const remaining = parseFloat(row['Remaining']?.toString().replace(/,/g, '') || '0')

      // Status counts (original status from data)
      const status = getStatus(row)
      statusCounts[status] = (statusCounts[status] || 0) + 1

      // Check if cancelled to exclude from totals
      const isCancelled = normalizeStatus(status) === 'CANCELLED'

      if (isCancelled) {
        // Track cancelled amounts separately
        cancelledAmount += amount
        cancelledInvoiced += invoiced
        cancelledPending += pending
      } else {
        // Only add non-cancelled to totals
        totalAmount += amount
        totalInvoiced += invoiced
        totalPending += pending
        totalRemaining += remaining
      }

      // Project counts
      const project = row['Project Name'] || 'Unknown'
      projectCounts[project] = (projectCounts[project] || 0) + 1

      // Area counts
      const area = row['Area'] || 'Unknown'
      areaCounts[area] = (areaCounts[area] || 0) + 1
    })

    const invoicedPercentage = totalAmount > 0 ? (totalInvoiced / totalAmount) * 100 : 0
    const pendingPercentage = totalAmount > 0 ? (totalPending / totalAmount) * 100 : 0
    const remainingPercentage = totalAmount > 0 ? (totalRemaining / totalAmount) * 100 : 0

    return {
      totalUniqueSites,
      totalLines,
      totalAmount,
      totalInvoiced,
      totalPending,
      totalRemaining,
      cancelledAmount,
      cancelledInvoiced,
      cancelledPending,
      invoicedPercentage,
      pendingPercentage,
      remainingPercentage,
      statusCounts,
      projectCounts,
      areaCounts,
    }
  }, [filteredData])

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Open modal
  const openModal = (title: string, filterFn: (row: any) => boolean) => {
    const sites = filteredData.filter(filterFn).slice(0, 100)
    setModalData({ title, sites })
    setModalOpen(true)
  }

  // Download Excel
  const downloadExcel = () => {
    const excelData = filteredData.map((row, index) => ({
      No: index + 1,
      'Project No': row['Project No.'] || '',
      'Project Name': row['Project Name'] || '',
      'PO Number': row['PO Number'] || '',
      'Line': row['Line'] || '',
      'Ship': row['Ship'] || '',
      'Site ID': row['Site ID'] || row['Site ID PO'] || '',
      'Site Name': row['Site Name'] || '',
      'Area': row['Area'] || '',
      'Contract Number': row['Contract Number'] || '',
      'SOW': row['SOW'] || '',
      'Qty': row['Qty'] || '',
      'Unit': row['Unit'] || '',
      'Payment terms': row['Payment terms'] || '',
      'Start Date': row['Start Date'] || '',
      'End Date': row['End Date'] || '',
      'PO Status': getStatus(row) || '',
    }))

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'PO Data')

    const projectName = selectedProject !== 'all' ? selectedProject.replace(/\s+/g, '_') : 'AllProjects'
    XLSX.writeFile(wb, `PO_Huawei_${projectName}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 pb-2">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 pb-2">
        <div className="flex flex-col space-y-3">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-4 md:p-5">
            <div className="mb-6">
              <h1 className="text-lg md:text-xl font-semibold text-slate-900 flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <span>PO Huawei Dashboard</span>
              </h1>
              <p className="mt-1 text-xs md:text-sm text-slate-600">
                Purchase Order tracking and analytics
              </p>
            </div>

            {/* Filters - Compact Layout */}
            <div className="space-y-2.5">
              {/* Primary Filters Row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {/* Category Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-700">Category:</label>
                  <div className="flex gap-1.5">
                    {['all', 'ITC', 'RNO'].map((category) => (
                      <button
                        key={category}
                        onClick={() => {
                          setSelectedCategory(category)
                          setSelectedMainProject('all')
                          setSelectedProject('all')
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          selectedCategory === category
                            ? 'bg-purple-50 text-purple-700 border border-purple-100 shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {category === 'all' ? 'All' : category}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-5 w-px bg-slate-300" />

                {/* Main Project Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-700">Project:</label>
                  <div className="flex gap-1.5">
                    {['all', 'XL', 'XLS', 'IOH', 'TSEL'].map((mainProj) => (
                      <button
                        key={mainProj}
                        onClick={() => {
                          setSelectedMainProject(mainProj)
                          setSelectedProject('all')
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          selectedMainProject === mainProj
                            ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {mainProj === 'all' ? 'All' : mainProj}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Date Range & Secondary Filters Row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-slate-200">
                {/* Date Range Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    <Calendar className="h-3.5 w-3.5 inline-block mr-1" />
                    Date:
                  </label>
                  <div className="flex gap-1.5">
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'this-month', label: 'This Month' },
                      { value: 'last-6-months', label: '6 Months' },
                      { value: 'this-year', label: 'This Year' },
                      { value: 'last-year', label: 'Last Year' },
                    ].map((range) => (
                      <button
                        key={range.value}
                        onClick={() => {
                          setSelectedDateRange(range.value)
                          setSelectedProject('all')
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          selectedDateRange === range.value
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-5 w-px bg-slate-300" />

                {/* Project Detail Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-700">Detail:</label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Projects</option>
                    {projects.map((project) => (
                      <option key={project} value={project}>
                        {project}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Download Button */}
                <button
                  onClick={downloadExcel}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5 text-xs font-semibold ml-auto"
                >
                  <Download className="h-3.5 w-3.5" />
                  Excel
                </button>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="text-center py-12">
                  <LoadingSpinner />
                  <p className="mt-4 text-sm text-slate-600 font-medium">Loading PO data...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {!loading && error && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-rose-50 rounded-2xl flex items-center justify-center">
                    <XCircle className="h-8 w-8 text-rose-500" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-2">Error Loading Data</h3>
                  <p className="text-sm text-slate-600 mb-4 font-medium">{error}</p>
                  <button
                    onClick={fetchData}
                    className="px-4 py-2 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Summary Cards - Moved inside header container */}
            {!loading && !error && metrics && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  {/* Total POs */}
                  <div className="group bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Unique Sites</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{metrics.totalUniqueSites}</p>
                        <p className="text-xs text-slate-500 mt-1">{metrics.totalLines} lines</p>
                      </div>
                      <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Total Amount */}
                  <div className="group bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Total Amount</p>
                        <p className="text-lg font-bold text-emerald-600 mt-1">{formatCurrency(metrics.totalAmount)}</p>
                        {metrics.cancelledAmount > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs text-rose-600 font-medium">Cancelled: {formatCurrency(metrics.cancelledAmount)}</p>
                          </div>
                        )}
                      </div>
                      <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <DollarSign className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Invoiced */}
                  <div 
                    className="group bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                    onClick={() => openModal('Invoiced Items', row => parseFloat(row['Invoice Amount']?.toString().replace(/,/g, '') || '0') > 0)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Invoiced</p>
                        <p className="text-lg font-bold text-blue-600 mt-1">{formatCurrency(metrics.totalInvoiced)}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="px-2 py-0.5 bg-blue-50 rounded-full">
                            <p className="text-xs font-semibold text-blue-700">{metrics.invoicedPercentage.toFixed(1)}%</p>
                          </div>
                        </div>
                        {metrics.cancelledInvoiced > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs text-rose-600 font-medium">Cancelled: {formatCurrency(metrics.cancelledInvoiced)}</p>
                          </div>
                        )}
                      </div>
                      <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Pending */}
                  <div 
                    className="group bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                    onClick={() => openModal('Pending Items', row => parseFloat(row['Invoice Pending']?.toString().replace(/,/g, '') || '0') > 0)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Pending</p>
                        <p className="text-lg font-bold text-amber-600 mt-1">{formatCurrency(metrics.totalPending)}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="px-2 py-0.5 bg-amber-50 rounded-full">
                            <p className="text-xs font-semibold text-amber-700">{metrics.pendingPercentage.toFixed(1)}%</p>
                          </div>
                        </div>
                        {metrics.cancelledPending > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs text-rose-600 font-medium">Cancelled: {formatCurrency(metrics.cancelledPending)}</p>
                          </div>
                        )}
                      </div>
                      <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <Clock className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Charts Section - Moved inside header container */}
            {!loading && !error && metrics && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {/* Status Distribution */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                        <BarChart3 className="h-4 w-4 text-white" />
                      </div>
                      PO Status Distribution
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(metrics.statusCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([status, count]) => {
                          const percentage = ((count / metrics.totalLines) * 100).toFixed(1)
                          const statusUpper = status.toUpperCase()
                          const colorClass = statusUpper.includes('ACTIVE') || statusUpper.includes('AKTIF') ? 'from-emerald-500 to-green-600' :
                                           statusUpper.includes('CANCEL') || statusUpper.includes('BATAL') ? 'from-rose-500 to-red-600' :
                                           statusUpper.includes('COMPLET') || statusUpper.includes('SELESAI') ? 'from-blue-500 to-indigo-600' :
                                           statusUpper.includes('CLOSE') || statusUpper.includes('TUTUP') ? 'from-blue-500 to-indigo-600' :
                                           statusUpper.includes('AGING') || statusUpper.includes('LAMA') ? 'from-amber-500 to-orange-600' :
                                           statusUpper.includes('NEW') || statusUpper.includes('BARU') ? 'from-purple-500 to-violet-600' :
                                           statusUpper.includes('OPEN') || statusUpper.includes('BUKA') ? 'from-cyan-500 to-blue-600' :
                                           'from-slate-500 to-slate-600'
                          return (
                            <div key={status}>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-semibold text-slate-700">{status}</span>
                                <span className="text-slate-600">{count} ({percentage}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2">
                                <div
                                  className={`bg-gradient-to-r ${colorClass} h-2 rounded-full transition-all`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>

                  {/* Area Distribution */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <div className="p-1.5 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg">
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                      Area Distribution
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(metrics.areaCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([area, count]) => {
                          const percentage = ((count / metrics.totalLines) * 100).toFixed(1)
                          return (
                            <div key={area}>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-semibold text-slate-700">{area}</span>
                                <span className="text-slate-600">{count} ({percentage}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2">
                                <div
                                  className="bg-gradient-to-r from-purple-500 to-violet-600 h-2 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg">
                        <DollarSign className="h-4 w-4 text-white" />
                      </div>
                      Financial Breakdown
                    </h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Total Amount', value: metrics.totalAmount, color: 'from-slate-500 to-slate-600' },
                        { label: 'Invoiced', value: metrics.totalInvoiced, color: 'from-blue-500 to-indigo-600' },
                        { label: 'Pending', value: metrics.totalPending, color: 'from-amber-500 to-orange-600' },
                        { label: 'Remaining', value: metrics.totalRemaining, color: 'from-rose-500 to-red-600' },
                      ].map((item) => {
                        const percentage = ((item.value / metrics.totalAmount) * 100).toFixed(1)
                        return (
                          <div key={item.label}>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="font-semibold text-slate-700">{item.label}</span>
                              <span className="text-slate-600">{formatCurrency(item.value)}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div
                                className={`bg-gradient-to-r ${item.color} h-2 rounded-full transition-all`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">{modalData.title}</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-900">Site ID</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-900">Site Name</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-900">Area</th>
                      <th className="px-4 py-3 text-center font-medium text-slate-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.sites.map((site, index) => (
                      <tr key={index} className="hover:bg-slate-50 border-b border-slate-100">
                        <td className="px-4 py-3 font-mono text-slate-900">{site['Site ID'] || site['Site ID PO']}</td>
                        <td className="px-4 py-3 text-slate-900">{site['Site Name']}</td>
                        <td className="px-4 py-3 text-slate-900">{site['Area']}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            normalizeStatus(getStatus(site)) === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' :
                            normalizeStatus(getStatus(site)) === 'CANCELLED' ? 'bg-rose-50 text-rose-700' :
                            normalizeStatus(getStatus(site)) === 'COMPLETED' ? 'bg-blue-50 text-blue-700' :
                            normalizeStatus(getStatus(site)) === 'CLOSED' ? 'bg-blue-50 text-blue-700' :
                            normalizeStatus(getStatus(site)) === 'LONG AGING' ? 'bg-amber-50 text-amber-700' :
                            normalizeStatus(getStatus(site)) === 'NEW' ? 'bg-purple-50 text-purple-700' :
                            normalizeStatus(getStatus(site)) === 'OPEN' ? 'bg-cyan-50 text-cyan-700' :
                            'bg-slate-50 text-slate-700'
                          }`}>
                            {getStatus(site)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
