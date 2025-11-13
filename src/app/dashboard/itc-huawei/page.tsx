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
  Download
} from 'lucide-react'

interface SheetListItem {
  sheetName: string
  title: string
}

type PeriodFilter = 'all' | 'year' | 'sixmonths' | 'month' | 'week'

export default function ItcHuaweiDashboard() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetList, setSheetList] = useState<SheetListItem[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [loadingSheetList, setLoadingSheetList] = useState(true)
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')

  const fetchData = async (sheetName: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/sheets/itc-huawei?sheetName=${sheetName}`)
      
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
    if (selectedSheet) {
      fetchData(selectedSheet)
    } else if (sheetList.length > 0 && !selectedSheet) {
      // Auto-select first sheet when list is loaded
      setSelectedSheet(sheetList[0].sheetName)
    }
  }, [selectedSheet, sheetList])

  // Helper function to parse date with multiple formats
  const parseDate = useCallback((dateStr: string): Date | null => {
    if (!dateStr || dateStr === 'N/A' || dateStr === '#REF!' || dateStr === '-') return null
    
    try {
      // Try DD/MM/YY format (13/10/25)
      const ddmmyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
      if (ddmmyyMatch) {
        const day = parseInt(ddmmyyMatch[1], 10)
        const month = parseInt(ddmmyyMatch[2], 10) - 1 // Month is 0-indexed
        const year = 2000 + parseInt(ddmmyyMatch[3], 10) // Assume 20xx
        const date = new Date(year, month, day)
        if (!isNaN(date.getTime())) return date
      }
      
      // Try DD/MM/YYYY format (02/11/2025)
      const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10)
        const month = parseInt(ddmmyyyyMatch[2], 10) - 1
        const year = parseInt(ddmmyyyyMatch[4], 10)
        const date = new Date(year, month, day)
        if (!isNaN(date.getTime())) return date
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
        if (month !== undefined) {
          const date = new Date(year, month, day)
          if (!isNaN(date.getTime())) return date
        }
      }
      
      // Try standard date parsing
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) return date
      
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

  const filteredData = data

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
    
    // Rollout Progress
    let mosCompleted = 0
    let installCompleted = 0
    let integratedCompleted = 0
    let atpSubmit = 0
    let atpApproved = 0
    
    // Dismantle Progress
    let dismantle = 0
    let baDismantle = 0
    let inbound = 0
    
    filteredData.forEach(row => {
      // Only count rows that have at least one valid date field in filter range
      const hasValidDateInRange = 
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
        getFilteredValue(row['Inbound'])
      
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
        // Debug: log first 5
        if (mosCompleted <= 5) {
          console.log(`MOS #${mosCompleted}: "${mos}"`)
        }
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
    })

    // Debug log for MOS
    if (periodFilter !== 'all') {
      console.log(`Filter: ${periodFilter}, MOS Completed: ${mosCompleted}`)
    }

    return {
      totalSites,
      siteStatusCounts,
      regionCounts,
      
      // Survey Progress (compare within group)
      surveyCompleted,
      tssrClosed,
      surveyProgress: ((surveyCompleted / totalSites) * 100).toFixed(1),
      tssrClosedProgress: surveyCompleted > 0 ? ((tssrClosed / surveyCompleted) * 100).toFixed(1) : '0',
      
      // Rollout Progress (compare within group)
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
      
      // Dismantle Progress (compare within group)
      dismantle,
      baDismantle,
      inbound,
      dismantleProgress: ((dismantle / totalSites) * 100).toFixed(1),
      baDismantleProgress: dismantle > 0 ? ((baDismantle / dismantle) * 100).toFixed(1) : '0',
      inboundProgress: baDismantle > 0 ? ((inbound / baDismantle) * 100).toFixed(1) : '0',
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

  // Function to download site list based on field
  const downloadSiteList = (fieldName: string, label: string) => {
    const filteredRows = filteredData.filter(row => {
      const value = row[fieldName]
      return getFilteredValue(value)
    })

    if (filteredRows.length === 0) {
      alert('No data to download')
      return
    }

    // Prepare data for Excel
    const excelData = filteredRows.map(row => ({
      'DUID': row['DUID'] || row['DU ID'] || '',
      'DU Name': row['DU Name'] || row['DUName'] || '',
      'Site Name': row['Site Name'] || row['SiteName'] || '',
      'Region': row['Region'] || '',
      'Site Status': row['Site Status'] || row['SiteStatus'] || '',
      [fieldName]: row[fieldName] || ''
    }))

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Site List')

    // Auto-size columns
    const colWidths = [
      { wch: 15 }, // DUID
      { wch: 25 }, // DU Name
      { wch: 30 }, // Site Name
      { wch: 15 }, // Region
      { wch: 15 }, // Site Status
      { wch: 15 }  // Field value
    ]
    ws['!cols'] = colWidths

    // Download file
    XLSX.writeFile(wb, `${label}_SiteList_${selectedSheet}_${periodFilter}.xlsx`)
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <div className="flex-none mb-4">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-slate-200/60 p-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                ITC HUAWEI Dashboard
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Project rollout overview and analytics
              </p>
            </div>

            {/* Period Filter Buttons */}
            <div className="flex items-center gap-2">
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setPeriodFilter(option.value)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                    ${periodFilter === option.value
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-200/50'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-700'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Smart Analytics Cards - Modern Soft Design */}
          {analytics && metrics && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Project Health Score */}
              <div className="group bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                      <TrendingUp className="h-3 w-3 text-white" />
                    </div>
                    Health Score
                  </h3>
                </div>
                <div className="text-center mb-3">
                  <div className="text-3xl font-black bg-gradient-to-br from-blue-600 to-indigo-700 bg-clip-text text-transparent">
                    {(() => {
                      const avgProgress = (
                        parseFloat(metrics.surveyProgress) +
                        parseFloat(metrics.mosProgress) +
                        parseFloat(metrics.dismantleProgress)
                      ) / 3
                      return avgProgress.toFixed(0)
                    })()}
                  </div>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center bg-slate-50 rounded-lg px-2 py-1">
                    <span className="text-slate-600">Total Sites</span>
                    <span className="font-bold text-slate-800">{metrics.totalSites}</span>
                  </div>
                  <div className="flex justify-between items-center bg-emerald-50 rounded-lg px-2 py-1">
                    <span className="text-emerald-600">Completed</span>
                    <span className="font-bold text-emerald-700">{metrics.atpApproved}</span>
                  </div>
                  <div className="flex justify-between items-center bg-rose-50 rounded-lg px-2 py-1">
                    <span className="text-rose-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Stuck Sites
                    </span>
                    <span className="font-bold text-rose-700">{analytics.stuckSites}</span>
                  </div>
                </div>
              </div>

              {/* Top Performers */}
              <div className="group bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                    Top 3 Regions
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {analytics.topRegions.map((region, idx) => (
                    <div key={region.region} className="flex justify-between items-center text-xs bg-emerald-50/50 hover:bg-emerald-50 rounded-lg p-2 transition-colors">
                      <div className="flex items-center gap-2 flex-1">
                        <span className={`text-xs font-bold text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ${
                          idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                          idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400' :
                          'bg-gradient-to-br from-amber-600 to-orange-700'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-slate-700 font-semibold truncate">{region.region}</span>
                      </div>
                      <span className="text-sm font-black text-emerald-600 ml-2">{region.performanceScore.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Needs Attention */}
              <div className="group bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <div className="p-1.5 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg">
                      <XCircle className="h-3 w-3 text-white" />
                    </div>
                    Needs Attention
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {analytics.bottomRegions.map((region, idx) => (
                    <div key={region.region} className="flex justify-between items-center text-xs bg-rose-50/50 hover:bg-rose-50 rounded-lg p-2 transition-colors">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-bold text-white bg-gradient-to-br from-rose-500 to-red-600 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-slate-700 font-semibold truncate">{region.region}</span>
                      </div>
                      <span className="text-sm font-black text-rose-600 ml-2">{region.performanceScore.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Tabs */}
          {!loadingSheetList && sheetList.length > 0 && (
            <div className="border-b border-slate-200/60 bg-white rounded-t-xl mt-4">
              <nav className="-mb-px flex space-x-1 overflow-x-auto px-4">
                {sheetList.map((sheet) => (
                  <button
                    key={sheet.sheetName}
                    onClick={() => setSelectedSheet(sheet.sheetName)}
                    className={`
                      whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-all duration-200
                      ${selectedSheet === sheet.sheetName
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }
                    `}
                  >
                    {sheet.title}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-slate-200/60">
          <div className="text-center">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-slate-600">Loading dashboard data...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-slate-200/60">
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-rose-50 rounded-2xl flex items-center justify-center">
              <XCircle className="h-8 w-8 text-rose-500" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Error Loading Data</h3>
            <p className="text-sm text-slate-500 mb-4">{error}</p>
            <button
              onClick={() => selectedSheet && fetchData(selectedSheet)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      ) : metrics ? (
        <div className="flex-1 overflow-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
            {/* Total Sites */}
            <div className="group bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Total Sites</p>
                  <p className="text-3xl font-black bg-gradient-to-br from-blue-600 to-indigo-700 bg-clip-text text-transparent mt-1">{metrics.totalSites}</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Database className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>

            {/* Survey */}
            <div className="group bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Survey</p>
                  <p className="text-3xl font-black text-emerald-600 mt-1">{metrics.surveyCompleted}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="px-2 py-0.5 bg-emerald-50 rounded-full">
                      <p className="text-xs font-bold text-emerald-700">{metrics.surveyProgress}%</p>
                    </div>
                  </div>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
              <button
                onClick={() => downloadSiteList('Survey', 'Survey')}
                className="absolute bottom-2 right-2 p-1.5 bg-emerald-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-emerald-700 hover:scale-110 shadow-sm"
                title="Download Site List"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* MOS */}
            <div className="group bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">MOS</p>
                  <p className="text-3xl font-black text-blue-600 mt-1">{metrics.mosCompleted}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="px-2 py-0.5 bg-blue-50 rounded-full">
                      <p className="text-xs font-bold text-blue-700">{metrics.mosProgress}%</p>
                    </div>
                  </div>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
              <button
                onClick={() => downloadSiteList('MOS', 'MOS')}
                className="absolute bottom-2 right-2 p-1.5 bg-blue-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-700 hover:scale-110 shadow-sm"
                title="Download Site List"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Install Done */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-4 relative group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Install Done</p>
                  <p className="text-3xl font-black text-amber-600 mt-1">{metrics.installCompleted}</p>
                  <p className="text-xs text-slate-500 mt-1">{metrics.installProgress}% of MOS</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Clock className="h-5 w-5 text-white" />
                </div>
              </div>
              <button
                onClick={() => downloadSiteList('Install Done', 'InstallDone')}
                className="absolute bottom-2 right-2 p-1.5 bg-amber-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-amber-700 hover:scale-110 shadow-sm"
                title="Download Site List"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Integrated */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-4 relative group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Integrated</p>
                  <p className="text-3xl font-black text-purple-600 mt-1">{metrics.integratedCompleted}</p>
                  <p className="text-xs text-slate-500 mt-1">{metrics.integratedProgress}% of Install</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
              <button
                onClick={() => downloadSiteList('Integrated', 'Integrated')}
                className="absolute bottom-2 right-2 p-1.5 bg-purple-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-purple-700 hover:scale-110 shadow-sm"
                title="Download Site List"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* ATP Approved */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-4 relative group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">ATP Approved</p>
                  <p className="text-3xl font-black text-indigo-600 mt-1">{metrics.atpApproved}</p>
                  <p className="text-xs text-slate-500 mt-1">{metrics.atpApprovedProgress}% of Submit</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
              </div>
              <button
                onClick={() => downloadSiteList('ATP Approved', 'ATPApproved')}
                className="absolute bottom-2 right-2 p-1.5 bg-indigo-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-indigo-700 hover:scale-110 shadow-sm"
                title="Download Site List"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Dismantle */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-4 relative group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Dismantle</p>
                  <p className="text-3xl font-black text-rose-600 mt-1">{metrics.dismantle}</p>
                  <p className="text-xs text-slate-500 mt-1">{metrics.dismantleProgress}% of total</p>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
              </div>
              <button
                onClick={() => downloadSiteList('Dismantle', 'Dismantle')}
                className="absolute bottom-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-rose-700 hover:scale-110 shadow-sm"
                title="Download Site List"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Survey Progress */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
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
                          <span className="font-semibold text-slate-700 text-sm">{stage.label}</span>
                          <span className="font-black text-2xl text-emerald-600">{stage.value}</span>
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
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
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
                          <span className="font-semibold text-slate-700 text-sm">{stage.label}</span>
                          <span className="font-black text-2xl text-blue-600">{stage.value}</span>
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
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
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
                          <span className="font-semibold text-slate-700 text-sm">{stage.label}</span>
                          <span className="font-black text-2xl text-rose-600">{stage.value}</span>
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
                        <span className="font-semibold text-slate-700">{stage.label}</span>
                        <span className="text-slate-600">{stage.value} / {stage.total} ({percentage}%)</span>
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

            {/* Region Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-indigo-600" />
                Region Distribution
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(metrics.regionCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([region, count]) => {
                    const percentage = ((count / metrics.totalSites) * 100).toFixed(1)
                    return (
                      <div key={region}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 truncate">{region}</span>
                          <span className="text-gray-600 ml-2">{count}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Region Performance Heatmap */}
            {analytics && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <PieChart className="h-5 w-5 mr-2 text-purple-600" />
                  Region Performance Heatmap
                </h3>
                <p className="text-xs text-gray-600 mb-4">
                  Weighted score: 70% completion rate + 30% site volume
                </p>
                <div className="space-y-2">
                  {analytics.topRegions.concat(analytics.bottomRegions)
                    .sort((a, b) => b.performanceScore - a.performanceScore)
                    .map((region) => {
                      const intensity = Math.min(Math.max(region.performanceScore, 0), 100)
                      const bgColor = intensity >= 70 
                        ? `rgba(34, 197, 94, ${intensity / 100})` 
                        : intensity >= 40 
                        ? `rgba(234, 179, 8, ${intensity / 100})` 
                        : `rgba(239, 68, 68, ${0.3 + (intensity / 200)})`
                      
                      const textColor = intensity >= 50 ? 'text-white' : 'text-gray-900'

                      return (
                        <div
                          key={region.region}
                          className={`rounded-lg p-3 transition-all hover:scale-102 cursor-pointer border ${textColor}`}
                          style={{ backgroundColor: bgColor }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-sm">{region.region}</div>
                              <div className="text-xs opacity-90 mt-1">
                                {region.completed}/{region.count} sites • {region.completionRate.toFixed(1)}% completion
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold">{region.performanceScore.toFixed(0)}</div>
                              <div className="text-xs opacity-90">score</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-red-500"></span>
                      Low (&lt;40)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-yellow-500"></span>
                      Medium (40-70)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-green-500"></span>
                      High (&gt;70)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
