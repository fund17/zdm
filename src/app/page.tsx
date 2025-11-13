'use client'

import { useState, useEffect, useMemo } from 'react'
import { Calendar, Users, FileText, BarChart3, TrendingUp, Activity, Clock, CheckCircle2, AlertCircle, Target, Filter } from 'lucide-react'

interface DashboardStats {
  totalRecords: number
  lastUpdated: string
  todayTasks: number
  todayCompleted: number
  todayPending: number
  todayInProgress: number
  todayTeamsWorking: number
  idleTeams: string[]
  todaySites: string[]
  completedSites: string[]
  inProgressSites: string[]
  pendingSites: string[]
  todayActivityBreakdown: { activity: string; count: number; completed: number; pending: number; inProgress: number }[]
  todayStatusBreakdown: { status: string; count: number; percentage: number }[]
  todayTeamBreakdown: { team: string; count: number; completed: number; pending: number; activities: string[] }[]
  topTeams: { team: string; count: number; completionRate: number }[]
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRecords: 0,
    lastUpdated: 'Loading...',
    todayTasks: 0,
    todayCompleted: 0,
    todayPending: 0,
    todayInProgress: 0,
    todayTeamsWorking: 0,
    idleTeams: [],
    todaySites: [],
    completedSites: [],
    inProgressSites: [],
    pendingSites: [],
    todayActivityBreakdown: [],
    todayStatusBreakdown: [],
    todayTeamBreakdown: [],
    topTeams: []
  })
  const [loading, setLoading] = useState(true)
  const [selectedRegion, setSelectedRegion] = useState<string>('All')
  const [regions, setRegions] = useState<string[]>(['All'])
  const [flippedCard, setFlippedCard] = useState<number | null>(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Fetch data from Daily Plan API
        const response = await fetch('/api/sheets')
        
        if (!response.ok) {
          throw new Error('Failed to fetch data')
        }
        
        const result = await response.json()
        const data = result.data || []
        
        
        // Extract unique regions from data
        const uniqueRegions = Array.from(new Set(
          data
            .map((row: any) => row.Region || row.region)
            .filter((region: any) => region && region !== '')
        )) as string[]
        setRegions(['All', ...uniqueRegions.sort()])
        
        
        // Get today's date for filtering (multiple formats support)
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0] // YYYY-MM-DD format
        
        // Get month start date (for team performance)
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        const monthStartStr = monthStart.toISOString().split('T')[0]
        
        
        // Filter only today's tasks
        let todayData = data.filter((row: any) => {
          if (!row.Date) return false
          
          // Sample first few dates to see format
          const sampleIndex = data.indexOf(row)
          if (sampleIndex < 3) {
          }
          
          try {
            const rowDate = new Date(row.Date)
            const rowDateStr = rowDate.toISOString().split('T')[0]
            
            // Also check if date matches today's date string directly
            const dateMatch = rowDateStr === todayStr || row.Date === todayStr
            
            return dateMatch
          } catch (e) {
            return false
          }
        })
        
        
        // If no data for today, show sample of dates in dataset
        if (todayData.length === 0 && data.length > 0) {
          data.slice(0, 10).forEach((row: any, idx: number) => {
            if (row.Date) {
              const parsedDate = new Date(row.Date)
            }
          })
          
          // Find closest date to today for fallback
          const datesInData = data
            .filter((row: any) => row.Date)
            .map((row: any) => ({
              row,
              date: new Date(row.Date),
              dateStr: new Date(row.Date).toISOString().split('T')[0]
            }))
            .sort((a: any, b: any) => Math.abs(a.date.getTime() - today.getTime()) - Math.abs(b.date.getTime() - today.getTime()))
          
          if (datesInData.length > 0) {
            const closestDate = datesInData[0].dateStr
            
            // Use data from closest date
            const fallbackData = data.filter((row: any) => {
              if (!row.Date) return false
              const rowDateStr = new Date(row.Date).toISOString().split('T')[0]
              return rowDateStr === closestDate
            })
            
            
            // Replace todayData with fallbackData
            todayData.length = 0
            todayData.push(...fallbackData)
          }
        }
        
        // Continue with calculation even if using fallback data
        
        // Apply region filter if not "All"
        if (selectedRegion !== 'All') {
          todayData = todayData.filter((row: any) => {
            const rowRegion = row.Region || row.region || ''
            return rowRegion === selectedRegion
          })
        }
        
        // Filter this month's data for team performance (from day 1 to today)
        let monthData = data.filter((row: any) => {
          if (!row.Date) return false
          try {
            const rowDate = new Date(row.Date)
            const rowDateStr = rowDate.toISOString().split('T')[0]
            return rowDateStr >= monthStartStr && rowDateStr <= todayStr
          } catch (e) {
            return false
          }
        })
        
        // Apply region filter to month data
        if (selectedRegion !== 'All') {
          monthData = monthData.filter((row: any) => {
            const rowRegion = row.Region || row.region || ''
            return rowRegion === selectedRegion
          })
        }
        
        
        // Calculate today's statistics
        let todayCompleted = 0
        let todayPending = 0
        let todayInProgress = 0
        
        const activityCounts: Record<string, { count: number; completed: number; pending: number; inProgress: number }> = {}
        const statusCounts: Record<string, number> = {}
        const teamCountsMonth: Record<string, { count: number; completed: number; pending: number; activities: Set<string> }> = {}
        const todayTeamsWorking = new Set<string>() // Track teams working today
        const todaySitesSet = new Set<string>()
        const completedSitesSet = new Set<string>()
        const inProgressSitesSet = new Set<string>()
        const pendingSitesSet = new Set<string>()
        
        // Process today's data for activities and status
        todayData.forEach((row: any) => {
          const status = row.Status || 'No Status'
          const activity = row.Activity || 'No Activity'
          // Try multiple possible field names for team
          const team = row['Team Name'] || row['Team'] || row['team'] || row['team_name'] || row['TeamName'] || 'No Team'
          // Try multiple possible field names for site
          const site = row['Site ID'] || row['Site'] || row['site'] || row['site_id'] || row['SiteID'] || row['Site Name'] || 'No Site'
          
          // Debug: log first few rows to see team field
          const rowIndex = todayData.indexOf(row)
          
          // Track teams working today (exclude 'No Team')
          if (team && team !== 'No Team' && team.trim() !== '') {
            todayTeamsWorking.add(team)
          }
          
          // Track sites
          if (site && site !== 'No Site' && site.trim() !== '') {
            todaySitesSet.add(site)
          }
          
          // Count by status
          statusCounts[status] = (statusCounts[status] || 0) + 1
          
          // Determine task state
          const isDone = status.toLowerCase().includes('done') || status.toLowerCase().includes('complete')
          const isInProgress = status.toLowerCase().includes('progress') || status.toLowerCase().includes('ongoing')
          
          if (isDone) {
            todayCompleted++
            if (site && site !== 'No Site' && site.trim() !== '') {
              completedSitesSet.add(site)
            }
          } else if (isInProgress) {
            todayInProgress++
            if (site && site !== 'No Site' && site.trim() !== '') {
              inProgressSitesSet.add(site)
            }
          } else {
            todayPending++
            if (site && site !== 'No Site' && site.trim() !== '') {
              pendingSitesSet.add(site)
            }
          }
          
          // Count by activity with status breakdown
          if (!activityCounts[activity]) {
            activityCounts[activity] = { count: 0, completed: 0, pending: 0, inProgress: 0 }
          }
          activityCounts[activity].count++
          if (isDone) activityCounts[activity].completed++
          else if (isInProgress) activityCounts[activity].inProgress++
          else activityCounts[activity].pending++
        })
        
        // Process this month's data for team performance
        monthData.forEach((row: any) => {
          const status = row.Status || 'No Status'
          const activity = row.Activity || 'No Activity'
          // Try multiple possible field names for team
          const team = row['Team Name'] || row['Team'] || row['team'] || row['team_name'] || row['TeamName'] || 'No Team'
          
          const isDone = status.toLowerCase().includes('done') || status.toLowerCase().includes('complete')
          
          // Count by team (monthly) - exclude 'No Team'
          if (team && team !== 'No Team' && team.trim() !== '') {
            if (!teamCountsMonth[team]) {
              teamCountsMonth[team] = { count: 0, completed: 0, pending: 0, activities: new Set() }
            }
            teamCountsMonth[team].count++
            if (isDone) teamCountsMonth[team].completed++
            else teamCountsMonth[team].pending++
            teamCountsMonth[team].activities.add(activity)
          }
        })
        
        // Sort activity breakdown
        const todayActivityBreakdown = Object.entries(activityCounts)
          .map(([activity, data]) => ({
            activity,
            count: data.count,
            completed: data.completed,
            pending: data.pending,
            inProgress: data.inProgress
          }))
          .sort((a, b) => b.count - a.count)
        
        // Sort status breakdown
        const todayStatusBreakdown = Object.entries(statusCounts)
          .map(([status, count]) => ({
            status,
            count,
            percentage: (count / todayData.length) * 100
          }))
          .sort((a, b) => b.count - a.count)
        
        // Sort team breakdown (using monthly data)
        const todayTeamBreakdown = Object.entries(teamCountsMonth)
          .map(([team, data]: [string, any]) => ({
            team,
            count: data.count,
            completed: data.completed,
            pending: data.pending,
            activities: Array.from(data.activities) as string[]
          }))
          .sort((a, b) => b.count - a.count)
        
        // Top 3 teams by completion rate
        const topTeams = todayTeamBreakdown
          .map(team => ({
            team: team.team,
            count: team.count,
            completionRate: team.count > 0 ? (team.completed / team.count) * 100 : 0
          }))
          .sort((a, b) => b.completionRate - a.completionRate)
          .slice(0, 3)
        
        // Find idle teams (teams in month data but not working today)
        const allTeamsThisMonth = new Set(Object.keys(teamCountsMonth))
        const idleTeams = Array.from(allTeamsThisMonth).filter(team => !todayTeamsWorking.has(team))
        
        
        setStats({
          totalRecords: data.length,
          lastUpdated: new Date().toLocaleString(),
          todayTasks: todayData.length,
          todayCompleted,
          todayPending,
          todayInProgress,
          todayTeamsWorking: todayTeamsWorking.size,
          idleTeams: idleTeams.sort(),
          todaySites: Array.from(todaySitesSet).sort(),
          completedSites: Array.from(completedSitesSet).sort(),
          inProgressSites: Array.from(inProgressSitesSet).sort(),
          pendingSites: Array.from(pendingSitesSet).sort(),
          todayActivityBreakdown,
          todayStatusBreakdown,
          todayTeamBreakdown,
          topTeams
        })
        
      } catch (error) {
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
    
    // Auto refresh every 5 minutes (300000 ms)
    const refreshInterval = setInterval(() => {
      loadDashboardData()
    }, 300000)
    
    // Cleanup interval on unmount
    return () => clearInterval(refreshInterval)
  }, [selectedRegion]) // Re-run when region changes

  const dashboardCards = [
    {
      title: "Today’s Tasks",
      value: stats.todayTasks,
      icon: Calendar,
      color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      change: loading ? '...' : `${stats.todayTasks} tasks`,
      description: 'Scheduled for today',
      showDetail: true,
      siteList: stats.todaySites,
      flipTitle: '📍 Today’s Sites',
      flipColor: 'from-blue-50 to-indigo-50',
      flipBorder: 'border-blue-200'
    },
    {
      title: 'Teams Working',
      value: stats.todayTeamsWorking,
      icon: Users,
      color: 'bg-gradient-to-br from-purple-500 to-violet-600',
      change: loading ? '...' : `${stats.todayTeamsWorking} teams active`,
      description: 'Teams working today',
      showDetail: true,
      siteList: stats.idleTeams,
      flipTitle: '💤 Idle Teams',
      flipColor: 'from-rose-50 to-red-50',
      flipBorder: 'border-rose-200'
    },
    {
      title: 'Completed',
      value: stats.todayCompleted,
      icon: CheckCircle2,
      color: 'bg-gradient-to-br from-emerald-500 to-green-600',
      change: loading ? '...' : stats.todayTasks > 0 ? `${((stats.todayCompleted / stats.todayTasks) * 100).toFixed(1)}%` : '0%',
      description: 'Tasks completed today',
      showDetail: true,
      siteList: stats.completedSites,
      flipTitle: '✅ Completed Sites',
      flipColor: 'from-emerald-50 to-green-50',
      flipBorder: 'border-emerald-200'
    },
    {
      title: 'In Progress',
      value: stats.todayInProgress,
      icon: Clock,
      color: 'bg-gradient-to-br from-amber-500 to-orange-600',
      change: loading ? '...' : stats.todayTasks > 0 ? `${((stats.todayInProgress / stats.todayTasks) * 100).toFixed(1)}%` : '0%',
      description: 'Currently in progress',
      showDetail: true,
      siteList: stats.inProgressSites,
      flipTitle: '⏳ In Progress Sites',
      flipColor: 'from-amber-50 to-orange-50',
      flipBorder: 'border-amber-200'
    },
    {
      title: 'Pending',
      value: stats.todayPending,
      icon: AlertCircle,
      color: 'bg-gradient-to-br from-rose-500 to-red-600',
      change: loading ? '...' : stats.todayTasks > 0 ? `${((stats.todayPending / stats.todayTasks) * 100).toFixed(1)}%` : '0%',
      description: 'Tasks pending',
      showDetail: true,
      siteList: stats.pendingSites,
      flipTitle: '⚠️ Pending Sites',
      flipColor: 'from-rose-50 to-pink-50',
      flipBorder: 'border-rose-200'
    }
  ]

  const quickActions = [
    {
      title: 'View Daily Plans',
      description: 'Access and manage daily planning data',
      icon: Calendar,
      href: '/daily-plan',
      color: 'bg-blue-50 text-blue-600 border-blue-200'
    },
    {
      title: 'ITC Huawei Rollout',
      description: 'Track Huawei project rollout progress',
      icon: Activity,
      href: '/itc-huawei',
      color: 'bg-red-50 text-red-600 border-red-200'
    },
    {
      title: 'Huawei Dashboard',
      description: 'View project analytics and metrics',
      icon: BarChart3,
      href: '/dashboard/itc-huawei',
      color: 'bg-indigo-50 text-indigo-600 border-indigo-200'
    },
    {
      title: 'Generate Reports',
      description: 'Create and download reports',
      icon: FileText,
      href: '/reports',
      color: 'bg-purple-50 text-purple-600 border-purple-200'
    }
  ]

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header Section - Fixed */}
      <div className="flex-none">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 bg-white rounded-xl shadow-sm border border-slate-200/60 p-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                <Calendar className="h-4 w-4 text-white" />
              </div>
              Today&apos;s Dashboard
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Real-time overview of today&apos;s tasks and team performance
            </p>
          </div>
          
          <div className="mt-2 sm:mt-0 flex flex-col items-end gap-1">
            <div className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
              <span className="font-semibold">{new Date().toLocaleDateString('id-ID', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Last updated: {stats.lastUpdated}
            </div>
          </div>
        </div>

        {/* Region Filter */}
        <div className="mb-3 bg-white rounded-xl shadow-sm border border-slate-200/60 p-2.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-600" />
              <span className="text-xs font-semibold text-slate-700">Region:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {regions.map((region) => (
                <button
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all duration-200 ${
                    selectedRegion === region
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
          {dashboardCards.map((card, index) => {
            const IconComponent = card.icon
            const isFlipped = flippedCard === index
            const hasDetail = card.showDetail && card.siteList && card.siteList.length > 0 && !loading
            
            return (
              <div 
                key={index} 
                className="relative h-[120px]"
                style={{ perspective: '1000px' }}
              >
                <div 
                  className={`relative w-full h-full transition-transform duration-500 ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Front Card */}
                  <div 
                    className="absolute inset-0 bg-white overflow-hidden shadow-sm rounded-xl border border-slate-200/60 hover:shadow-md transition-all duration-300"
                    style={{ backfaceVisibility: 'hidden' }}
                    onClick={() => hasDetail && setFlippedCard(isFlipped ? null : index)}
                  >
                    <div className="p-3 h-full flex flex-col">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center shadow-sm`}>
                            <IconComponent className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="ml-3 w-0 flex-1">
                          <dl>
                            <dt className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide truncate">{card.title}</dt>
                            <dd className="flex items-baseline mt-0.5">
                              <div className="text-xl font-black text-slate-900">
                                {loading ? '...' : card.value}
                              </div>
                            </dd>
                            <dd className="text-[10px] text-slate-500 mt-0.5">{card.change}</dd>
                          </dl>
                        </div>
                      </div>
                      {/* Hint for flip */}
                      {hasDetail && (
                        <div className="mt-auto pt-2 border-t border-slate-200">
                          <button 
                            className="w-full text-[9px] font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFlippedCard(isFlipped ? null : index)
                            }}
                          >
                            � {card.siteList.length} {card.title === 'Teams Working' ? 'Idle Team' : 'Site'}{card.siteList.length > 1 ? 's' : ''} 
                            <span className="text-[8px]">→ Click to view</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Back Card (Site/Team List) */}
                  <div 
                    className={`absolute inset-0 bg-gradient-to-br ${card.flipColor} overflow-hidden shadow-sm rounded-xl border ${card.flipBorder} hover:shadow-md transition-all duration-300`}
                    style={{ 
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)'
                    }}
                    onClick={() => setFlippedCard(null)}
                  >
                    <div className="p-3 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[11px] font-bold text-slate-700">{card.flipTitle}</h4>
                        <button 
                          className="text-[10px] text-slate-500 hover:text-slate-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFlippedCard(null)
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        <div className="flex flex-wrap gap-1">
                          {hasDetail && card.siteList.map((item: string, idx: number) => (
                            <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded bg-white text-[8px] font-medium text-slate-700 border border-slate-300">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Today's Activities & Team Performance in 1 Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          {/* Today's Activities - Compact */}
          <div className="bg-white shadow-sm rounded-xl border border-slate-200/60">
            <div className="px-4 py-2.5 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <div className="p-1 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                  <Activity className="h-3.5 w-3.5 text-white" />
                </div>
                Today&apos;s Activities
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Activity breakdown with completion status
              </p>
            </div>
            <div className="p-4 max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-sm text-slate-500">Loading data...</p>
                </div>
              ) : stats.todayActivityBreakdown.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No activities scheduled for today
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {stats.todayActivityBreakdown.slice(0, 10).map((item, index) => {
                    const completionRate = item.count > 0 ? (item.completed / item.count) * 100 : 0
                    return (
                      <div key={index} className="rounded-lg p-2 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200/60">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-xs font-bold text-slate-700 truncate">{item.activity}</span>
                            {/* Dot indicators inline with title */}
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <div className="flex items-center gap-0.5 bg-emerald-50 rounded px-1 py-0.5">
                                <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                                <span className="text-[10px] font-semibold text-emerald-700">{item.completed}</span>
                              </div>
                              <div className="flex items-center gap-0.5 bg-amber-50 rounded px-1 py-0.5">
                                <div className="w-1 h-1 bg-amber-500 rounded-full"></div>
                                <span className="text-[10px] font-semibold text-amber-700">{item.inProgress}</span>
                              </div>
                              <div className="flex items-center gap-0.5 bg-rose-50 rounded px-1 py-0.5">
                                <div className="w-1 h-1 bg-rose-500 rounded-full"></div>
                                <span className="text-[10px] font-semibold text-rose-700">{item.pending}</span>
                              </div>
                            </div>
                          </div>
                          <span className="text-base font-black text-slate-900 ml-2">{item.count}</span>
                        </div>
                        
                        {/* Compact progress bar */}
                        <div className="w-full bg-slate-200 rounded-full h-1">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-green-600 h-1 rounded-full transition-all duration-500"
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          {completionRate.toFixed(0)}% complete
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Team Performance Analysis - Compact */}
          <div className="bg-white shadow-sm rounded-xl border border-slate-200/60">
            <div className="px-4 py-2.5 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <div className="p-1 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg">
                  <Users className="h-3.5 w-3.5 text-white" />
                </div>
                Team Performance (This Month)
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="p-4 max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-sm text-slate-500">Loading data...</p>
                </div>
              ) : stats.todayTeamBreakdown.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No team data this month
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {stats.todayTeamBreakdown.slice(0, 10).map((team, index) => {
                    const completionRate = team.count > 0 ? (team.completed / team.count) * 100 : 0
                    return (
                      <div key={index} className="rounded-lg p-2 bg-gradient-to-br from-slate-50 to-emerald-50 border border-slate-200/60 hover:shadow-sm transition-all">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-slate-800 truncate">{team.team}</h4>
                              <p className="text-[10px] text-slate-500">{team.activities.length} activities</p>
                            </div>
                            {/* Dot indicators inline with title */}
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <div className="flex items-center gap-0.5 bg-emerald-50 rounded px-1 py-0.5">
                                <div className="w-1 h-1 bg-emerald-500 rounded-full"></div>
                                <span className="text-[10px] font-semibold text-emerald-700">{team.completed}</span>
                              </div>
                              <div className="flex items-center gap-0.5 bg-rose-50 rounded px-1 py-0.5">
                                <div className="w-1 h-1 bg-rose-500 rounded-full"></div>
                                <span className="text-[10px] font-semibold text-rose-700">{team.pending}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-2">
                            <div className="text-base font-black text-slate-900">{team.count}</div>
                          </div>
                        </div>
                        
                        {/* Compact progress bar */}
                        <div className="w-full bg-slate-200 rounded-full h-1">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-green-600 h-1 rounded-full transition-all duration-500"
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          {completionRate.toFixed(0)}% complete
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions - Full Width */}
        <div className="bg-white shadow-sm rounded-xl border border-slate-200/60">
          <div className="px-4 py-2.5 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-800">Quick Actions</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Access key features
            </p>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {quickActions.map((action, index) => {
                const IconComponent = action.icon
                return (
                  <a
                    key={index}
                    href={action.href}
                    className={`p-2.5 border rounded-lg hover:shadow-md transition-all duration-200 ${action.color}`}
                  >
                    <div className="flex items-center">
                      <IconComponent className="h-4 w-4 mr-1.5" />
                      <div>
                        <h4 className="font-semibold text-xs">{action.title}</h4>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}