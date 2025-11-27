'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import * as XLSX from 'xlsx'
import { 
  Database, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  BarChart3,
  PieChart,
  Calendar,
  Users,
  Download,
  X,
  FileCheck
} from 'lucide-react'

interface SheetListItem {
  sheetName: string
  title: string
}

type PeriodFilter = 'all' | 'custom' | 'year' | 'sixmonths' | 'month' | 'week' | 'lastweek'

interface DateRange {
  startDate: string
  endDate: string
}

export default function ItcHuaweiDashboard() {
  // Set dynamic page title
  useEffect(() => {
    document.title = 'ZMG - Dashboard ITC Huawei'
  }, [])

  const [allData, setAllData] = useState<any[]>([]) // Combined data from all sheets
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetList, setSheetList] = useState<SheetListItem[]>([])
  const [loadingSheetList, setLoadingSheetList] = useState(true)
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: '', endDate: '' })
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [showRegionDropdown, setShowRegionDropdown] = useState(false)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'site' | 'team' | 'totalSites'>('site')
  const [modalData, setModalData] = useState<{ title: string; sites: any[]; allSites: any[] }>({ title: '', sites: [], allSites: [] })
  const [clickedTeamIndex, setClickedTeamIndex] = useState<number | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [poRemainingMap, setPoRemainingMap] = useState<Record<string, number>>({})
  const [poRemainingSurveyMap, setPoRemainingSurveyMap] = useState<Record<string, number>>({})
  const [poRemainingDismantleMap, setPoRemainingDismantleMap] = useState<Record<string, number>>({})
  const [poRemainingATPMap, setPoRemainingATPMap] = useState<Record<string, number>>({})
  const [poRemainingPLNMap, setPoRemainingPLNMap] = useState<Record<string, number>>({})
  const [invoicePendingMap, setInvoicePendingMap] = useState<Record<string, number>>({})
  const [invoicePendingSurveyMap, setInvoicePendingSurveyMap] = useState<Record<string, number>>({})
  const [invoicePendingDismantleMap, setInvoicePendingDismantleMap] = useState<Record<string, number>>({})
  const [invoicePendingATPMap, setInvoicePendingATPMap] = useState<Record<string, number>>({})
  const [invoicePendingPLNMap, setInvoicePendingPLNMap] = useState<Record<string, number>>({})

  const fetchAllData = async () => {
    try {
      setLoading(true)
      
      // Fetch all sheets in parallel with Vercel Edge cache
      const promises = sheetList.map(sheet => 
        fetch(`/api/sheets/itc-huawei?sheetName=${sheet.sheetName}`, {
          next: { revalidate: 600 } // 10 minutes cache
        })
          .then(res => res.json())
          .then(result => ({
            sheetName: sheet.sheetName,
            title: sheet.title,
            data: result.data || []
          }))
      )
      
      const results = await Promise.all(promises)
      
      // Combine all data with project field
      const combined = results.flatMap(result => 
        result.data.map((row: any) => ({
          ...row,
          _project: result.title, // Add project name from sheet title
          _sheetName: result.sheetName
        }))
      )
      
      setAllData(combined)
      
      // Load PO Huawei data from cache and create Site ID → PO Remaining % map
      loadPOData()
      
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const loadPOData = async () => {
    try {
      // Fetch PO data from API with 7-day cache (leveraging Vercel Edge)
      const response = await fetch('/api/sheets/po-huawei', {
        next: { revalidate: 604800 } // 7 days cache
      })
      
      const result = await response.json()
      
      if (!result.success || !result.data) {
        return
      }
      
      const poData = result.data
      
      // Create Site ID → PO Remaining % map
      const sitePoMap: Record<string, { count: number; totalRemaining: number }> = {}
      
      // Separate maps for different SOW types
      const sitePoMapSurvey: Record<string, { count: number; totalRemaining: number }> = {}
      const sitePoMapDismantle: Record<string, { count: number; totalRemaining: number }> = {}
      const sitePoMapATP: Record<string, { count: number; totalRemaining: number }> = {} // Not survey, not dismantle, not pln
      const sitePoMapPLN: Record<string, { count: number; totalRemaining: number }> = {}
      
      poData.forEach((row: any) => {
        // Try multiple site ID fields
        const siteId = row['Site ID'] || row['Site ID PO'] || row['SiteID'] || row['Site']
        if (!siteId) return
        
        // Multiple normalization attempts for matching
        const normalizations = [
          siteId.toString().toUpperCase().trim(), // Uppercase original
          siteId.toString().toLowerCase().trim(), // Lowercase original
          siteId.toString().toUpperCase().trim().replace(/\s+/g, ''), // No spaces uppercase
          siteId.toString().toLowerCase().trim().replace(/\s+/g, ''), // No spaces lowercase
        ]
        
        // Parse amounts - handle both string and number formats
        const amountStr = row['Amount']?.toString().replace(/,/g, '').replace(/[^\d.-]/g, '') || '0'
        const remainingStr = row['Remaining']?.toString().replace(/,/g, '').replace(/[^\d.-]/g, '') || '0'
        
        const amount = parseFloat(amountStr)
        const remaining = parseFloat(remainingStr)
        
        // Remaining is already in currency, calculate percentage
        // If remaining is already a percentage (0-100), use it directly
        // Otherwise calculate: (remaining / amount) * 100
        let remainingPercent = 0
        
        if (remaining > 0 && remaining <= 1) {
          // Already a decimal percentage (0.2 = 20%), convert to percentage
          remainingPercent = remaining * 100
        } else if (remaining > 1 && remaining <= 100) {
          // Already a percentage (20 = 20%)
          remainingPercent = remaining
        } else if (amount > 0) {
          // Currency amount, calculate percentage
          remainingPercent = (remaining / amount) * 100
        }
        
        // Check SOW field for survey, dismantle, and pln
        const sow = row['SOW']?.toString().toLowerCase() || ''
        const isSurvey = sow.includes('survey')
        const isDismantle = sow.includes('dismantle')
        const isPLN = sow.includes('pln')
        const isATP = !isSurvey && !isDismantle && !isPLN // ATP = not survey, not dismantle, not pln
        
        // Store for all normalization variants
        normalizations.forEach(normalizedId => {
          if (!sitePoMap[normalizedId]) {
            sitePoMap[normalizedId] = { count: 0, totalRemaining: 0 }
          }
          sitePoMap[normalizedId].count++
          sitePoMap[normalizedId].totalRemaining += remainingPercent
          
          // Store in survey map if SOW contains "survey"
          if (isSurvey) {
            if (!sitePoMapSurvey[normalizedId]) {
              sitePoMapSurvey[normalizedId] = { count: 0, totalRemaining: 0 }
            }
            sitePoMapSurvey[normalizedId].count++
            sitePoMapSurvey[normalizedId].totalRemaining += remainingPercent
          }
          
          // Store in dismantle map if SOW contains "dismantle"
          if (isDismantle) {
            if (!sitePoMapDismantle[normalizedId]) {
              sitePoMapDismantle[normalizedId] = { count: 0, totalRemaining: 0 }
            }
            sitePoMapDismantle[normalizedId].count++
            sitePoMapDismantle[normalizedId].totalRemaining += remainingPercent
          }
          
          // Store in PLN map if SOW contains "pln"
          if (isPLN) {
            if (!sitePoMapPLN[normalizedId]) {
              sitePoMapPLN[normalizedId] = { count: 0, totalRemaining: 0 }
            }
            sitePoMapPLN[normalizedId].count++
            sitePoMapPLN[normalizedId].totalRemaining += remainingPercent
          }
          
          // Store in ATP map if SOW does NOT contain "survey", "dismantle", or "pln"
          if (isATP) {
            if (!sitePoMapATP[normalizedId]) {
              sitePoMapATP[normalizedId] = { count: 0, totalRemaining: 0 }
            }
            sitePoMapATP[normalizedId].count++
            sitePoMapATP[normalizedId].totalRemaining += remainingPercent
          }
        })
      })
      
      // Calculate averages and create final maps
      const finalMap: Record<string, number> = {}
      Object.entries(sitePoMap).forEach(([siteId, data]) => {
        finalMap[siteId] = data.totalRemaining / data.count
      })
      
      const finalMapSurvey: Record<string, number> = {}
      Object.entries(sitePoMapSurvey).forEach(([siteId, data]) => {
        finalMapSurvey[siteId] = data.totalRemaining / data.count
      })
      
      const finalMapDismantle: Record<string, number> = {}
      Object.entries(sitePoMapDismantle).forEach(([siteId, data]) => {
        finalMapDismantle[siteId] = data.totalRemaining / data.count
      })
      
      const finalMapATP: Record<string, number> = {}
      Object.entries(sitePoMapATP).forEach(([siteId, data]) => {
        finalMapATP[siteId] = data.totalRemaining / data.count
      })
      
      const finalMapPLN: Record<string, number> = {}
      Object.entries(sitePoMapPLN).forEach(([siteId, data]) => {
        finalMapPLN[siteId] = data.totalRemaining / data.count
      })
      
      setPoRemainingMap(finalMap)
      setPoRemainingSurveyMap(finalMapSurvey)
      setPoRemainingDismantleMap(finalMapDismantle)
      setPoRemainingATPMap(finalMapATP)
      setPoRemainingPLNMap(finalMapPLN)
      
      // Create Invoice Pending maps (sum of Invoice Pending column, only for non-cancelled POs)
      const invoicePendingMapAll: Record<string, number> = {}
      const invoicePendingMapSurvey: Record<string, number> = {}
      const invoicePendingMapDismantle: Record<string, number> = {}
      const invoicePendingMapATP: Record<string, number> = {}
      const invoicePendingMapPLN: Record<string, number> = {}
      
      poData.forEach((row: any) => {
        const siteId = row['Site ID'] || row['Site ID PO'] || row['SiteID'] || row['Site']
        if (!siteId) return
        
        // Check PO Status - skip if cancelled
        const poStatus = row['PO Status']?.toString().toLowerCase() || ''
        if (poStatus.includes('cancel')) return
        
        const normalizations = [
          siteId.toString().toUpperCase().trim(),
          siteId.toString().toLowerCase().trim(),
          siteId.toString().toUpperCase().trim().replace(/\s+/g, ''),
          siteId.toString().toLowerCase().trim().replace(/\s+/g, ''),
        ]
        
        // Parse Invoice Pending amount
        const invoicePendingStr = row['Invoice Pending']?.toString().replace(/,/g, '').replace(/[^\d.-]/g, '') || '0'
        const invoicePending = parseFloat(invoicePendingStr)
        
        // Check SOW field
        const sow = row['SOW']?.toString().toLowerCase() || ''
        const isSurvey = sow.includes('survey')
        const isDismantle = sow.includes('dismantle')
        const isPLN = sow.includes('pln')
        const isATP = !isSurvey && !isDismantle && !isPLN
        
        // Add to maps for all normalizations
        normalizations.forEach(normalizedId => {
          // All
          if (!invoicePendingMapAll[normalizedId]) {
            invoicePendingMapAll[normalizedId] = 0
          }
          invoicePendingMapAll[normalizedId] += invoicePending
          
          // Survey
          if (isSurvey) {
            if (!invoicePendingMapSurvey[normalizedId]) {
              invoicePendingMapSurvey[normalizedId] = 0
            }
            invoicePendingMapSurvey[normalizedId] += invoicePending
          }
          
          // Dismantle
          if (isDismantle) {
            if (!invoicePendingMapDismantle[normalizedId]) {
              invoicePendingMapDismantle[normalizedId] = 0
            }
            invoicePendingMapDismantle[normalizedId] += invoicePending
          }
          
          // PLN
          if (isPLN) {
            if (!invoicePendingMapPLN[normalizedId]) {
              invoicePendingMapPLN[normalizedId] = 0
            }
            invoicePendingMapPLN[normalizedId] += invoicePending
          }
          
          // ATP
          if (isATP) {
            if (!invoicePendingMapATP[normalizedId]) {
              invoicePendingMapATP[normalizedId] = 0
            }
            invoicePendingMapATP[normalizedId] += invoicePending
          }
        })
      })
      
      setInvoicePendingMap(invoicePendingMapAll)
      setInvoicePendingSurveyMap(invoicePendingMapSurvey)
      setInvoicePendingDismantleMap(invoicePendingMapDismantle)
      setInvoicePendingATPMap(invoicePendingMapATP)
      setInvoicePendingPLNMap(invoicePendingMapPLN)
    } catch (err) {
      // Silent error
    }
  }

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
    if (sheetList.length > 0) {
      fetchAllData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetList])

  // Helper function to parse date with multiple formats
  const parseDate = useCallback((dateStr: string): Date | null => {
    if (!dateStr || dateStr === 'N/A' || dateStr === '#REF!' || dateStr === '-') return null
    
    try {
      // Check if it's an Excel serial date number (e.g., 45982)
      // Excel stores dates as number of days since 1900-01-01
      const serialNumberMatch = dateStr.toString().match(/^\d+$/)
      if (serialNumberMatch) {
        const serialNumber = parseInt(dateStr, 10)
        // Excel serial dates are typically between 1 (1900-01-01) and 60000 (year 2064)
        if (serialNumber >= 1 && serialNumber <= 60000) {
          // Excel epoch starts at 1900-01-01, but Excel incorrectly treats 1900 as a leap year
          // So we need to account for this: day 60 is 1900-02-29 (which doesn't exist)
          // Use UTC to avoid timezone offset issues
          let days = serialNumber - 1
          if (serialNumber > 60) {
            days = days - 1
          }
          const excelEpoch = Date.UTC(1900, 0, 1)
          return new Date(excelEpoch + days * 24 * 60 * 60 * 1000)
        }
      }
      
      // Try dd-MMM-yyyy format FIRST (like 24-Nov-2025) - PRIMARY FORMAT FROM DISPLAY
      const ddMmmYyyyMatch = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
      if (ddMmmYyyyMatch) {
        const day = parseInt(ddMmmYyyyMatch[1], 10)
        const monthStr = ddMmmYyyyMatch[2].toLowerCase()
        const year = parseInt(ddMmmYyyyMatch[3], 10)
        const monthMap: Record<string, number> = {
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        }
        const month = monthMap[monthStr]
        if (month !== undefined && day >= 1 && day <= 31) {
          const date = new Date(year, month, day)
          if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
            return date
          }
        }
      }
      
      // Try DD/MM/YYYY format (02/11/2025)
      const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10)
        const month = parseInt(ddmmyyyyMatch[2], 10) - 1 // Month is 0-indexed in JS Date
        const year = parseInt(ddmmyyyyMatch[3], 10)
        
        // Validate date components
        if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1900) {
          const date = new Date(year, month, day)
          // Double check: ensure the date components match what we set
          if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
            return date
          }
        }
        return null
      }
      
      // Try DD/MM/YY format (13/10/25)
      const ddmmyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
      if (ddmmyyMatch) {
        const day = parseInt(ddmmyyMatch[1], 10)
        const month = parseInt(ddmmyyMatch[2], 10) - 1 // Month is 0-indexed
        const year = 2000 + parseInt(ddmmyyMatch[3], 10) // Assume 20xx
        
        // Validate date components
        if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
          const date = new Date(year, month, day)
          if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
            return date
          }
        }
        return null
      }
      
      // Try DD-MMM-YYYY format (12-Agu-2025)
      const ddmmmyyyyMatch = dateStr.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/)
      if (ddmmmyyyyMatch) {
        const day = parseInt(ddmmmyyyyMatch[1], 10)
        const monthStr = ddmmmyyyyMatch[2].toLowerCase()
        const year = parseInt(ddmmmyyyyMatch[3], 10)
        
        // Indonesian month names
        const monthMap: Record<string, number> = {
          'jan': 0, 'januari': 0,
          'feb': 1, 'februari': 1,
          'mar': 2, 'maret': 2,
          'apr': 3, 'april': 3,
          'mei': 4, 'may': 4,
          'jun': 5, 'juni': 5,
          'jul': 6, 'juli': 6,
          'agu': 7, 'agustus': 7, 'aug': 7, 'august': 7,
          'sep': 8, 'september': 8,
          'okt': 9, 'oktober': 9, 'oct': 9, 'october': 9,
          'nov': 10, 'november': 10,
          'des': 11, 'desember': 11, 'dec': 11, 'december': 11
        }
        
        const month = monthMap[monthStr]
        if (month !== undefined && day >= 1 && day <= 31) {
          const date = new Date(year, month, day)
          if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
            return date
          }
        }
      }
      
      // DO NOT use standard date parsing as it may interpret MM/DD/YYYY incorrectly
      return null
    } catch (e) {
      return null
    }
  }, [])

  // Filter data by period - NEW APPROACH: Don't modify data, just check during counting
  const getFilteredValue = useCallback((dateStr: string): boolean => {
    // Always check if value is valid first
    if (!dateStr || dateStr === 'N/A' || dateStr === '#REF!' || dateStr === '-' || dateStr === '') return false
    
    // If filter is 'all', accept any valid date string
    if (periodFilter === 'all') return true
    
    // If filter is 'custom', use date range
    if (periodFilter === 'custom') {
      if (!dateRange.startDate || !dateRange.endDate) return true // If no range set, show all
      
      // Parse the date string (supports dd-MMM-yyyy, DD/MM/YYYY, Excel serial, etc.)
      const dateValue = parseDate(dateStr)
      if (!dateValue) return false
      
      // Normalize dates to day precision (remove time component) for accurate comparison
      const rowDate = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate())
      
      const start = new Date(dateRange.startDate)
      const startNormalized = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      
      const end = new Date(dateRange.endDate)
      const endNormalized = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      
      return rowDate >= startNormalized && rowDate <= endNormalized
    }
    
    // Legacy period filters (kept for backward compatibility but not used in UI)
    const now = new Date()
    now.setHours(23, 59, 59, 999)
    let startDate = new Date()
    let endDate = new Date(now)
    switch (periodFilter) {
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'sixmonths':
        startDate = new Date(now)
        startDate.setMonth(now.getMonth() - 6)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'week':
        // Current calendar week (Monday - Sunday)
        const currentDay = now.getDay()
        const currentMonday = new Date(now)
        // Calculate days to subtract to get to Monday
        // If Sunday (0), go back 6 days; otherwise go back (day - 1) days
        const daysToMonday = currentDay === 0 ? 6 : currentDay - 1
        currentMonday.setDate(now.getDate() - daysToMonday)
        currentMonday.setHours(0, 0, 0, 0)
        
        startDate = currentMonday
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'lastweek':
        // Previous calendar week (Monday - Sunday)
        const day = now.getDay()
        const thisMonday = new Date(now)
        // Calculate days to subtract to get to this Monday
        const daysToThisMonday = day === 0 ? 6 : day - 1
        thisMonday.setDate(now.getDate() - daysToThisMonday)
        thisMonday.setHours(0, 0, 0, 0)

        // Last week Monday = this Monday - 7 days
        const lastWeekStart = new Date(thisMonday)
        lastWeekStart.setDate(thisMonday.getDate() - 7)
        lastWeekStart.setHours(0, 0, 0, 0)

        // Last week Sunday = this Monday - 1 day
        const lastWeekEnd = new Date(thisMonday)
        lastWeekEnd.setDate(thisMonday.getDate() - 1)
        lastWeekEnd.setHours(23, 59, 59, 999)

        startDate = lastWeekStart
        endDate = lastWeekEnd
        break
    }
      const rowDate = parseDate(dateStr)
    if (!rowDate) return false
      // Normalize row date to day precision
      const rowDateOnly = new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate())
      // Compare with start/end (inclusive)
      const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
      const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
      return rowDateOnly.getTime() >= startDateOnly.getTime() && rowDateOnly.getTime() <= endDateOnly.getTime()
  }, [periodFilter, dateRange, parseDate])

  // Helper function to normalize region to Proper Case
  const normalizeRegion = useCallback((region: string): string => {
    if (!region) return region
    return region
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }, [])

  // Apply filters to data
  const filteredData = useMemo(() => {
    let filtered = allData.map(row => ({
      ...row,
      Region: normalizeRegion(row['Region']) // Normalize region to Proper Case
    }))

    // Filter by regions (multi-select)
    if (selectedRegions.length > 0) {
      filtered = filtered.filter(row => selectedRegions.includes(row['Region']))
    }

    // Filter by projects (multi-select)
    if (selectedProjects.length > 0) {
      filtered = filtered.filter(row => selectedProjects.includes(row['_project']))
    }

    return filtered
  }, [allData, selectedRegions, selectedProjects, normalizeRegion])

  // Get unique regions and projects for filter options
  const regions = useMemo(() => {
    const uniqueRegions = Array.from(new Set(
      allData.map(row => normalizeRegion(row['Region'])).filter(Boolean)
    ))
    return uniqueRegions.sort()
  }, [allData, normalizeRegion])

  const projects = useMemo(() => {
    const uniqueProjects = Array.from(new Set(allData.map(row => row['_project']).filter(Boolean)))
    return uniqueProjects.sort()
  }, [allData])

  // Helper function to get PO remaining % for a site
  const getPORemaining = useCallback((duid: string, sowType: 'all' | 'survey' | 'dismantle' | 'atp' | 'pln' = 'all'): number | null => {
    if (!duid) return null
    
    let mapToUse: Record<string, number>
    switch (sowType) {
      case 'survey':
        mapToUse = poRemainingSurveyMap
        break
      case 'dismantle':
        mapToUse = poRemainingDismantleMap
        break
      case 'atp':
        mapToUse = poRemainingATPMap
        break
      case 'pln':
        mapToUse = poRemainingPLNMap
        break
      default:
        mapToUse = poRemainingMap
    }
    
    // Try multiple normalization strategies to find a match
    const normalizations = [
      duid.toString().toUpperCase().trim(),
      duid.toString().toLowerCase().trim(),
      duid.toString().toUpperCase().trim().replace(/\s+/g, ''),
      duid.toString().toLowerCase().trim().replace(/\s+/g, ''),
    ]
    
    for (const normalized of normalizations) {
      if (mapToUse[normalized] !== undefined) {
        return mapToUse[normalized]
      }
    }
    
    return null
  }, [poRemainingMap, poRemainingSurveyMap, poRemainingDismantleMap, poRemainingATPMap, poRemainingPLNMap])

  // Helper function to get Invoice Pending for a site
  const getInvoicePending = useCallback((siteId: string, category: 'all' | 'survey' | 'dismantle' | 'atp' | 'pln' = 'all'): number | null => {
    if (!siteId) return null
    
    // Select appropriate map based on category
    let mapToUse: Record<string, number>
    switch (category) {
      case 'survey':
        mapToUse = invoicePendingSurveyMap
        break
      case 'dismantle':
        mapToUse = invoicePendingDismantleMap
        break
      case 'atp':
        mapToUse = invoicePendingATPMap
        break
      case 'pln':
        mapToUse = invoicePendingPLNMap
        break
      default:
        mapToUse = invoicePendingMap
    }
    
    // Try all 4 variants
    const variants = [
      siteId.toUpperCase().replace(/\s+/g, ''),
      siteId.toUpperCase(),
      siteId.toLowerCase().replace(/\s+/g, ''),
      siteId.toLowerCase()
    ]
    
    for (const variant of variants) {
      if (variant in mapToUse) {
        return mapToUse[variant]
      }
    }
    
    return null
  }, [invoicePendingMap, invoicePendingSurveyMap, invoicePendingDismantleMap, invoicePendingATPMap, invoicePendingPLNMap])

  // Calculate metrics from data
  const metrics = useMemo(() => {
    if (filteredData.length === 0) return null

    // Total Sites will be counted only for rows with activity in date range
    let totalSites = 0
    
    // Site Status counts
    const siteStatusCounts: Record<string, number> = {}
    const regionCounts: Record<string, number> = {}
    
    // Survey Progress
    let surveyCompleted = 0
    let tssrClosed = 0
    
    // Rollout Progress (Regular Projects)
    let mosCompleted = 0
    let installCompleted = 0
    let integratedCompleted = 0
    let atpSubmit = 0
    let atpApproved = 0
    
    // Dismantle Progress (Regular Projects)
    let dismantle = 0
    let baDismantle = 0
    let inbound = 0
    
    // CME/PLN/BPUJL Progress (Special Projects)
    let cmeStart = 0
    let civilDone = 0
    let meDone = 0
    let plnMG = 0
    let plnConnected = 0
    let atpPLN = 0
    let bpujl = 0
    let atpCME = 0
    
    // Calculate unique teams from TL Name column (only from active rows)
    const uniqueTeams = new Set<string>()
    
    // Detect project type from allData (structure is same regardless of filters)
    const hasRegularColumns = allData.length > 0 && ('Survey' in allData[0] || 'MOS' in allData[0])
    const hasCMEColumns = allData.length > 0 && ('CME Start' in allData[0] || 'ATP CME' in allData[0])
    
    filteredData.forEach(row => {
      // Only count rows that have at least one valid date field in filter range
      const hasValidDateInRange = 
        // Regular project columns
        getFilteredValue(row['Survey']) ||
        getFilteredValue(row['TSSR Closed']) ||
        getFilteredValue(row['TSSRClosed']) ||
        getFilteredValue(row['MOS']) ||
        getFilteredValue(row['Install Done']) ||
        getFilteredValue(row['InstallDone']) ||
        getFilteredValue(row['Integrated']) ||
        getFilteredValue(row['ATP Submit']) ||
        getFilteredValue(row['ATPSubmit']) ||
        getFilteredValue(row['ATP Approved']) ||
        getFilteredValue(row['ATPApproved']) ||
        getFilteredValue(row['Dismantle']) ||
        getFilteredValue(row['BA Dismantle']) ||
        getFilteredValue(row['BADismantle']) ||
        getFilteredValue(row['Inbound']) ||
        // CME/PLN/BPUJL columns
        getFilteredValue(row['CME Start']) ||
        getFilteredValue(row['Civil Done']) ||
        getFilteredValue(row['ME Done']) ||
        getFilteredValue(row['PLN MG']) ||
        getFilteredValue(row['PLN Connected']) ||
        getFilteredValue(row['ATP PLN']) ||
        getFilteredValue(row['BPUJL']) ||
        getFilteredValue(row['ATP CME'])
      
      // Site Status - only count if row has activity in filter range
      if (hasValidDateInRange || periodFilter === 'all') {
        // Increment total sites counter
        totalSites++
        
        const status = row['Site Status'] || row['SiteStatus'] || 'Unknown'
        siteStatusCounts[status] = (siteStatusCounts[status] || 0) + 1
        
        // Region
        const region = row['Region'] || 'Unknown'
        regionCounts[region] = (regionCounts[region] || 0) + 1
        
        // Count unique TL Names only from active rows
        const tlName = row['TL Name'] || row['TLName'] || row['Team Name'] || row['TeamName']
        if (tlName && tlName.trim() !== '') {
          uniqueTeams.add(tlName.trim())
        }
      }
      
      // Survey Progress - check if date is in filter range
      const survey = row['Survey']
      if (getFilteredValue(survey)) surveyCompleted++
      
      const tssrClosedValue = row['TSSR Closed'] || row['TSSRClosed']
      if (getFilteredValue(tssrClosedValue)) tssrClosed++
      
      // Rollout Progress - only count if value exists and is not null
      const mos = row['MOS']
      if (getFilteredValue(mos)) {
        mosCompleted++

      }
      
      const installDone = row['Install Done'] || row['InstallDone']
      if (getFilteredValue(installDone)) installCompleted++
      
      const integrated = row['Integrated']
      if (getFilteredValue(integrated)) integratedCompleted++
      
      const atpSubmitValue = row['ATP Submit'] || row['ATPSubmit']
      if (getFilteredValue(atpSubmitValue)) atpSubmit++
      
      const atpApprovedValue = row['ATP Approved'] || row['ATPApproved']
      if (getFilteredValue(atpApprovedValue)) atpApproved++
      
      // Dismantle Progress - only count if value exists and is not null
      const dismantleValue = row['Dismantle']
      if (getFilteredValue(dismantleValue)) dismantle++
      
      const baDismantleValue = row['BA Dismantle'] || row['BADismantle']
      if (getFilteredValue(baDismantleValue)) baDismantle++
      
      const inboundValue = row['Inbound']
      if (getFilteredValue(inboundValue)) inbound++
      
      // CME/PLN/BPUJL Progress - for special projects
      if (getFilteredValue(row['CME Start'])) cmeStart++
      if (getFilteredValue(row['Civil Done'])) civilDone++
      if (getFilteredValue(row['ME Done'])) meDone++
      if (getFilteredValue(row['PLN MG'])) plnMG++
      if (getFilteredValue(row['PLN Connected'])) plnConnected++
      if (getFilteredValue(row['ATP PLN'])) atpPLN++
      if (getFilteredValue(row['BPUJL'])) bpujl++
      if (getFilteredValue(row['ATP CME'])) atpCME++
    })

    // Calculate average PO remaining % for ATP Approved sites
    const atpApprovedSites = filteredData.filter(row => 
      getFilteredValue(row['ATP Approved'] || row['ATPApproved'])
    )
    
    let totalPoRemaining = 0
    let sitesWithPOData = 0
    const unmatchedSites: string[] = []
    const matchedSamples: Array<{ duid: string; remaining: number }> = []
    
    atpApprovedSites.forEach(row => {
      // ITC Huawei uses DUID column, which maps to Site ID in PO data
      const duid = row['DUID']
      
      if (!duid) {
        return
      }
      
      const poRemaining = getPORemaining(duid, 'atp') // ATP = not survey, not dismantle
      
      if (poRemaining !== null && poRemaining !== undefined) {
        totalPoRemaining += poRemaining
        sitesWithPOData++
        
        // Collect samples for debugging
        if (matchedSamples.length < 5) {
          matchedSamples.push({ duid, remaining: poRemaining })
        }
      } else {
        unmatchedSites.push(duid)
      }
    })
    
    const avgPoRemainingPercent = sitesWithPOData > 0 
      ? (totalPoRemaining / sitesWithPOData).toFixed(1)
      : null

    // Calculate average PO remaining % for TSSR Closed sites (Survey SOW only)
    const tssrClosedSites = filteredData.filter(row => 
      getFilteredValue(row['TSSR Closed'] || row['TSSRClosed'])
    )
    
    let totalPoRemainingSurvey = 0
    let sitesWithPODataSurvey = 0
    
    tssrClosedSites.forEach(row => {
      const duid = row['DUID']
      
      if (!duid) return
      
      const poRemaining = getPORemaining(duid, 'survey')
      
      if (poRemaining !== null && poRemaining !== undefined) {
        totalPoRemainingSurvey += poRemaining
        sitesWithPODataSurvey++
      }
    })
    
    const avgPoRemainingSurveyPercent = sitesWithPODataSurvey > 0 
      ? (totalPoRemainingSurvey / sitesWithPODataSurvey).toFixed(1)
      : null

    // Calculate average PO remaining % for Inbound sites (Dismantle SOW only)
    const inboundSites = filteredData.filter(row => 
      getFilteredValue(row['Inbound'])
    )
    
    let totalPoRemainingDismantle = 0
    let sitesWithPODataDismantle = 0
    
    inboundSites.forEach(row => {
      const duid = row['DUID']
      
      if (!duid) return
      
      const poRemaining = getPORemaining(duid, 'dismantle')
      
      if (poRemaining !== null && poRemaining !== undefined) {
        totalPoRemainingDismantle += poRemaining
        sitesWithPODataDismantle++
      }
    })
    
    const avgPoRemainingDismantlePercent = sitesWithPODataDismantle > 0 
      ? (totalPoRemainingDismantle / sitesWithPODataDismantle).toFixed(1)
      : null

    // Calculate average PO remaining % for ATP PLN sites (PLN SOW only)
    const atpPLNSites = filteredData.filter(row => 
      getFilteredValue(row['ATP PLN'])
    )
    
    let totalPoRemainingPLN = 0
    let sitesWithPODataPLN = 0
    
    atpPLNSites.forEach(row => {
      const duid = row['DUID']
      
      if (!duid) return
      
      const poRemaining = getPORemaining(duid, 'pln')
      
      if (poRemaining !== null && poRemaining !== undefined) {
        totalPoRemainingPLN += poRemaining
        sitesWithPODataPLN++
      }
    })
    
    const avgPoRemainingPlnPercent = sitesWithPODataPLN > 0 
      ? (totalPoRemainingPLN / sitesWithPODataPLN).toFixed(1)
      : null

    // Calculate total Invoice Pending for ATP Approved sites
    let totalInvoicePendingATP = 0
    let sitesWithInvoicePendingATP = 0
    
    atpApprovedSites.forEach(row => {
      const duid = row['DUID']
      if (!duid) return
      
      const invoicePending = getInvoicePending(duid, 'atp')
      if (invoicePending !== null && invoicePending !== undefined && invoicePending > 0) {
        totalInvoicePendingATP += invoicePending
        sitesWithInvoicePendingATP++
      }
    })

    // Calculate total Invoice Pending for TSSR Closed sites (Survey)
    let totalInvoicePendingSurvey = 0
    let sitesWithInvoicePendingSurvey = 0
    
    tssrClosedSites.forEach(row => {
      const duid = row['DUID']
      if (!duid) return
      
      const invoicePending = getInvoicePending(duid, 'survey')
      if (invoicePending !== null && invoicePending !== undefined && invoicePending > 0) {
        totalInvoicePendingSurvey += invoicePending
        sitesWithInvoicePendingSurvey++
      }
    })

    // Calculate total Invoice Pending for Inbound sites (Dismantle)
    let totalInvoicePendingDismantle = 0
    let sitesWithInvoicePendingDismantle = 0
    
    inboundSites.forEach(row => {
      const duid = row['DUID']
      if (!duid) return
      
      const invoicePending = getInvoicePending(duid, 'dismantle')
      if (invoicePending !== null && invoicePending !== undefined && invoicePending > 0) {
        totalInvoicePendingDismantle += invoicePending
        sitesWithInvoicePendingDismantle++
      }
    })

    // Calculate metrics per region for comparison chart
    const regionMetrics: Record<string, {
      survey: number
      tssrClosed: number
      mos: number
      install: number
      integrated: number
      atpSubmit: number
      atp: number
      dismantle: number
      total: number
      teamQty: Set<string>
    }> = {}

    filteredData.forEach(row => {
      const region = row['Region'] || 'Unknown'
      
      if (!regionMetrics[region]) {
        regionMetrics[region] = {
          survey: 0,
          tssrClosed: 0,
          mos: 0,
          install: 0,
          integrated: 0,
          atpSubmit: 0,
          atp: 0,
          dismantle: 0,
          total: 0,
          teamQty: new Set<string>()
        }
      }

      const hasValidDateInRange = 
        getFilteredValue(row['Survey']) ||
        getFilteredValue(row['TSSR Closed'] || row['TSSRClosed']) ||
        getFilteredValue(row['MOS']) ||
        getFilteredValue(row['Install Done'] || row['InstallDone']) ||
        getFilteredValue(row['Integrated']) ||
        getFilteredValue(row['ATP Submit'] || row['ATPSubmit']) ||
        getFilteredValue(row['ATP Approved'] || row['ATPApproved']) ||
        getFilteredValue(row['Dismantle']) ||
        getFilteredValue(row['BA Dismantle'] || row['BADismantle']) ||
        getFilteredValue(row['Inbound']) ||
        getFilteredValue(row['CME Start']) ||
        getFilteredValue(row['Civil Done']) ||
        getFilteredValue(row['ME Done']) ||
        getFilteredValue(row['PLN MG']) ||
        getFilteredValue(row['PLN Connected']) ||
        getFilteredValue(row['ATP PLN']) ||
        getFilteredValue(row['BPUJL']) ||
        getFilteredValue(row['ATP CME'])
      
      // Only count in total if row has activity in date range
      if (hasValidDateInRange || periodFilter === 'all') {
        regionMetrics[region].total++
        
        const tlName = row['TL Name'] || row['TLName'] || row['Team Name'] || row['TeamName']
        if (tlName && tlName.trim() !== '') {
          regionMetrics[region].teamQty.add(tlName.trim())
        }
      }
      
      if (getFilteredValue(row['Survey'])) regionMetrics[region].survey++
      if (getFilteredValue(row['TSSR Closed'] || row['TSSRClosed'])) regionMetrics[region].tssrClosed++
      if (getFilteredValue(row['MOS'])) regionMetrics[region].mos++
      if (getFilteredValue(row['Install Done'] || row['InstallDone'])) regionMetrics[region].install++
      if (getFilteredValue(row['Integrated'])) regionMetrics[region].integrated++
      if (getFilteredValue(row['ATP Submit'] || row['ATPSubmit'])) regionMetrics[region].atpSubmit++
      if (getFilteredValue(row['ATP Approved'] || row['ATPApproved'])) regionMetrics[region].atp++
      if (getFilteredValue(row['Dismantle'])) regionMetrics[region].dismantle++
    })

    // Calculate team qty from unique teams set
    const teamQty = uniqueTeams.size

    return {
      totalSites,
      teamQty,
      siteStatusCounts,
      regionCounts,
      regionMetrics,
      
      // Project type detection
      hasRegularColumns,
      hasCMEColumns,
      
      // Survey Progress (compare within group) - Regular Projects
      surveyCompleted,
      tssrClosed,
      surveyProgress: ((surveyCompleted / totalSites) * 100).toFixed(1),
      tssrClosedProgress: surveyCompleted > 0 ? ((tssrClosed / surveyCompleted) * 100).toFixed(1) : '0',
      
      // Rollout Progress (compare within group) - Regular Projects
      mosCompleted,
      installCompleted,
      integratedCompleted,
      atpSubmit,
      atpApproved,
      mosProgress: ((mosCompleted / totalSites) * 100).toFixed(1),
      installProgress: mosCompleted > 0 ? ((installCompleted / mosCompleted) * 100).toFixed(1) : '0',
      integratedProgress: installCompleted > 0 ? ((integratedCompleted / installCompleted) * 100).toFixed(1) : '0',
      atpSubmitProgress: integratedCompleted > 0 ? ((atpSubmit / integratedCompleted) * 100).toFixed(1) : '0',
      atpApprovedProgress: atpSubmit > 0 ? ((atpApproved / atpSubmit) * 100).toFixed(1) : '0',
      
      // Dismantle Progress (compare within group) - Regular Projects
      dismantle,
      baDismantle,
      inbound,
      dismantleProgress: ((dismantle / totalSites) * 100).toFixed(1),
      baDismantleProgress: dismantle > 0 ? ((baDismantle / dismantle) * 100).toFixed(1) : '0',
      inboundProgress: baDismantle > 0 ? ((inbound / baDismantle) * 100).toFixed(1) : '0',
      
      // CME/PLN/BPUJL Progress (Special Projects)
      cmeStart,
      civilDone,
      meDone,
      plnMG,
      plnConnected,
      atpPLN,
      bpujl,
      atpCME,
      cmeStartProgress: ((cmeStart / totalSites) * 100).toFixed(1),
      civilDoneProgress: cmeStart > 0 ? ((civilDone / cmeStart) * 100).toFixed(1) : '0',
      meDoneProgress: civilDone > 0 ? ((meDone / civilDone) * 100).toFixed(1) : '0',
      plnMGProgress: meDone > 0 ? ((plnMG / meDone) * 100).toFixed(1) : '0',
      plnConnectedProgress: totalSites > 0 ? ((plnConnected / totalSites) * 100).toFixed(1) : '0',
      atpPLNProgress: plnConnected > 0 ? ((atpPLN / plnConnected) * 100).toFixed(1) : '0',
      bpujlProgress: totalSites > 0 ? ((bpujl / totalSites) * 100).toFixed(1) : '0',
      atpCMEProgress: cmeStart > 0 ? ((atpCME / cmeStart) * 100).toFixed(1) : '0',
      
      // PO Remaining data
      avgPoRemainingPercent,
      sitesWithPOData,
      avgPoRemainingSurveyPercent,
      sitesWithPODataSurvey,
      avgPoRemainingDismantlePercent,
      sitesWithPODataDismantle,
      avgPoRemainingPlnPercent,
      sitesWithPODataPLN,
      
      // Invoice Pending data
      totalInvoicePendingATP,
      sitesWithInvoicePendingATP,
      totalInvoicePendingSurvey,
      sitesWithInvoicePendingSurvey,
      totalInvoicePendingDismantle,
      sitesWithInvoicePendingDismantle,
    }
  }, [allData, filteredData, periodFilter, getFilteredValue, getPORemaining, getInvoicePending])

  // Smart Analytics - Bottleneck Detection & Performance Analysis
  const analytics = useMemo(() => {
    if (!metrics) return null

    // 1. Bottleneck Detection - Find slowest phase
    const phases = [
      { name: 'Survey', progress: parseFloat(metrics.surveyProgress), count: metrics.surveyCompleted, total: metrics.totalSites },
      { name: 'TSSR Closed', progress: parseFloat(metrics.tssrClosedProgress), count: metrics.tssrClosed, total: metrics.surveyCompleted },
      { name: 'MOS', progress: parseFloat(metrics.mosProgress), count: metrics.mosCompleted, total: metrics.totalSites },
      { name: 'Install Done', progress: parseFloat(metrics.installProgress), count: metrics.installCompleted, total: metrics.mosCompleted },
      { name: 'Integrated', progress: parseFloat(metrics.integratedProgress), count: metrics.integratedCompleted, total: metrics.installCompleted },
      { name: 'ATP Submit', progress: parseFloat(metrics.atpSubmitProgress), count: metrics.atpSubmit, total: metrics.integratedCompleted },
      { name: 'ATP Approved', progress: parseFloat(metrics.atpApprovedProgress), count: metrics.atpApproved, total: metrics.atpSubmit },
      { name: 'Dismantle', progress: parseFloat(metrics.dismantleProgress), count: metrics.dismantle, total: metrics.totalSites },
      { name: 'BA Dismantle', progress: parseFloat(metrics.baDismantleProgress), count: metrics.baDismantle, total: metrics.dismantle },
      { name: 'Inbound', progress: parseFloat(metrics.inboundProgress), count: metrics.inbound, total: metrics.baDismantle }
    ].filter(p => p.total > 0) // Only phases with activity

    const bottleneck = phases.reduce((min, p) => p.progress < min.progress ? p : min, phases[0])

    // 2. Region Performance Analysis - Weighted Score
    const regionPerformance = Object.entries(metrics.regionCounts).map(([region, count]) => {
      // Calculate completion rate for this region
      const regionData = filteredData.filter(row => row['Region'] === region)
      const completed = regionData.filter(row => 
        getFilteredValue(row['ATP Approved'] || row['ATPApproved'])
      ).length
      const completionRate = count > 0 ? (completed / count) * 100 : 0

      // Weighted Performance Score
      // Formula: (Completion Rate * 0.7) + (Site Count / Max Site Count * 100 * 0.3)
      // This gives 70% weight to completion rate and 30% weight to site volume
      const maxSiteCount = Math.max(...Object.values(metrics.regionCounts))
      const volumeScore = (count / maxSiteCount) * 100
      const performanceScore = (completionRate * 0.7) + (volumeScore * 0.3)

      return { 
        region, 
        count, 
        completed, 
        completionRate,
        volumeScore,
        performanceScore 
      }
    }).sort((a, b) => b.performanceScore - a.performanceScore)

    const topRegions = regionPerformance.slice(0, 3)
    const bottomRegions = regionPerformance.slice(-3).reverse()

    // 3. Stuck Sites Detection (sites without progress >30 days)
    const stuckSites = filteredData.filter(row => {
      const lastActivity = [
        row['Survey'], row['TSSR Closed'], row['TSSRClosed'],
        row['MOS'], row['Install Done'], row['InstallDone'],
        row['Integrated'], row['ATP Submit'], row['ATPSubmit'],
        row['ATP Approved'], row['ATPApproved']
      ]
        .map(d => parseDate(d))
        .filter(d => d !== null)
        .sort((a, b) => b!.getTime() - a!.getTime())[0]

      if (!lastActivity) return false

      const daysSinceActivity = Math.floor((new Date().getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceActivity > 30
    })

    // 4. Predictive Completion (based on current velocity)
    const calculateVelocity = (completed: number, days: number) => {
      return days > 0 ? completed / days : 0
    }

    let daysInPeriod = 365 // default for 'all'
    if (periodFilter === 'year') daysInPeriod = 365
    else if (periodFilter === 'sixmonths') daysInPeriod = 180
    else if (periodFilter === 'month') daysInPeriod = 30
    else if (periodFilter === 'week') daysInPeriod = 7

    const velocity = calculateVelocity(metrics.atpApproved, daysInPeriod)
    const remaining = metrics.totalSites - metrics.atpApproved
    const daysToComplete = velocity > 0 ? Math.ceil(remaining / velocity) : 999
    const estimatedCompletion = new Date()
    estimatedCompletion.setDate(estimatedCompletion.getDate() + daysToComplete)

    return {
      bottleneck,
      topRegions,
      bottomRegions,
      stuckSites: stuckSites.length,
      velocity: velocity.toFixed(2),
      daysToComplete,
      estimatedCompletion: daysToComplete < 999 ? estimatedCompletion.toLocaleDateString('id-ID', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      }) : 'N/A'
    }
  }, [metrics, filteredData, periodFilter, getFilteredValue, parseDate])

  // Helper function to get status color based on progress
  const getStatusColor = (progress: number): { bg: string; text: string; border: string } => {
    if (progress >= 70) return { 
      bg: 'bg-green-50', 
      text: 'text-green-700', 
      border: 'border-green-200' 
    }
    if (progress >= 40) return { 
      bg: 'bg-yellow-50', 
      text: 'text-yellow-700', 
      border: 'border-yellow-200' 
    }
    return { 
      bg: 'bg-red-50', 
      text: 'text-red-700', 
      border: 'border-red-200' 
    }
  }

  // Helper function to get progress bar color
  const getProgressBarColor = (progress: number): string => {
    if (progress >= 70) return 'bg-green-500'
    if (progress >= 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const periodOptions = [
    { value: 'all' as PeriodFilter, label: 'All Time' },
    { value: 'custom' as PeriodFilter, label: 'Custom Range' },
  ]

  // Function to open site list modal
  const openSiteListModal = (fieldName: string, label: string) => {
    const filteredRows = filteredData.filter(row => {
      const value = row[fieldName]
      return getFilteredValue(value)
    })

    // Helper function to format date for display
    const formatDateForDisplay = (dateValue: any): string => {
      if (!dateValue) return '-'
      
      const dateObj = parseDate(dateValue.toString())
      if (!dateObj) return dateValue.toString()
      
      // Format as dd-MMM-yyyy using UTC to avoid timezone offset
      const day = dateObj.getUTCDate().toString().padStart(2, '0')
      const month = dateObj.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
      const year = dateObj.getUTCFullYear()
      return `${day}-${month}-${year}`
    }

    // Map all sites with correct column names (DUID, DU Name, Project, TL Name)
    const allSites = filteredRows.map(row => ({
      duid: row['DUID'] || row['DU ID'] || '-',
      duName: row['DU Name'] || row['DUName'] || '-',
      project: row['_project'] || '-',
      tlName: row['TL Name'] || row['TLName'] || row['Team Name'] || row['TeamName'] || '-',
      date: formatDateForDisplay(row[fieldName]),
      dateObj: parseDate(row[fieldName]?.toString())
    }))

    // Sort by date (newest first) and take only 15 most recent for display
    const sortedSites = [...allSites]
      .sort((a, b) => {
        // Sort by date descending (newest first)
        if (!a.dateObj) return 1
        if (!b.dateObj) return -1
        return b.dateObj.getTime() - a.dateObj.getTime()
      })

    const displaySites = sortedSites.slice(0, 15).map(({ dateObj, ...site }) => site)
    const allSitesForDownload = sortedSites.map(({ dateObj, ...site }) => site)

    setModalData({ title: label, sites: displaySites, allSites: allSitesForDownload })
    setModalType('site')
    setModalOpen(true)
  }

  // Function to open total sites modal
  const openTotalSitesModal = () => {
    const sitesData: any[] = []
    
    filteredData.forEach(row => {
      // Check which activities exist for this site
      const activities: string[] = []
      
      // Regular project columns
      if (getFilteredValue(row['Survey'])) activities.push('Survey')
      if (getFilteredValue(row['TSSR Closed']) || getFilteredValue(row['TSSRClosed'])) activities.push('TSSR Closed')
      if (getFilteredValue(row['MOS'])) activities.push('MOS')
      if (getFilteredValue(row['Install Done']) || getFilteredValue(row['InstallDone'])) activities.push('Install Done')
      if (getFilteredValue(row['Integrated'])) activities.push('Integrated')
      if (getFilteredValue(row['ATP Submit']) || getFilteredValue(row['ATPSubmit'])) activities.push('ATP Submit')
      if (getFilteredValue(row['ATP Approved']) || getFilteredValue(row['ATPApproved'])) activities.push('ATP Approved')
      if (getFilteredValue(row['Dismantle'])) activities.push('Dismantle')
      if (getFilteredValue(row['BA Dismantle']) || getFilteredValue(row['BADismantle'])) activities.push('BA Dismantle')
      if (getFilteredValue(row['Inbound'])) activities.push('Inbound')
      
      // CME/PLN/BPUJL columns
      if (getFilteredValue(row['CME Start'])) activities.push('CME Start')
      if (getFilteredValue(row['Civil Done'])) activities.push('Civil Done')
      if (getFilteredValue(row['ME Done'])) activities.push('ME Done')
      if (getFilteredValue(row['PLN MG'])) activities.push('PLN MG')
      if (getFilteredValue(row['PLN Connected'])) activities.push('PLN Connected')
      if (getFilteredValue(row['ATP PLN'])) activities.push('ATP PLN')
      if (getFilteredValue(row['BPUJL'])) activities.push('BPUJL')
      if (getFilteredValue(row['ATP CME'])) activities.push('ATP CME')
      
      // Only include rows with activity or if filter is 'all'
      const hasValidDateInRange = activities.length > 0
      
      if (hasValidDateInRange || periodFilter === 'all') {
        sitesData.push({
          duid: row['DUID'] || row['DU ID'] || '-',
          duName: row['DU Name'] || row['DUName'] || '-',
          project: row['_project'] || '-',
          tlName: row['TL Name'] || row['TLName'] || row['Team Name'] || row['TeamName'] || '-',
          activity: activities.length > 0 ? activities.join(', ') : 'No Activity'
        })
      }
    })

    // Sort by DUID
    const sortedSites = sitesData.sort((a, b) => {
      return a.duid.localeCompare(b.duid)
    })

    const displaySites = sortedSites.slice(0, 15)
    const allSitesForDownload = sortedSites

    setModalData({ title: 'Total Sites', sites: displaySites, allSites: allSitesForDownload })
    setModalType('totalSites')
    setModalOpen(true)
  }

  // Function to open team list modal
  const openTeamListModal = () => {
    // Get unique TL Names from filtered data (only from rows with activity in date range)
    const teamMap = new Map<string, { sites: any[], activities: Set<string> }>()
    
    filteredData.forEach(row => {
      // Check which activities exist for this site
      const activities: string[] = []
      
      // Regular project columns
      if (getFilteredValue(row['Survey'])) activities.push('Survey')
      if (getFilteredValue(row['TSSR Closed']) || getFilteredValue(row['TSSRClosed'])) activities.push('TSSR Closed')
      if (getFilteredValue(row['MOS'])) activities.push('MOS')
      if (getFilteredValue(row['Install Done']) || getFilteredValue(row['InstallDone'])) activities.push('Install Done')
      if (getFilteredValue(row['Integrated'])) activities.push('Integrated')
      if (getFilteredValue(row['ATP Submit']) || getFilteredValue(row['ATPSubmit'])) activities.push('ATP Submit')
      if (getFilteredValue(row['ATP Approved']) || getFilteredValue(row['ATPApproved'])) activities.push('ATP Approved')
      if (getFilteredValue(row['Dismantle'])) activities.push('Dismantle')
      if (getFilteredValue(row['BA Dismantle']) || getFilteredValue(row['BADismantle'])) activities.push('BA Dismantle')
      if (getFilteredValue(row['Inbound'])) activities.push('Inbound')
      
      // CME/PLN/BPUJL columns
      if (getFilteredValue(row['CME Start'])) activities.push('CME Start')
      if (getFilteredValue(row['Civil Done'])) activities.push('Civil Done')
      if (getFilteredValue(row['ME Done'])) activities.push('ME Done')
      if (getFilteredValue(row['PLN MG'])) activities.push('PLN MG')
      if (getFilteredValue(row['PLN Connected'])) activities.push('PLN Connected')
      if (getFilteredValue(row['ATP PLN'])) activities.push('ATP PLN')
      if (getFilteredValue(row['BPUJL'])) activities.push('BPUJL')
      if (getFilteredValue(row['ATP CME'])) activities.push('ATP CME')
      
      const hasValidDateInRange = activities.length > 0
      
      // Only include rows with activity in date range or if filter is 'all'
      if (hasValidDateInRange || periodFilter === 'all') {
        const tlName = row['TL Name'] || row['TLName'] || row['Team Name'] || row['TeamName']
        if (tlName && tlName.trim() !== '') {
          const teamKey = tlName.trim()
          if (!teamMap.has(teamKey)) {
            teamMap.set(teamKey, { sites: [], activities: new Set<string>() })
          }
          const teamData = teamMap.get(teamKey)!
          teamData.sites.push({
            duid: row['DUID'] || row['DU ID'] || '-',
            duName: row['DU Name'] || row['DUName'] || '-',
            project: row['_project'] || '-',
            region: row['Region'] || '-'
          })
          // Add all activities to the team's activity set
          activities.forEach(activity => teamData.activities.add(activity))
        }
      }
    })

    // Convert to array and create display data
    const teamList = Array.from(teamMap.entries()).map(([teamName, teamData]) => ({
      tlName: teamName,
      totalSites: teamData.sites.length,
      projects: teamData.sites.map(s => s.project).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      regions: teamData.sites.map(s => s.region).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      activity: Array.from(teamData.activities).sort().join(', ') || 'No Activity',
      siteDetails: teamData.sites, // Include full site details for tooltip
      // Keep old format for backward compatibility
      duid: teamName,
      duName: `${teamData.sites.length} sites`,
      project: teamData.sites.map(s => s.project).filter((v, i, a) => a.indexOf(v) === i).join(', '),
      date: '-'
    }))

    // Sort by number of sites (descending)
    const sortedTeams = teamList.sort((a, b) => {
      return b.totalSites - a.totalSites
    })

    const displayTeams = sortedTeams.slice(0, 15)
    const allTeamsForDownload = sortedTeams

    setModalData({ title: 'Team Leaders', sites: displayTeams, allSites: allTeamsForDownload })
    setModalType('team')
    setModalOpen(true)
  }

  // Function to download from modal
  const downloadFromModal = () => {
    if (modalData.allSites.length === 0) return

    let excelData
    let sheetName
    let colWidths
    
    if (modalType === 'team') {
      // Team list format
      excelData = modalData.allSites.map(team => ({
        'TL Name': team.tlName,
        'Total Sites': team.totalSites,
        'Regions': team.regions,
        'Projects': team.projects,
        'Activity': team.activity
      }))
      sheetName = 'Team List'
      colWidths = [
        { wch: 30 },
        { wch: 15 },
        { wch: 40 },
        { wch: 50 },
        { wch: 60 }
      ]
    } else if (modalType === 'totalSites') {
      // Total sites format with activity
      excelData = modalData.allSites.map((site, index) => ({
        'No': index + 1,
        'DUID': site.duid,
        'DU Name': site.duName,
        'Project': site.project,
        'TL Name': site.tlName,
        'Activity': site.activity
      }))
      sheetName = 'Total Sites'
      colWidths = [
        { wch: 8 },
        { wch: 20 },
        { wch: 40 },
        { wch: 30 },
        { wch: 30 },
        { wch: 60 }
      ]
    } else {
      // Site list format
      excelData = modalData.allSites.map(site => ({
        'DUID': site.duid,
        'DU Name': site.duName,
        'Project': site.project,
        'TL Name': site.tlName,
        'Date': site.date
      }))
      sheetName = 'Site List'
      colWidths = [
        { wch: 20 },
        { wch: 40 },
        { wch: 30 },
        { wch: 30 },
        { wch: 15 }
      ]
    }

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    ws['!cols'] = colWidths

    const projectName = selectedProjects.length > 0 ? selectedProjects.join('_').replace(/\s+/g, '_') : 'AllProjects'
    const regionName = selectedRegions.length > 0 ? selectedRegions.join('_').replace(/\s+/g, '_') : 'AllRegions'
    const fileName = modalType === 'team' 
      ? `${modalData.title}_TeamList_${projectName}_${regionName}_${periodFilter}.xlsx`
      : `${modalData.title}_SiteList_${projectName}_${regionName}_${periodFilter}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 pb-2 px-4 pt-4">
      <div className="w-full flex-1 flex flex-col overflow-hidden">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 flex flex-col h-full overflow-hidden">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white rounded-t-xl border-b border-slate-200/60 p-4 md:p-5">
            {/* Header Title */}
            <div>
              <h1 className="text-lg md:text-xl font-semibold text-slate-900 flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <span className="hidden sm:inline">ITC HUAWEI Dashboard</span>
                <span className="sm:hidden">ITC HUAWEI</span>
              </h1>
              <p className="mt-1 text-xs md:text-sm text-slate-600">
                Project rollout overview and analytics
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
              {/* Period Filter Buttons */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full sm:w-auto">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPeriodFilter(option.value)}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                      ${periodFilter === option.value
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }
                    `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Range */}
              {periodFilter === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                  <span className="text-xs text-slate-500 font-medium">to</span>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                </div>
              )}

              {/* Divider */}
              <div className="h-8 w-px bg-slate-300"></div>

              {/* Region Filter - Multi-select */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs font-medium text-slate-700 whitespace-nowrap">Region:</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowRegionDropdown(!showRegionDropdown)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px] text-left flex items-center justify-between"
                  >
                    <span className="truncate">
                      {selectedRegions.length === 0 ? 'All Regions' : `${selectedRegions.length} selected`}
                    </span>
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showRegionDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowRegionDropdown(false)}></div>
                      <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
                        <div className="p-2">
                          <label className="flex items-center px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedRegions.length === 0}
                              onChange={() => setSelectedRegions([])}
                              className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-slate-700">All Regions</span>
                          </label>
                          {regions.map((region) => (
                            <label key={region} className="flex items-center px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedRegions.includes(region)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRegions(prev => [...prev, region])
                                  } else {
                                    setSelectedRegions(prev => prev.filter(r => r !== region))
                                  }
                                }}
                                className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs text-slate-700">{region}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Project Filter - Multi-select */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs font-medium text-slate-700 whitespace-nowrap">Project:</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px] text-left flex items-center justify-between"
                  >
                    <span className="truncate">
                      {selectedProjects.length === 0 ? 'All Projects' : `${selectedProjects.length} selected`}
                    </span>
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showProjectDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowProjectDropdown(false)}></div>
                      <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
                        <div className="p-2">
                          <label className="flex items-center px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedProjects.length === 0}
                              onChange={() => setSelectedProjects([])}
                              className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-slate-700">All Projects</span>
                          </label>
                          {projects.map((project) => (
                            <label key={project} className="flex items-center px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedProjects.includes(project)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProjects(prev => [...prev, project])
                                  } else {
                                    setSelectedProjects(prev => prev.filter(p => p !== project))
                                  }
                                }}
                                className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs text-slate-700">{project}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto rounded-b-xl p-3 md:p-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 hover:scrollbar-thumb-slate-400">
            {/* Professional Revenue & Performance Analytics */}
            {analytics && metrics && (
              <div className="space-y-3">
              {/* Revenue Milestone Cards - Compact & Modern */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* ATP Approved / ATP CME - Implementation Revenue */}
                <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50/30 rounded-xl border-2 border-blue-200 p-3 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all duration-300">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-blue-700">
                          {metrics.hasCMEColumns ? 'ATP CME' : 'ATP Approved'}
                        </h3>
                        <p className="text-[9px] text-blue-600 font-semibold tracking-wide uppercase opacity-75">Implementation Invoice</p>
                      </div>
                    </div>
                    {!metrics.hasCMEColumns && (
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        loading || (!metrics.totalInvoicePendingATP && Object.keys(invoicePendingMap).length === 0)
                          ? 'bg-amber-100 text-amber-400 animate-pulse'
                          : metrics.totalInvoicePendingATP && metrics.totalInvoicePendingATP > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {loading || (!metrics.totalInvoicePendingATP && Object.keys(invoicePendingMap).length === 0)
                          ? '...'
                          : metrics.totalInvoicePendingATP && metrics.totalInvoicePendingATP > 0
                          ? `Inv Remaining: ${metrics.totalInvoicePendingATP >= 1000000000 
                              ? (metrics.totalInvoicePendingATP / 1000000000).toFixed(1) + 'M'
                              : (metrics.totalInvoicePendingATP / 1000000).toFixed(0) + 'Jt'}`
                          : 'N/A'}
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-2.5">
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-3xl font-black text-blue-700">
                        {metrics.hasCMEColumns ? metrics.atpCME : metrics.atpApproved}
                      </span>
                      <span className="text-lg font-bold text-slate-400">
                        / {metrics.hasCMEColumns ? metrics.cmeStart : metrics.mosCompleted}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 bg-blue-100 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 rounded-full transition-all duration-700 shadow-sm"
                          style={{ width: `${metrics.hasCMEColumns 
                            ? (metrics.cmeStart > 0 ? (metrics.atpCME / metrics.cmeStart) * 100 : 0)
                            : (metrics.mosCompleted > 0 ? (metrics.atpApproved / metrics.mosCompleted) * 100 : 0)}%` }}
                        />
                      </div>
                      <span className="text-sm font-black text-blue-700 min-w-[3rem] text-right">
                        {metrics.hasCMEColumns
                          ? (metrics.cmeStart > 0 ? ((metrics.atpCME / metrics.cmeStart) * 100).toFixed(1) : '0')
                          : (metrics.mosCompleted > 0 ? ((metrics.atpApproved / metrics.mosCompleted) * 100).toFixed(1) : '0')}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {metrics.hasCMEColumns ? (
                      <>
                        <div className="bg-white rounded-lg p-1.5 border border-blue-200 shadow-sm">
                          <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">CME Start</div>
                          <div className="text-lg font-black text-slate-900 mt-0.5">{metrics.cmeStart}</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-1.5 border border-blue-200 shadow-sm">
                          <div className="text-[9px] text-blue-700 font-bold uppercase tracking-wider">Civil</div>
                          <div className="text-lg font-black text-blue-700 mt-0.5">{metrics.civilDone}</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-1.5 border border-amber-200 shadow-sm">
                          <div className="text-[9px] text-amber-700 font-bold uppercase tracking-wider">ME</div>
                          <div className="text-lg font-black text-amber-700 mt-0.5">{metrics.meDone}</div>
                        </div>
                        <div className="bg-rose-50 rounded-lg p-1.5 border border-rose-200 shadow-sm">
                          <div className="text-[9px] text-rose-700 font-bold uppercase tracking-wider">ATP CME</div>
                          <div className="text-lg font-black text-rose-700 mt-0.5">{metrics.atpCME}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-white rounded-lg p-1.5 border border-blue-200 shadow-sm">
                          <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">MOS</div>
                          <div className="text-lg font-black text-slate-900 mt-0.5">{metrics.mosCompleted}</div>
                        </div>
                        <div className="bg-rose-50 rounded-lg p-1.5 border border-rose-200 shadow-sm">
                          <div className="text-[9px] text-rose-700 font-bold uppercase tracking-wider">Pending</div>
                          <div className="text-lg font-black text-rose-700 mt-0.5">{metrics.mosCompleted - metrics.atpApproved}</div>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-1.5 border border-emerald-200 shadow-sm">
                          <div className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider">Rate</div>
                          <div className="text-lg font-black text-emerald-700 mt-0.5">
                            {metrics.mosCompleted > 0 ? ((metrics.atpApproved / metrics.mosCompleted) * 100).toFixed(0) : '0'}%
                          </div>
                        </div>
                        <div className={`rounded-lg p-1.5 border shadow-sm ${
                          loading || !metrics.avgPoRemainingPercent && Object.keys(poRemainingMap).length === 0
                            ? 'bg-blue-50 border-blue-200'
                            : metrics.avgPoRemainingPercent
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="text-[9px] text-slate-700 font-bold uppercase tracking-wider">PO Remain</div>
                          <div className={`text-lg font-black mt-0.5 ${
                            loading || !metrics.avgPoRemainingPercent && Object.keys(poRemainingMap).length === 0
                              ? 'text-blue-400 animate-pulse'
                              : metrics.avgPoRemainingPercent
                              ? 'text-blue-700'
                              : 'text-slate-400'
                          }`}>
                            {loading || !metrics.avgPoRemainingPercent && Object.keys(poRemainingMap).length === 0
                              ? '...'
                              : metrics.avgPoRemainingPercent
                              ? `${metrics.avgPoRemainingPercent}%`
                              : 'N/A'}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Inbound / BPUJL - Asset Return / Regulatory Revenue */}
                <div className="bg-gradient-to-br from-purple-50 via-white to-purple-50/30 rounded-xl border-2 border-purple-200 p-3 shadow-sm hover:shadow-lg hover:border-purple-300 transition-all duration-300">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-sm">
                        <Database className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-purple-700">
                          {metrics.hasCMEColumns ? 'BPUJL' : 'Inbound'}
                        </h3>
                        <p className="text-[9px] text-purple-600 font-semibold tracking-wide uppercase opacity-75">
                          {metrics.hasCMEColumns ? 'Regulatory Invoice' : 'Asset Return Invoice'}
                        </p>
                      </div>
                    </div>
                    {!metrics.hasCMEColumns && (
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        loading || (!metrics.totalInvoicePendingDismantle && Object.keys(invoicePendingDismantleMap).length === 0)
                          ? 'bg-amber-100 text-amber-400 animate-pulse'
                          : metrics.totalInvoicePendingDismantle && metrics.totalInvoicePendingDismantle > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {loading || (!metrics.totalInvoicePendingDismantle && Object.keys(invoicePendingDismantleMap).length === 0)
                          ? '...'
                          : metrics.totalInvoicePendingDismantle && metrics.totalInvoicePendingDismantle > 0
                          ? `Inv Remaining: ${metrics.totalInvoicePendingDismantle >= 1000000000 
                              ? (metrics.totalInvoicePendingDismantle / 1000000000).toFixed(1) + 'M'
                              : (metrics.totalInvoicePendingDismantle / 1000000).toFixed(0) + 'Jt'}`
                          : 'N/A'}
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-2.5">
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-3xl font-black text-purple-700">
                        {metrics.hasCMEColumns ? metrics.bpujl : metrics.inbound}
                      </span>
                      <span className="text-lg font-bold text-slate-400">
                        / {metrics.hasCMEColumns ? metrics.totalSites : metrics.dismantle}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 bg-purple-100 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 rounded-full transition-all duration-700 shadow-sm"
                          style={{ width: `${metrics.hasCMEColumns
                            ? (metrics.totalSites > 0 ? (metrics.bpujl / metrics.totalSites) * 100 : 0)
                            : (metrics.dismantle > 0 ? (metrics.inbound / metrics.dismantle) * 100 : 0)}%` }}
                        />
                      </div>
                      <span className="text-sm font-black text-purple-700 min-w-[3rem] text-right">
                        {metrics.hasCMEColumns
                          ? (metrics.totalSites > 0 ? ((metrics.bpujl / metrics.totalSites) * 100).toFixed(1) : '0')
                          : (metrics.dismantle > 0 ? ((metrics.inbound / metrics.dismantle) * 100).toFixed(1) : '0')}%
                      </span>
                    </div>
                  </div>

                  <div className={`grid gap-1.5 text-center ${metrics.hasCMEColumns ? 'grid-cols-3' : 'grid-cols-4'}`}>
                    {metrics.hasCMEColumns ? (
                      <>
                        <div className="bg-purple-50 rounded-lg p-1.5 border border-purple-200 shadow-sm">
                          <div className="text-[9px] text-purple-700 font-bold uppercase tracking-wider">PLN MG</div>
                          <div className="text-lg font-black text-purple-700 mt-0.5">{metrics.plnMG}</div>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-1.5 border border-indigo-200 shadow-sm">
                          <div className="text-[9px] text-indigo-700 font-bold uppercase tracking-wider">Connected</div>
                          <div className="text-lg font-black text-indigo-700 mt-0.5">{metrics.plnConnected}</div>
                        </div>
                        <div className="bg-cyan-50 rounded-lg p-1.5 border border-cyan-200 shadow-sm">
                          <div className="text-[9px] text-cyan-700 font-bold uppercase tracking-wider">ATP PLN</div>
                          <div className="text-lg font-black text-cyan-700 mt-0.5">{metrics.atpPLN}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-white rounded-lg p-1.5 border border-purple-200 shadow-sm">
                          <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">Dismantle</div>
                          <div className="text-lg font-black text-slate-900 mt-0.5">{metrics.dismantle}</div>
                        </div>
                        <div className="bg-rose-50 rounded-lg p-1.5 border border-rose-200 shadow-sm">
                          <div className="text-[9px] text-rose-700 font-bold uppercase tracking-wider">Pending</div>
                          <div className="text-lg font-black text-rose-700 mt-0.5">{metrics.dismantle - metrics.inbound}</div>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-1.5 border border-emerald-200 shadow-sm">
                          <div className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider">Rate</div>
                          <div className="text-lg font-black text-emerald-700 mt-0.5">
                            {metrics.dismantle > 0 ? ((metrics.inbound / metrics.dismantle) * 100).toFixed(0) : '0'}%
                          </div>
                        </div>
                        <div className={`rounded-lg p-2 border ${
                          loading || (!metrics.avgPoRemainingDismantlePercent && Object.keys(poRemainingDismantleMap).length === 0)
                            ? 'bg-purple-50 border-purple-100'
                            : metrics.avgPoRemainingDismantlePercent
                            ? 'bg-purple-50 border-purple-100'
                            : 'bg-slate-50 border-slate-100'
                        }`}>
                          <div className="text-[10px] text-slate-600 font-medium">PO Remain</div>
                          <div className={`text-base font-bold ${
                            loading || (!metrics.avgPoRemainingDismantlePercent && Object.keys(poRemainingDismantleMap).length === 0)
                              ? 'text-purple-400 animate-pulse'
                              : metrics.avgPoRemainingDismantlePercent
                              ? 'text-purple-700'
                              : 'text-slate-400'
                          }`}>
                            {loading || (!metrics.avgPoRemainingDismantlePercent && Object.keys(poRemainingDismantleMap).length === 0)
                              ? '...'
                              : metrics.avgPoRemainingDismantlePercent
                              ? `${metrics.avgPoRemainingDismantlePercent}%`
                              : 'N/A'}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* TSSR Closed / ATP PLN - Survey / PLN Revenue */}
                <div className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 rounded-xl border border-emerald-200 p-4 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {metrics.hasCMEColumns ? 'ATP PLN' : 'TSSR Closed'}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {metrics.hasCMEColumns ? 'PLN Acceptance Invoice' : 'Survey Invoice'}
                        </p>
                      </div>
                    </div>
                    {!metrics.hasCMEColumns && (
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        loading || (!metrics.totalInvoicePendingSurvey && Object.keys(invoicePendingSurveyMap).length === 0)
                          ? 'bg-amber-100 text-amber-400 animate-pulse'
                          : metrics.totalInvoicePendingSurvey && metrics.totalInvoicePendingSurvey > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {loading || (!metrics.totalInvoicePendingSurvey && Object.keys(invoicePendingSurveyMap).length === 0)
                          ? '...'
                          : metrics.totalInvoicePendingSurvey && metrics.totalInvoicePendingSurvey > 0
                          ? `Inv Remaining: ${metrics.totalInvoicePendingSurvey >= 1000000000 
                              ? (metrics.totalInvoicePendingSurvey / 1000000000).toFixed(1) + 'M'
                              : (metrics.totalInvoicePendingSurvey / 1000000).toFixed(0) + 'Jt'}`
                          : 'N/A'}
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-bold text-emerald-600">
                        {metrics.hasCMEColumns ? metrics.atpPLN : metrics.tssrClosed}
                      </span>
                      <span className="text-base sm:text-lg font-semibold text-slate-400">
                        / {metrics.hasCMEColumns ? metrics.plnConnected : metrics.surveyCompleted}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
                          style={{ width: `${metrics.hasCMEColumns
                            ? (metrics.plnConnected > 0 ? (metrics.atpPLN / metrics.plnConnected) * 100 : 0)
                            : (metrics.surveyCompleted > 0 ? (metrics.tssrClosed / metrics.surveyCompleted) * 100 : 0)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-emerald-600 min-w-[2.5rem] text-right">
                        {metrics.hasCMEColumns
                          ? (metrics.plnConnected > 0 ? ((metrics.atpPLN / metrics.plnConnected) * 100).toFixed(1) : '0')
                          : (metrics.surveyCompleted > 0 ? ((metrics.tssrClosed / metrics.surveyCompleted) * 100).toFixed(1) : '0')}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    {metrics.hasCMEColumns ? (
                      <>
                        <div className="bg-white rounded-lg p-2 border border-slate-100">
                          <div className="text-[10px] text-slate-500 font-medium">BPUJL</div>
                          <div className="text-base font-bold text-slate-900">{metrics.bpujl}</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-2 border border-purple-100">
                          <div className="text-[10px] text-purple-600 font-medium">Connected</div>
                          <div className="text-base font-bold text-purple-700">{metrics.plnConnected}</div>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                          <div className="text-[10px] text-emerald-600 font-medium">ATP PLN</div>
                          <div className="text-base font-bold text-emerald-700">{metrics.atpPLN}</div>
                        </div>
                        <div className={`rounded-lg p-2 border ${
                          loading || (!metrics.avgPoRemainingPlnPercent && Object.keys(poRemainingPLNMap).length === 0)
                            ? 'bg-emerald-50 border-emerald-100'
                            : metrics.avgPoRemainingPlnPercent
                            ? 'bg-emerald-50 border-emerald-100'
                            : 'bg-slate-50 border-slate-100'
                        }`}>
                          <div className="text-[10px] text-slate-600 font-medium">PO Remain</div>
                          <div className={`text-base font-bold ${
                            loading || (!metrics.avgPoRemainingPlnPercent && Object.keys(poRemainingPLNMap).length === 0)
                              ? 'text-emerald-400 animate-pulse'
                              : metrics.avgPoRemainingPlnPercent
                              ? 'text-emerald-700'
                              : 'text-slate-400'
                          }`}>
                            {loading || (!metrics.avgPoRemainingPlnPercent && Object.keys(poRemainingPLNMap).length === 0)
                              ? '...'
                              : metrics.avgPoRemainingPlnPercent
                              ? `${metrics.avgPoRemainingPlnPercent}%`
                              : 'N/A'}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-white rounded-lg p-2 border border-slate-100">
                          <div className="text-[10px] text-slate-500 font-medium">Survey</div>
                          <div className="text-base font-bold text-slate-900">{metrics.surveyCompleted}</div>
                        </div>
                        <div className="bg-rose-50 rounded-lg p-2 border border-rose-100">
                          <div className="text-[10px] text-rose-600 font-medium">Pending</div>
                          <div className="text-base font-bold text-rose-700">{metrics.surveyCompleted - metrics.tssrClosed}</div>
                        </div>
                        <div className="bg-teal-50 rounded-lg p-2 border border-teal-100">
                          <div className="text-[10px] text-teal-600 font-medium">Rate</div>
                          <div className="text-base font-bold text-teal-700">
                            {metrics.surveyCompleted > 0 ? ((metrics.tssrClosed / metrics.surveyCompleted) * 100).toFixed(0) : '0'}%
                          </div>
                        </div>
                        <div className={`rounded-lg p-2 border ${
                          loading || (!metrics.avgPoRemainingSurveyPercent && Object.keys(poRemainingSurveyMap).length === 0)
                            ? 'bg-emerald-50 border-emerald-100'
                            : metrics.avgPoRemainingSurveyPercent
                            ? 'bg-emerald-50 border-emerald-100'
                            : 'bg-slate-50 border-slate-100'
                        }`}>
                          <div className="text-[10px] text-slate-600 font-medium">PO Remain</div>
                          <div className={`text-base font-bold ${
                            loading || (!metrics.avgPoRemainingSurveyPercent && Object.keys(poRemainingSurveyMap).length === 0)
                              ? 'text-emerald-400 animate-pulse'
                              : metrics.avgPoRemainingSurveyPercent
                              ? 'text-emerald-700'
                              : 'text-slate-400'
                          }`}>
                            {loading || (!metrics.avgPoRemainingSurveyPercent && Object.keys(poRemainingSurveyMap).length === 0)
                              ? '...'
                              : metrics.avgPoRemainingSurveyPercent
                              ? `${metrics.avgPoRemainingSurveyPercent}%`
                              : 'N/A'}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              </div>
            )}

            {/* Summary Cards */}
            {!loading && !error && metrics && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className={`grid gap-3 md:gap-4 ${
                  metrics.hasCMEColumns 
                    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-10' 
                    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9'
                }`}>
            {/* Total Sites */}
            <div 
              onClick={() => openTotalSitesModal()}
              className="group bg-white rounded-xl border border-slate-200/60 p-3 md:p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Total Sites</p>
                  <p className="text-2xl font-bold bg-gradient-to-br from-blue-600 to-indigo-700 bg-clip-text text-transparent mt-1">{metrics.totalSites}</p>
                </div>
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Database className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
              </div>
            </div>

            {/* Team Qty */}
            <div 
              onClick={() => openTeamListModal()}
              className="group bg-white rounded-xl border border-slate-200/60 p-3 md:p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Team Qty</p>
                  <p className="text-2xl font-bold bg-gradient-to-br from-purple-600 to-pink-700 bg-clip-text text-transparent mt-1">{metrics.teamQty}</p>
                </div>
                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
              </div>
            </div>

            {/* Regular Project Cards */}
            {metrics.hasRegularColumns && (
              <>
            {/* Survey */}
            <div 
              onClick={() => openSiteListModal('Survey', 'Survey')}
              className="group bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Survey</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.surveyCompleted}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">-</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* MOS */}
            <div 
              onClick={() => openSiteListModal('MOS', 'MOS')}
              className="group bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">MOS</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{metrics.mosCompleted}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">-</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* Install Done */}
            <div 
              onClick={() => openSiteListModal('Install Done', 'Install Done')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Install Done</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{metrics.installCompleted}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.installProgress}% of MOS</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Clock className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* Integrated */}
            <div 
              onClick={() => openSiteListModal('Integrated', 'Integrated')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Integrated</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{metrics.integratedCompleted}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.mosCompleted > 0 ? ((metrics.integratedCompleted / metrics.mosCompleted) * 100).toFixed(0) : '0'}% of MOS</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* ATP Submit */}
            <div 
              onClick={() => openSiteListModal('ATP Submit', 'ATP Submit')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">ATP Submit</p>
                  <p className="text-2xl font-bold text-cyan-600 mt-1">{metrics.atpSubmit}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.mosCompleted > 0 ? ((metrics.atpSubmit / metrics.mosCompleted) * 100).toFixed(0) : '0'}% of MOS</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <FileCheck className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* ATP Approved */}
            <div 
              onClick={() => openSiteListModal('ATP Approved', 'ATP Approved')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">ATP Approved</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">{metrics.atpApproved}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.mosCompleted > 0 ? ((metrics.atpApproved / metrics.mosCompleted) * 100).toFixed(0) : '0'}% of MOS</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* Dismantle */}
            <div 
              onClick={() => openSiteListModal('Dismantle', 'Dismantle')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Dismantle</p>
                  <p className="text-2xl font-bold text-rose-600 mt-1">{metrics.dismantle}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.integratedCompleted > 0 ? ((metrics.dismantle / metrics.integratedCompleted) * 100).toFixed(0) : '0'}% of Integrated</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
            </>
            )}

            {/* CME/PLN/BPUJL Project Cards */}
            {metrics.hasCMEColumns && (
              <>
            {/* CME Start */}
            <div 
              onClick={() => openSiteListModal('CME Start', 'CME Start')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">CME Start</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.cmeStart}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">-</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* Civil Done */}
            <div 
              onClick={() => openSiteListModal('Civil Done', 'Civil Done')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Civil Done</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{metrics.civilDone}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.civilDoneProgress}% of CME Start</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* ME Done */}
            <div 
              onClick={() => openSiteListModal('ME Done', 'ME Done')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">ME Done</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{metrics.meDone}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.cmeStart > 0 ? ((metrics.meDone / metrics.cmeStart) * 100).toFixed(0) : '0'}% of CME Start</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Clock className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* ATP CME */}
            <div 
              onClick={() => openSiteListModal('ATP CME', 'ATP CME')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">ATP CME</p>
                  <p className="text-2xl font-bold text-rose-600 mt-1">{metrics.atpCME}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.atpCMEProgress}% of CME Start</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* PLN MG */}
            <div 
              onClick={() => openSiteListModal('PLN MG', 'PLN MG')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">PLN MG</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{metrics.plnMG}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.cmeStart > 0 ? ((metrics.plnMG / metrics.cmeStart) * 100).toFixed(0) : '0'}% of CME Start</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* BPUJL */}
            <div 
              onClick={() => openSiteListModal('BPUJL', 'BPUJL')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">BPUJL</p>
                  <p className="text-2xl font-bold text-cyan-600 mt-1">{metrics.bpujl}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.cmeStart > 0 ? ((metrics.bpujl / metrics.cmeStart) * 100).toFixed(0) : '0'}% of CME Start</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* PLN Connected */}
            <div 
              onClick={() => openSiteListModal('PLN Connected', 'PLN Connected')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">PLN Connected</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">{metrics.plnConnected}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.cmeStart > 0 ? ((metrics.plnConnected / metrics.cmeStart) * 100).toFixed(0) : '0'}% of CME Start</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* ATP PLN */}
            <div 
              onClick={() => openSiteListModal('ATP PLN', 'ATP PLN')}
              className="bg-white rounded-xl border border-slate-200/60 p-4 group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">ATP PLN</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.atpPLN}</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.atpPLNProgress}% of PLN Connected</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
            </>
            )}
          </div>

          {/* Region Progress Comparison Pivot Table */}
          {metrics.regionMetrics && Object.keys(metrics.regionMetrics).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm mb-6 overflow-x-auto">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                Progress Comparison by Region
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="text-left py-3 px-4 font-bold text-slate-900 bg-slate-50 sticky left-0 z-10">Region</th>
                      <th className="text-center py-3 px-4 font-bold text-slate-900 bg-slate-50">Total Sites</th>
                      <th className="text-center py-3 px-3 font-semibold text-purple-700 bg-purple-50">Team Qty</th>
                      <th className="text-center py-3 px-3 font-semibold text-emerald-700 bg-emerald-50">Survey</th>
                      <th className="text-center py-3 px-3 font-semibold text-teal-700 bg-teal-50">TSSR Closed</th>
                      <th className="text-center py-3 px-3 font-semibold text-blue-700 bg-blue-50">MOS</th>
                      <th className="text-center py-3 px-3 font-semibold text-amber-700 bg-amber-50">Install</th>
                      <th className="text-center py-3 px-3 font-semibold text-purple-700 bg-purple-50">Integrated</th>
                      <th className="text-center py-3 px-3 font-semibold text-indigo-700 bg-indigo-50">ATP Submit</th>
                      <th className="text-center py-3 px-3 font-semibold text-cyan-700 bg-cyan-50">ATP Approve</th>
                      <th className="text-center py-3 px-3 font-semibold text-rose-700 bg-rose-50">Dismantle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(metrics.regionMetrics)
                      .sort((a, b) => b[1].total - a[1].total)
                      .map(([region, data], idx) => (
                        <tr key={region} className={`border-b border-slate-200 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                          <td className="py-3 px-4 font-semibold text-slate-900 sticky left-0 bg-inherit z-10">{region}</td>
                          <td className="text-center py-3 px-4 font-bold text-slate-900">{data.total}</td>
                          <td className="text-center py-3 px-3 font-bold text-purple-700">{data.teamQty.size}</td>
                          <td className="text-center py-3 px-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-emerald-700">{data.survey}</span>
                              <span className="text-xs text-slate-600 font-medium">-</span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-teal-700">{data.tssrClosed}</span>
                              <span className="text-xs text-slate-600 font-medium">{data.survey > 0 ? ((data.tssrClosed / data.survey) * 100).toFixed(0) : '0'}%</span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-blue-700">{data.mos}</span>
                              <span className="text-xs text-slate-600 font-medium">-</span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-amber-700">{data.install}</span>
                              <span className="text-xs text-slate-600 font-medium">{data.mos > 0 ? ((data.install / data.mos) * 100).toFixed(0) : '0'}%</span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-purple-700">{data.integrated}</span>
                              <span className="text-xs text-slate-600 font-medium">{data.mos > 0 ? ((data.integrated / data.mos) * 100).toFixed(0) : '0'}%</span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-indigo-700">{data.atpSubmit}</span>
                              <span className="text-xs text-slate-600 font-medium">{data.mos > 0 ? ((data.atpSubmit / data.mos) * 100).toFixed(0) : '0'}%</span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-cyan-700">{data.atp}</span>
                              <span className="text-xs text-slate-600 font-medium">{data.atpSubmit > 0 ? ((data.atp / data.atpSubmit) * 100).toFixed(0) : '0'}%</span>
                            </div>
                          </td>
                          <td className="text-center py-3 px-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-rose-700">{data.dismantle}</span>
                              <span className="text-xs text-slate-600 font-medium">{data.integrated > 0 ? ((data.dismantle / data.integrated) * 100).toFixed(0) : '0'}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {/* Total Row */}
                    <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                      <td className="py-3 px-4 text-slate-900 sticky left-0 bg-slate-100 z-10">TOTAL</td>
                      <td className="text-center py-3 px-4 text-slate-900">{metrics.totalSites}</td>
                      <td className="text-center py-3 px-3 text-purple-700">{metrics.teamQty}</td>
                      <td className="text-center py-3 px-3 text-emerald-700">{metrics.surveyCompleted}</td>
                      <td className="text-center py-3 px-3 text-teal-700">{metrics.tssrClosed}</td>
                      <td className="text-center py-3 px-3 text-blue-700">{metrics.mosCompleted}</td>
                      <td className="text-center py-3 px-3 text-amber-700">{metrics.installCompleted}</td>
                      <td className="text-center py-3 px-3 text-purple-700">{metrics.integratedCompleted}</td>
                      <td className="text-center py-3 px-3 text-indigo-700">{metrics.atpSubmit}</td>
                      <td className="text-center py-3 px-3 text-cyan-700">{metrics.atpApproved}</td>
                      <td className="text-center py-3 px-3 text-rose-700">{metrics.dismantle}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Additional Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Site Status Breakdown */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                  <PieChart className="h-4 w-4 text-white" />
                </div>
                Site Status Distribution
              </h3>
              <div className="space-y-3">
                {Object.entries(metrics.siteStatusCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => {
                    const percentage = ((count / metrics.totalSites) * 100).toFixed(1)
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-slate-700">{status || 'Unknown'}</span>
                          <span className="text-slate-600">{count} ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Project Progress Stages - Legacy */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg">
                  <Calendar className="h-4 w-4 text-white" />
                </div>
                Project Progress Stages
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Survey', value: metrics.surveyCompleted, total: metrics.totalSites, color: 'emerald' },
                  { label: 'MOS', value: metrics.mosCompleted, total: metrics.totalSites, color: 'blue' },
                  { label: 'Install', value: metrics.installCompleted, total: metrics.totalSites, color: 'amber' },
                  { label: 'Integrated', value: metrics.integratedCompleted, total: metrics.totalSites, color: 'purple' },
                ].map((stage) => {
                  const percentage = ((stage.value / stage.total) * 100).toFixed(1)
                  const colorClasses = {
                    emerald: 'bg-gradient-to-r from-emerald-500 to-green-600',
                    blue: 'bg-gradient-to-r from-blue-500 to-indigo-600',
                    amber: 'bg-gradient-to-r from-amber-500 to-orange-600',
                    purple: 'bg-gradient-to-r from-purple-500 to-violet-600',
                  }
                  return (
                    <div key={stage.label}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium text-slate-900">{stage.label}</span>
                        <span className="text-slate-700 font-medium">{stage.value} / {stage.total} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className={`${colorClasses[stage.color as keyof typeof colorClasses]} h-2 rounded-full transition-all`}
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

            {/* Predictive Analytics Panel */}
            {analytics && metrics && (
              <div className="bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-xl border border-slate-200 p-4 md:p-5 shadow-sm mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg shadow-sm">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Project Performance & Forecast</h3>
                      <p className="text-xs text-slate-600 mt-0.5 font-medium">Real-time analytics with predictive insights</p>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 bg-slate-800 text-white rounded-lg shadow-sm">
                    <span className="text-xs font-semibold">LIVE</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  {/* Current Velocity */}
                  <div className="bg-white rounded-xl p-4 border border-blue-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-slate-900">Current Velocity</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">{analytics.velocity}</div>
                    <div className="text-xs text-slate-600 font-medium">sites/day completion rate</div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Remaining</span>
                        <span className="font-semibold text-slate-900">{metrics.totalSites - metrics.atpApproved} sites</span>
                      </div>
                    </div>
                  </div>

                  {/* Completion Forecast */}
                  <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-slate-900">Est. Completion</span>
                    </div>
                    <div className="text-xl font-bold text-emerald-600 mb-1 leading-tight">{analytics.estimatedCompletion}</div>
                    <div className="text-xs text-slate-600 font-medium">based on current pace</div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Days to Go</span>
                        <span className="font-semibold text-slate-900">{analytics.daysToComplete < 999 ? analytics.daysToComplete : 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Risk Alert */}
                  <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-semibold text-slate-900">Stuck Sites</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-amber-600 mb-1">{analytics.stuckSites}</div>
                    <div className="text-xs text-slate-600 font-medium">&gt;30 days no activity</div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Risk Level</span>
                        <span className={`font-semibold ${analytics.stuckSites / metrics.totalSites > 0.15 ? 'text-rose-600' : analytics.stuckSites / metrics.totalSites > 0.05 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {analytics.stuckSites / metrics.totalSites > 0.15 ? 'HIGH' : analytics.stuckSites / metrics.totalSites > 0.05 ? 'MEDIUM' : 'LOW'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottleneck Detection */}
                  <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle className="h-4 w-4 text-rose-600" />
                      <span className="text-sm font-semibold text-slate-900">Bottleneck</span>
                    </div>
                    <div className="text-lg font-bold text-rose-600 mb-1 leading-tight">{analytics.bottleneck.name}</div>
                    <div className="text-xs text-slate-600 font-medium">slowest phase</div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Completion</span>
                        <span className="font-semibold text-rose-600">{analytics.bottleneck.progress.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading/Error States */}
            {loading && (
              <div className="flex items-center justify-center p-12">
                <div className="text-center">
                  <LoadingSpinner />
                  <p className="mt-4 text-sm text-slate-600 font-medium">Loading dashboard data...</p>
                </div>
              </div>
            )}
            
            {error && (
              <div className="flex items-center justify-center p-12">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-rose-50 rounded-2xl flex items-center justify-center">
                    <XCircle className="h-8 w-8 text-rose-500" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-2">Error Loading Data</h3>
                  <p className="text-sm text-slate-600 mb-4 font-medium">{error}</p>
                  <button
                    onClick={() => fetchAllData()}
                    className="px-4 py-2 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Site List Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-[95%] max-w-[1400px] max-h-[85vh] flex flex-col animate-slideUp">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-6 border-b border-slate-200 gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {modalType === 'team' ? modalData.title : modalType === 'totalSites' ? modalData.title : `${modalData.title} - Site List`}
                </h2>
                <p className="text-sm text-slate-600 mt-1 font-medium">
                  Showing {modalData.sites.length} of {modalData.allSites.length} {modalType === 'team' ? 'teams' : 'sites'} {modalType !== 'totalSites' && '(most recent)'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadFromModal}
                  className="px-3 sm:px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2 text-xs sm:text-sm font-medium shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download Excel</span>
                  <span className="sm:hidden">Download</span>
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-slate-600" />
                </button>
              </div>
            </div>

            {/* Modal Body - Site List or Team List Table */}
            <div className="flex-1 overflow-auto p-4 md:p-6">
              {modalData.sites.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">No {modalType === 'team' ? 'teams' : 'sites'} found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {modalType === 'team' ? (
                    // Team List Table
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">No</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">TL Name</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">Total Sites</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">Regions</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">Projects</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalData.sites.map((team, index) => (
                          <tr 
                            key={index}
                            className="hover:bg-slate-50 transition-colors border-b border-slate-100"
                          >
                            <td className="px-4 py-3 text-slate-600 font-medium">{index + 1}</td>
                            <td className="px-4 py-3 text-slate-900 font-medium">{team.tlName}</td>
                            <td 
                              className="px-4 py-3 text-purple-600 font-semibold cursor-pointer relative hover:bg-purple-50 transition-colors"
                              onClick={(e) => {
                                if (clickedTeamIndex === index) {
                                  setClickedTeamIndex(null)
                                } else {
                                  setClickedTeamIndex(index)
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setTooltipPosition({ x: rect.left, y: rect.bottom })
                                }
                              }}
                            >
                              {team.totalSites}
                            </td>
                            <td className="px-4 py-3 text-emerald-600 font-medium">{team.regions}</td>
                            <td className="px-4 py-3 text-blue-600 font-medium">{team.projects}</td>
                            <td className="px-4 py-3 text-amber-600 font-medium text-xs">{team.activity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : modalType === 'totalSites' ? (
                    // Total Sites Table with Activity
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">No</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">DUID</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">DU Name</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">Project</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">TL Name</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalData.sites.map((site, index) => (
                          <tr 
                            key={index}
                            className="hover:bg-slate-50 transition-colors border-b border-slate-100"
                          >
                            <td className="px-4 py-3 text-slate-600 font-medium">{index + 1}</td>
                            <td className="px-4 py-3 font-mono text-slate-900 font-medium">{site.duid}</td>
                            <td className="px-4 py-3 text-slate-900">{site.duName}</td>
                            <td className="px-4 py-3 text-blue-600 font-medium">{site.project}</td>
                            <td className="px-4 py-3 text-purple-600 font-medium">{site.tlName}</td>
                            <td className="px-4 py-3 text-emerald-600 font-medium text-xs">{site.activity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    // Site List Table
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">No</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">DUID</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">DU Name</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">Project</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">TL Name</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalData.sites.map((site, index) => (
                          <tr 
                            key={index}
                            className="hover:bg-slate-50 transition-colors border-b border-slate-100"
                          >
                            <td className="px-4 py-3 text-slate-600 font-medium">{index + 1}</td>
                            <td className="px-4 py-3 font-mono text-slate-900 font-medium">{site.duid}</td>
                            <td className="px-4 py-3 text-slate-900">{site.duName}</td>
                            <td className="px-4 py-3 text-blue-600 font-medium">{site.project}</td>
                            <td className="px-4 py-3 text-purple-600 font-medium">{site.tlName}</td>
                            <td className="px-4 py-3 text-slate-600 font-medium">{site.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Site List Popup for Team - Outside modal */}
      {clickedTeamIndex !== null && modalType === 'team' && modalData.sites[clickedTeamIndex]?.siteDetails && (
        <>
          <div 
            className="fixed inset-0 z-[59]"
            onClick={() => setClickedTeamIndex(null)}
          ></div>
          <div 
            className="fixed z-[60] bg-white border border-slate-300 rounded-lg shadow-2xl p-3 max-h-96 overflow-y-auto w-96"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y + 5}px`
            }}
          >
            <div className="text-xs font-semibold text-slate-700 mb-2 pb-2 border-b border-slate-200">
              Site List - {modalData.sites[clickedTeamIndex].tlName} ({modalData.sites[clickedTeamIndex].siteDetails.length} sites)
            </div>
            <div className="space-y-1">
              {modalData.sites[clickedTeamIndex].siteDetails.map((site: any, siteIdx: number) => (
                <div key={siteIdx} className="text-xs py-1 border-b border-slate-100 last:border-0">
                  <div className="font-mono text-slate-900 font-medium">{site.duid}</div>
                  <div className="text-slate-600 truncate">{site.duName}</div>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-blue-600 font-medium">{site.project}</span>
                    <span className="text-emerald-600">{site.region}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
