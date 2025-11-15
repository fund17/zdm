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
  X
} from 'lucide-react'

interface SheetListItem {
  sheetName: string
  title: string
}

type PeriodFilter = 'all' | 'year' | 'sixmonths' | 'month' | 'week'

export default function ItcHuaweiDashboard() {
  const [allData, setAllData] = useState<any[]>([]) // Combined data from all sheets
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetList, setSheetList] = useState<SheetListItem[]>([])
  const [loadingSheetList, setLoadingSheetList] = useState(true)
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalData, setModalData] = useState<{ title: string; sites: any[]; allSites: any[] }>({ title: '', sites: [], allSites: [] })

  const fetchAllData = async () => {
    try {
      setLoading(true)
      
      // Fetch all sheets in parallel
      const promises = sheetList.map(sheet => 
        fetch(`/api/sheets/itc-huawei?sheetName=${sheet.sheetName}`)
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
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
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
      console.error('Failed to fetch sheet list:', err)
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
      // IMPORTANT: Server returns DD/MM/YYYY format
      // We must parse day and month correctly (NOT month/day)
      
      // Try DD/MM/YYYY format (02/11/2025) - PRIMARY FORMAT FROM SERVER
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
    
    const now = new Date()
    now.setHours(23, 59, 59, 999)
    const filterDate = new Date()

    switch (periodFilter) {
      case 'year':
        filterDate.setMonth(0, 1)
        filterDate.setHours(0, 0, 0, 0)
        break
      case 'sixmonths':
        filterDate.setMonth(now.getMonth() - 6)
        filterDate.setHours(0, 0, 0, 0)
        break
      case 'month':
        filterDate.setDate(1)
        filterDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        filterDate.setDate(now.getDate() - 7)
        filterDate.setHours(0, 0, 0, 0)
        break
    }

    const rowDate = parseDate(dateStr)
    if (!rowDate) return false
    
    return rowDate >= filterDate && rowDate <= now
  }, [periodFilter, parseDate])

  // Apply filters to data
  const filteredData = useMemo(() => {
    let filtered = allData

    // Filter by region
    if (selectedRegion !== 'all') {
      filtered = filtered.filter(row => row['Region'] === selectedRegion)
    }

    // Filter by project
    if (selectedProject !== 'all') {
      filtered = filtered.filter(row => row['_project'] === selectedProject)
    }

    return filtered
  }, [allData, selectedRegion, selectedProject])

  // Get unique regions and projects for filter options
  const regions = useMemo(() => {
    const uniqueRegions = Array.from(new Set(allData.map(row => row['Region']).filter(Boolean)))
    return uniqueRegions.sort()
  }, [allData])

  const projects = useMemo(() => {
    const uniqueProjects = Array.from(new Set(allData.map(row => row['_project']).filter(Boolean)))
    return uniqueProjects.sort()
  }, [allData])

  // Calculate metrics from data
  const metrics = useMemo(() => {
    if (filteredData.length === 0) return null

    const totalSites = filteredData.length
    
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
    
    // Detect project type from first row
    const hasRegularColumns = filteredData.length > 0 && ('Survey' in filteredData[0] || 'MOS' in filteredData[0])
    const hasCMEColumns = filteredData.length > 0 && ('CME Start' in filteredData[0] || 'ATP CME' in filteredData[0])
    
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
        const status = row['Site Status'] || row['SiteStatus'] || 'Unknown'
        siteStatusCounts[status] = (siteStatusCounts[status] || 0) + 1
        
        // Region
        const region = row['Region'] || 'Unknown'
        regionCounts[region] = (regionCounts[region] || 0) + 1
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

    return {
      totalSites,
      siteStatusCounts,
      regionCounts,
      
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
    }
  }, [filteredData, periodFilter, getFilteredValue])

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
    { value: 'year' as PeriodFilter, label: 'This Year' },
    { value: 'sixmonths' as PeriodFilter, label: 'Last 6 Months' },
    { value: 'month' as PeriodFilter, label: 'This Month' },
    { value: 'week' as PeriodFilter, label: 'This Week' },
  ]

  // Function to open site list modal
  const openSiteListModal = (fieldName: string, label: string) => {
    const filteredRows = filteredData.filter(row => {
      const value = row[fieldName]
      return getFilteredValue(value)
    })

    // Map all sites with correct column names (DUID, DU Name)
    const allSites = filteredRows.map(row => ({
      duid: row['DUID'] || row['DU ID'] || '-',
      duName: row['DU Name'] || row['DUName'] || '-',
      date: row[fieldName] || '-',
      dateObj: parseDate(row[fieldName])
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
    setModalOpen(true)
  }

  // Function to download from modal
  const downloadFromModal = () => {
    if (modalData.allSites.length === 0) return

    const excelData = modalData.allSites.map(site => ({
      'DUID': site.duid,
      'DU Name': site.duName,
      'Date': site.date
    }))

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Site List')

    const colWidths = [
      { wch: 20 },
      { wch: 40 },
      { wch: 15 }
    ]
    ws['!cols'] = colWidths

    const projectName = selectedProject !== 'all' ? selectedProject.replace(/\s+/g, '_') : 'AllProjects'
    const regionName = selectedRegion !== 'all' ? selectedRegion.replace(/\s+/g, '_') : 'AllRegions'
    XLSX.writeFile(wb, `${modalData.title}_SiteList_${projectName}_${regionName}_${periodFilter}.xlsx`)
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="container mx-auto px-2 sm:px-3 py-2 flex-1 flex flex-col max-h-[calc(100vh-4rem)]">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 flex flex-col h-full">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200/60 p-4 md:p-5">
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

              {/* Divider */}
              <div className="h-8 w-px bg-slate-300"></div>

              {/* Region Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs font-medium text-slate-700 whitespace-nowrap">Region:</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Regions</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-xs font-medium text-slate-700 whitespace-nowrap">Project:</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Projects</option>
                  {projects.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 hover:scrollbar-thumb-slate-400">
            {/* Professional Revenue & Performance Analytics */}
            {analytics && metrics && (
              <div className="space-y-4 mt-6 pt-6 border-t border-slate-200">
              {/* Revenue Milestone Cards - Compact */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* ATP Approved / ATP CME - Implementation Revenue */}
                <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50/30 rounded-xl border border-blue-200 p-4 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {metrics.hasCMEColumns ? 'ATP CME' : 'ATP Approved'}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium">Implementation Invoice</p>
                      </div>
                    </div>
                    <div className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-semibold">BILLABLE</div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-bold text-blue-600">
                        {metrics.hasCMEColumns ? metrics.atpCME : metrics.atpApproved}
                      </span>
                      <span className="text-base sm:text-lg font-semibold text-slate-400">
                        / {metrics.hasCMEColumns ? metrics.meDone : metrics.atpSubmit}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${metrics.hasCMEColumns 
                            ? (metrics.meDone > 0 ? (metrics.atpCME / metrics.meDone) * 100 : 0)
                            : (metrics.atpSubmit > 0 ? (metrics.atpApproved / metrics.atpSubmit) * 100 : 0)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-blue-600 min-w-[2.5rem] text-right">
                        {metrics.hasCMEColumns
                          ? (metrics.meDone > 0 ? ((metrics.atpCME / metrics.meDone) * 100).toFixed(1) : '0')
                          : (metrics.atpSubmit > 0 ? ((metrics.atpApproved / metrics.atpSubmit) * 100).toFixed(1) : '0')}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    {metrics.hasCMEColumns ? (
                      <>
                        <div className="bg-white rounded-lg p-2 border border-slate-100">
                          <div className="text-[10px] text-slate-500 font-medium">CME Start</div>
                          <div className="text-base font-bold text-slate-900">{metrics.cmeStart}</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                          <div className="text-[10px] text-blue-600 font-medium">Civil</div>
                          <div className="text-base font-bold text-blue-700">{metrics.civilDone}</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
                          <div className="text-[10px] text-amber-600 font-medium">ME</div>
                          <div className="text-base font-bold text-amber-700">{metrics.meDone}</div>
                        </div>
                        <div className="bg-rose-50 rounded-lg p-2 border border-rose-100">
                          <div className="text-[10px] text-rose-600 font-medium">ATP CME</div>
                          <div className="text-base font-bold text-rose-700">{metrics.atpCME}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-white rounded-lg p-2 border border-slate-100">
                          <div className="text-[10px] text-slate-500 font-medium">MOS</div>
                          <div className="text-base font-bold text-slate-900">{metrics.mosCompleted}</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                          <div className="text-[10px] text-blue-600 font-medium">Submit</div>
                          <div className="text-base font-bold text-blue-700">{metrics.atpSubmit}</div>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                          <div className="text-[10px] text-emerald-600 font-medium">Rate</div>
                          <div className="text-base font-bold text-emerald-700">
                            {metrics.atpSubmit > 0 ? ((metrics.atpApproved / metrics.atpSubmit) * 100).toFixed(0) : '0'}%
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Inbound / BPUJL - Asset Return / Regulatory Revenue */}
                <div className="bg-gradient-to-br from-purple-50 via-white to-purple-50/30 rounded-xl border border-purple-200 p-4 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                        <Database className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {metrics.hasCMEColumns ? 'BPUJL' : 'Inbound'}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {metrics.hasCMEColumns ? 'Regulatory Invoice' : 'Asset Return Invoice'}
                        </p>
                      </div>
                    </div>
                    <div className="px-2 py-1 bg-purple-600 text-white rounded text-[10px] font-semibold">BILLABLE</div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-bold text-purple-600">
                        {metrics.hasCMEColumns ? metrics.bpujl : metrics.inbound}
                      </span>
                      <span className="text-base sm:text-lg font-semibold text-slate-400">
                        / {metrics.hasCMEColumns ? metrics.totalSites : metrics.dismantle}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500"
                          style={{ width: `${metrics.hasCMEColumns
                            ? (metrics.totalSites > 0 ? (metrics.bpujl / metrics.totalSites) * 100 : 0)
                            : (metrics.dismantle > 0 ? (metrics.inbound / metrics.dismantle) * 100 : 0)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-purple-600 min-w-[2.5rem] text-right">
                        {metrics.hasCMEColumns
                          ? (metrics.totalSites > 0 ? ((metrics.bpujl / metrics.totalSites) * 100).toFixed(1) : '0')
                          : (metrics.dismantle > 0 ? ((metrics.inbound / metrics.dismantle) * 100).toFixed(1) : '0')}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    {metrics.hasCMEColumns ? (
                      <>
                        <div className="bg-purple-50 rounded-lg p-2 border border-purple-100">
                          <div className="text-[10px] text-purple-600 font-medium">PLN MG</div>
                          <div className="text-base font-bold text-purple-700">{metrics.plnMG}</div>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-2 border border-indigo-100">
                          <div className="text-[10px] text-indigo-600 font-medium">Connected</div>
                          <div className="text-base font-bold text-indigo-700">{metrics.plnConnected}</div>
                        </div>
                        <div className="bg-cyan-50 rounded-lg p-2 border border-cyan-100">
                          <div className="text-[10px] text-cyan-600 font-medium">ATP PLN</div>
                          <div className="text-base font-bold text-cyan-700">{metrics.atpPLN}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-white rounded-lg p-2 border border-slate-100">
                          <div className="text-[10px] text-slate-500 font-medium">Dismantle</div>
                          <div className="text-base font-bold text-slate-900">{metrics.dismantle}</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
                          <div className="text-[10px] text-amber-600 font-medium">BA Done</div>
                          <div className="text-base font-bold text-amber-700">{metrics.baDismantle}</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-2 border border-purple-100">
                          <div className="text-[10px] text-purple-600 font-medium">Rate</div>
                          <div className="text-base font-bold text-purple-700">
                            {metrics.baDismantle > 0 ? ((metrics.inbound / metrics.baDismantle) * 100).toFixed(0) : '0'}%
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
                    <div className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-semibold">BILLABLE</div>
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

                  <div className="grid grid-cols-3 gap-2 text-center">
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
                        <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100">
                          <div className="text-[10px] text-emerald-600 font-medium">Rate</div>
                          <div className="text-base font-bold text-emerald-700">
                            {metrics.surveyCompleted > 0 ? ((metrics.tssrClosed / metrics.surveyCompleted) * 100).toFixed(0) : '0'}%
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
                    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' 
                    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7'
                }`}>
            {/* Total Sites */}
            <div className="group bg-white rounded-xl border border-slate-200/60 p-3 md:p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
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
                  <div className="flex items-center gap-1 mt-1">
                    <div className="px-2 py-0.5 bg-emerald-50 rounded-full">
                      <p className="text-xs font-semibold text-emerald-700">{metrics.surveyProgress}%</p>
                    </div>
                  </div>
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
                  <div className="flex items-center gap-1 mt-1">
                    <div className="px-2 py-0.5 bg-blue-50 rounded-full">
                      <p className="text-xs font-semibold text-blue-700">{metrics.mosProgress}%</p>
                    </div>
                  </div>
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
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.integratedProgress}% of Install</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-5 w-5 text-white" />
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
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.atpApprovedProgress}% of Submit</p>
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
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.dismantleProgress}% of total</p>
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
                  <div className="flex items-center gap-1 mt-1">
                    <div className="px-2 py-0.5 bg-emerald-50 rounded-full">
                      <p className="text-xs font-semibold text-emerald-700">{metrics.cmeStartProgress}%</p>
                    </div>
                  </div>
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
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.meDoneProgress}% of Civil</p>
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
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.plnMGProgress}% of ME Done</p>
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
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.bpujlProgress}% of total</p>
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
                  <p className="text-xs text-slate-600 mt-1 font-medium">{metrics.plnConnectedProgress}% of total</p>
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

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
            {/* Survey Progress */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
                Survey Progress
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Survey', value: metrics.surveyCompleted, isInitial: true },
                  { label: 'TSSR Closed', value: metrics.tssrClosed, total: metrics.surveyCompleted },
                ].map((stage) => {
                  if (stage.isInitial) {
                    // Initial progress - hanya tampilkan angka tanpa perbandingan
                    return (
                      <div key={stage.label} className="rounded-xl p-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200/50">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700 text-sm">{stage.label}</span>
                          <span className="font-bold text-2xl text-emerald-600">{stage.value}</span>
                        </div>
                      </div>
                    )
                  }
                  
                  const percentage = stage.total && stage.total > 0 ? ((stage.value / stage.total) * 100).toFixed(1) : '0'
                  const percentageNum = parseFloat(percentage)
                  const cappedPercentage = Math.min(percentageNum, 100)
                  const statusColor = getStatusColor(percentageNum)
                  const barColor = getProgressBarColor(percentageNum)
                  
                  return (
                    <div key={stage.label} className={`rounded-xl p-3 border ${statusColor.border} ${statusColor.bg}`}>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-semibold text-slate-700">{stage.label}</span>
                        <span className={`font-bold ${percentageNum > 100 ? 'text-rose-600' : statusColor.text}`}>
                          {stage.value} / {stage.total} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 relative overflow-hidden">
                        <div
                          className={`${barColor} h-2.5 rounded-full transition-all duration-500 relative`}
                          style={{ width: `${cappedPercentage}%` }}
                        >
                          <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rollout Progress */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
                Rollout Progress
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'MOS', value: metrics.mosCompleted, isInitial: true },
                  { label: 'Install Done', value: metrics.installCompleted, total: metrics.mosCompleted },
                  { label: 'Integrated', value: metrics.integratedCompleted, total: metrics.installCompleted },
                  { label: 'ATP Submit', value: metrics.atpSubmit, total: metrics.integratedCompleted },
                  { label: 'ATP Approved', value: metrics.atpApproved, total: metrics.atpSubmit },
                ].map((stage) => {
                  if (stage.isInitial) {
                    // Initial progress - hanya tampilkan angka tanpa perbandingan
                    return (
                      <div key={stage.label} className="rounded-xl p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700 text-sm">{stage.label}</span>
                          <span className="font-bold text-2xl text-blue-600">{stage.value}</span>
                        </div>
                      </div>
                    )
                  }
                  
                  const percentage = stage.total && stage.total > 0 ? ((stage.value / stage.total) * 100).toFixed(1) : '0'
                  const percentageNum = parseFloat(percentage)
                  const cappedPercentage = Math.min(percentageNum, 100)
                  const statusColor = getStatusColor(percentageNum)
                  const barColor = getProgressBarColor(percentageNum)
                  
                  return (
                    <div key={stage.label} className={`rounded-xl p-3 border ${statusColor.border} ${statusColor.bg}`}>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-semibold text-slate-700">{stage.label}</span>
                        <span className={`font-bold ${percentageNum > 100 ? 'text-rose-600' : statusColor.text}`}>
                          {stage.value} / {stage.total} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 relative overflow-hidden">
                        <div
                          className={`${barColor} h-2.5 rounded-full transition-all duration-500 relative`}
                          style={{ width: `${cappedPercentage}%` }}
                        >
                          <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Dismantle Progress */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-white" />
                </div>
                Dismantle Progress
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Dismantle', value: metrics.dismantle, isInitial: true },
                  { label: 'BA Dismantle', value: metrics.baDismantle, total: metrics.dismantle },
                  { label: 'Inbound', value: metrics.inbound, total: metrics.baDismantle },
                ].map((stage) => {
                  if (stage.isInitial) {
                    // Initial progress - hanya tampilkan angka tanpa perbandingan
                    return (
                      <div key={stage.label} className="rounded-xl p-4 bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200/50">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-700 text-sm">{stage.label}</span>
                          <span className="font-bold text-2xl text-rose-600">{stage.value}</span>
                        </div>
                      </div>
                    )
                  }
                  
                  const percentage = stage.total && stage.total > 0 ? ((stage.value / stage.total) * 100).toFixed(1) : '0'
                  const percentageNum = parseFloat(percentage)
                  const cappedPercentage = Math.min(percentageNum, 100)
                  const statusColor = getStatusColor(percentageNum)
                  const barColor = getProgressBarColor(percentageNum)
                  
                  return (
                    <div key={stage.label} className={`rounded-xl p-3 border ${statusColor.border} ${statusColor.bg}`}>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-semibold text-slate-700">{stage.label}</span>
                        <span className={`font-bold ${percentageNum > 100 ? 'text-rose-600' : statusColor.text}`}>
                          {stage.value} / {stage.total} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 relative overflow-hidden">
                        <div
                          className={`${barColor} h-2.5 rounded-full transition-all duration-500 relative`}
                          style={{ width: `${cappedPercentage}%` }}
                        >
                          <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

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
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-slideUp">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-6 border-b border-slate-200 gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{modalData.title} - Site List</h2>
                <p className="text-sm text-slate-600 mt-1 font-medium">Showing {modalData.sites.length} of {modalData.allSites.length} sites (most recent)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadFromModal}
                  className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-xs sm:text-sm font-medium shadow-sm"
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

            {/* Modal Body - Site List Table */}
            <div className="flex-1 overflow-auto p-4 md:p-6">
              {modalData.sites.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">No sites found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">No</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">DUID</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-900 border-b border-slate-200">DU Name</th>
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
                          <td className="px-4 py-3 text-slate-600 font-medium">{site.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
