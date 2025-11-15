'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Calendar, 
  FileText, 
  TrendingUp, 
  Activity,
  BarChart3,
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  MapPin,
  Loader2
} from 'lucide-react'

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

interface DashboardSummary {
  daily: {
    totalTasks: number
    completed: number
    inProgress: number
    pending: number
    teamsWorking: number
  }
  itcHuawei: {
    totalSites: number
    mosCompleted: number
    atpApproved: number
    surveyCompleted: number
  }
  poHuawei: {
    totalSites: number
    statusCounts: {
      cancelled: number
      closed: number
      longAging: number
      new: number
      open: number
    }
    totalAmount: number
    cancelledAmount: number
    invoiced: number
  }
}

export default function LandingDashboard() {
  const [summary, setSummary] = useState<DashboardSummary>({
    daily: {
      totalTasks: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      teamsWorking: 0
    },
    itcHuawei: {
      totalSites: 0,
      mosCompleted: 0,
      atpApproved: 0,
      surveyCompleted: 0
    },
    poHuawei: {
      totalSites: 0,
      statusCounts: {
        cancelled: 0,
        closed: 0,
        longAging: 0,
        new: 0,
        open: 0
      },
      totalAmount: 0,
      cancelledAmount: 0,
      invoiced: 0
    }
  })
  const [loading, setLoading] = useState(true)
  const [poLoading, setPoLoading] = useState(true)

  useEffect(() => {
    loadSummaryData()
  }, [])

  const loadSummaryData = async () => {
    setLoading(true)
    setPoLoading(true)
    
    try {
      // Load Daily Plan and ITC Huawei in parallel (fast data)
      const [dailyResponse, itcResponse] = await Promise.all([
        fetch('/api/sheets'),
        fetch('/api/sheets/itc-huawei')
      ])

      // Process Daily Plan data
      if (dailyResponse.ok) {
        const dailyData = await dailyResponse.json()
        const data = dailyData.data || []
        
        // Filter today's data
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStr = today.toISOString().split('T')[0]
        
        const todayData = data.filter((row: any) => {
          if (!row.Date) return false
          try {
            const rowDate = new Date(row.Date)
            const rowDateStr = rowDate.toISOString().split('T')[0]
            return rowDateStr === todayStr
          } catch (e) {
            return false
          }
        })

        let completed = 0
        let inProgress = 0
        let pending = 0
        const teamsWorking = new Set<string>()

        todayData.forEach((row: any) => {
          const status = (row.Status || '').toLowerCase().trim()
          const team = row['Team Name'] || row['Team'] || row['team']
          
          if (status === 'carry over' || status === 'done') {
            completed++
          } else if (status === 'on going') {
            inProgress++
          } else {
            pending++
          }

          if (team && team !== 'No Team' && status !== 'idle' && status !== 'off') {
            teamsWorking.add(team)
          }
        })

        setSummary(prev => ({
          ...prev,
          daily: {
            totalTasks: todayData.length,
            completed,
            inProgress,
            pending,
            teamsWorking: teamsWorking.size
          }
        }))
      }

      // Process ITC Huawei data
      if (itcResponse.ok) {
        const itcData = await itcResponse.json()
        const data = itcData.data || []
        
        let mosCompleted = 0
        let atpApproved = 0
        let surveyCompleted = 0

        data.forEach((row: any) => {
          if (row['MOS'] && row['MOS'] !== 'N/A' && row['MOS'] !== '') mosCompleted++
          if (row['ATP Approved'] && row['ATP Approved'] !== 'N/A' && row['ATP Approved'] !== '') atpApproved++
          if (row['Survey'] && row['Survey'] !== 'N/A' && row['Survey'] !== '') surveyCompleted++
        })

        setSummary(prev => ({
          ...prev,
          itcHuawei: {
            totalSites: data.length,
            mosCompleted,
            atpApproved,
            surveyCompleted
          }
        }))
      }

      // Mark initial load complete (Daily + ITC loaded)
      setLoading(false)

      // Load PO Huawei data in background (large dataset)
      loadPOData()

    } catch (error) {
      console.error('Error loading summary data:', error)
      setLoading(false)
      setPoLoading(false)
    }
  }

  const loadPOData = async () => {
    try {
      // Check cache first
      const cacheKey = 'po_huawei_dashboard_cache'
      const cacheTimestampKey = 'po_huawei_dashboard_cache_timestamp'
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
          setSummary(prev => ({
            ...prev,
            poHuawei: cached
          }))
          setPoLoading(false)
          return
        }
      }
      
      // No cache or expired - fetch fresh data
      const poResponse = await fetch('/api/sheets/po-huawei')
      if (poResponse.ok) {
        const poData = await poResponse.json()
        const data = poData.data || []
        
        // Save full data to cache for detail dashboard with compression
        const fullDataCacheKey = 'po_huawei_full_data_cache'
        const fullDataCacheTimestampKey = 'po_huawei_full_data_cache_timestamp'
        const compressedData = compressData(data)
        const cacheSaved = safeSetItem(fullDataCacheKey, compressedData)
        
        if (cacheSaved) {
          safeSetItem(fullDataCacheTimestampKey, Date.now().toString())
          console.log('PO full data cache saved successfully')
        } else {
          console.warn('PO full data cache not saved due to size limitations')
        }
        
        const uniqueSiteIDs = new Set(data.map((row: any) => row['Site ID'] || row['Site ID PO']))
        
        const statusCounts = {
          cancelled: 0,
          closed: 0,
          longAging: 0,
          new: 0,
          open: 0
        }
        
        let totalAmount = 0
        let cancelledAmount = 0
        let invoiced = 0

        data.forEach((row: any) => {
          const amount = parseFloat(row['Amount']?.toString().replace(/,/g, '') || '0')
          const invoiceAmount = parseFloat(row['Invoice Amount']?.toString().replace(/,/g, '') || '0')
          
          // Find status column dynamically
          const keys = Object.keys(row)
          const statusKey = keys.find(key => 
            key.toLowerCase().includes('status') && 
            !key.toLowerCase().includes('site') &&
            !key.toLowerCase().includes('payment')
          )
          const status = (statusKey && row[statusKey] ? row[statusKey].toString() : '').toUpperCase().trim()
          
          totalAmount += amount
          invoiced += invoiceAmount
          
          // Count status (case-insensitive)
          if (status === 'CANCELLED' || status === 'CANCEL') {
            statusCounts.cancelled++
            cancelledAmount += amount
          } else if (status === 'CLOSED' || status === 'CLOSE') {
            statusCounts.closed++
          } else if (status === 'LONG AGING' || status === 'LONGAGING' || status.includes('LONG')) {
            statusCounts.longAging++
          } else if (status === 'NEW') {
            statusCounts.new++
          } else if (status === 'OPEN') {
            statusCounts.open++
          }
        })

        const poSummary = {
          totalSites: uniqueSiteIDs.size,
          statusCounts,
          totalAmount,
          cancelledAmount,
          invoiced
        }

        // Save summary to cache with safe storage
        const summaryCacheSaved = safeSetItem(cacheKey, JSON.stringify(poSummary))
        if (summaryCacheSaved) {
          safeSetItem(cacheTimestampKey, Date.now().toString())
          console.log('PO summary cache saved successfully')
        }

        setSummary(prev => ({
          ...prev,
          poHuawei: poSummary
        }))
      }
    } catch (error) {
      console.error('Error loading PO data:', error)
    } finally {
      setPoLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const dashboardCards = [
    {
      title: 'Daily Operations',
      description: 'Real-time task management and team performance',
      icon: Calendar,
      href: '/dashboard/daily',
      color: 'from-blue-500 to-indigo-600',
      stats: [
        { label: 'Total Tasks', value: summary.daily.totalTasks, icon: Activity },
        { label: 'Completed', value: summary.daily.completed, icon: CheckCircle2 },
        { label: 'In Progress', value: summary.daily.inProgress, icon: Clock },
        { label: 'Teams Working', value: summary.daily.teamsWorking, icon: Users }
      ]
    },
    {
      title: 'ITC Huawei Rollout',
      description: 'Project rollout progress and site tracking',
      icon: TrendingUp,
      href: '/dashboard/itc-huawei',
      color: 'from-emerald-500 to-green-600',
      stats: [
        { label: 'Total Sites', value: summary.itcHuawei.totalSites, icon: Activity },
        { label: 'Survey Done', value: summary.itcHuawei.surveyCompleted, icon: CheckCircle2 },
        { label: 'MOS Completed', value: summary.itcHuawei.mosCompleted, icon: BarChart3 },
        { label: 'ATP Approved', value: summary.itcHuawei.atpApproved, icon: CheckCircle2 }
      ]
    },
    {
      title: 'PO Management',
      description: 'Purchase order tracking and financial overview',
      icon: FileText,
      href: '/dashboard/po-huawei',
      color: 'from-purple-500 to-violet-600',
      loading: poLoading,
      stats: [
        { label: 'Unique Sites', value: summary.poHuawei.totalSites, icon: MapPin },
        { 
          label: 'Status Breakdown', 
          value: `${summary.poHuawei.statusCounts.open} Open`, 
          detail: `${summary.poHuawei.statusCounts.new} New | ${summary.poHuawei.statusCounts.closed} Closed | ${summary.poHuawei.statusCounts.longAging} Long Aging | ${summary.poHuawei.statusCounts.cancelled} Cancelled`,
          icon: Activity 
        },
        { 
          label: 'Total Amount', 
          value: formatCurrency(summary.poHuawei.totalAmount), 
          detail: `Cancelled: ${formatCurrency(summary.poHuawei.cancelledAmount)}`,
          icon: DollarSign 
        },
        { label: 'Invoiced', value: formatCurrency(summary.poHuawei.invoiced), icon: CheckCircle2 }
      ]
    }
  ]

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 overflow-y-auto p-3">
      {/* Loading State */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Loading dashboard data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Single Unified Container */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            {/* Header */}
            <div className="mb-4 pb-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    Dashboard Overview
                  </h1>
                  <p className="mt-1 text-xs text-slate-600">
                    Comprehensive view of all operations and projects
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-600 bg-gradient-to-br from-slate-50 to-slate-100 px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                    <span className="font-semibold">{new Date().toLocaleDateString('id-ID', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Modules Section */}
            <div className="mb-4 pb-4 border-b border-slate-200">
              <div className="mb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                    <Activity className="h-4 w-4 text-white" />
                  </div>
                  Dashboard Modules
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">Access your key operational dashboards</p>
              </div>

              {/* Dashboard Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {dashboardCards.map((card, index) => {
              const IconComponent = card.icon
              const isCardLoading = (card as any).loading
              
              return (
                <Link
                  key={index}
                  href={card.href}
                  className="group bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 overflow-hidden"
                >
                  {/* Card Header */}
                  <div className={`bg-gradient-to-r ${card.color} p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                        {isCardLoading ? (
                          <Loader2 className="h-5 w-5 text-white animate-spin" />
                        ) : (
                          <IconComponent className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-white/80 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <h2 className="text-base font-bold text-white mb-0.5">{card.title}</h2>
                    <p className="text-xs text-white/90">{card.description}</p>
                    {isCardLoading && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 text-white/80 animate-spin" />
                        <span className="text-xs text-white/80">Loading data...</span>
                      </div>
                    )}
                  </div>

                  {/* Card Stats */}
                  <div className="p-3">
                    {isCardLoading ? (
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-2 border border-slate-200 animate-pulse"
                          >
                            <div className="h-3 bg-slate-200 rounded w-3/4 mb-1"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {card.stats.map((stat, statIndex) => {
                          const StatIcon = stat.icon
                          return (
                            <div
                              key={statIndex}
                              className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-2 border border-slate-200"
                            >
                              <div className="flex items-center gap-1 mb-1">
                                <div className="p-1 bg-white rounded shadow-sm">
                                  <StatIcon className="h-3 w-3 text-slate-600" />
                                </div>
                                <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                                  {stat.label}
                                </span>
                              </div>
                              <div className="text-sm font-bold text-slate-900 break-words">
                                {stat.value}
                              </div>
                              {(stat as any).detail && (
                                <div className="mt-1 text-xs text-slate-500 border-t border-slate-200 pt-1">
                                  {(stat as any).detail}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="px-3 pb-3">
                    <div className="flex items-center justify-center gap-2 text-xs font-medium text-blue-600 group-hover:text-blue-700">
                      View Full Dashboard
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              )
            })}
              </div>
            </div>

            {/* Quick Stats Summary Section */}
            <div className="mb-4 pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg">
                  <Activity className="h-4 w-4 text-white" />
                </div>
                Today&apos;s Quick Summary
              </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                <div className="text-xs font-medium text-blue-700 mb-1">Daily Tasks</div>
                <div className="text-2xl font-bold text-blue-600">{summary.daily.totalTasks}</div>
                <div className="text-xs text-blue-600 mt-0.5">
                  {summary.daily.completed} completed
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg p-3 border border-emerald-200">
                <div className="text-xs font-medium text-emerald-700 mb-1">ITC Sites</div>
                <div className="text-2xl font-bold text-emerald-600">{summary.itcHuawei.totalSites}</div>
                <div className="text-xs text-emerald-600 mt-0.5">
                  {summary.itcHuawei.atpApproved} ATP approved
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-3 border border-purple-200">
                <div className="text-xs font-medium text-purple-700 mb-1">Unique Sites</div>
                {poLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
                    <span className="text-xs text-purple-600">Loading...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-purple-600">{summary.poHuawei.totalSites}</div>
                    <div className="text-xs text-purple-600 mt-0.5">
                      {summary.poHuawei.statusCounts.open} open POs
                    </div>
                  </>
                )}
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-3 border border-amber-200">
                <div className="text-xs font-medium text-amber-700 mb-1">Teams Active</div>
                <div className="text-2xl font-bold text-amber-600">{summary.daily.teamsWorking}</div>
                <div className="text-xs text-amber-600 mt-0.5">
                  Working today
                </div>
              </div>
            </div>
            </div>

            {/* Quick Actions Section */}
            <div>
              <div className="mb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <div className="p-1.5 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg">
                    <Activity className="h-4 w-4 text-white" />
                  </div>
                  Quick Actions
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">Fast access to frequently used features</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/daily-plan"
              className="group bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <Calendar className="h-6 w-6 text-blue-600 mb-1.5" />
              <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-600">
                Daily Plan
              </div>
              <div className="text-xs text-slate-500">Manage tasks</div>
            </Link>

            <Link
              href="/itc-huawei"
              className="group bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <TrendingUp className="h-6 w-6 text-emerald-600 mb-1.5" />
              <div className="text-xs font-semibold text-slate-900 group-hover:text-emerald-600">
                ITC Rollout
              </div>
              <div className="text-xs text-slate-500">Site tracking</div>
            </Link>

            <Link
              href="/reports"
              className="group bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all"
            >
              <BarChart3 className="h-6 w-6 text-purple-600 mb-1.5" />
              <div className="text-xs font-semibold text-slate-900 group-hover:text-purple-600">
                Reports
              </div>
              <div className="text-xs text-slate-500">View analytics</div>
            </Link>

            <Link
              href="/documents"
              className="group bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all"
            >
              <FileText className="h-6 w-6 text-amber-600 mb-1.5" />
              <div className="text-xs font-semibold text-slate-900 group-hover:text-amber-600">
                Documents
              </div>
              <div className="text-xs text-slate-500">File management</div>
            </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
