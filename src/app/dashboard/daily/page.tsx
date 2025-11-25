'use client'

import { useState, useEffect, useMemo } from 'react'
import { Calendar, Users, Activity, Clock, CheckCircle2, AlertCircle, Filter, Maximize2, X, XCircle } from 'lucide-react'

interface DashboardStats {
  totalRecords: number
  lastUpdated: string
  todayTasks: number
  todayCompleted: number
  todayPending: number
  todayInProgress: number
  todayFailed: number
  todayTeamsWorking: number
  workingTeams: string[]
  idleTeams: string[]
  todaySites: string[]
  completedSites: string[]
  inProgressSites: string[]
  pendingSites: string[]
  failedSites: string[]
  todayActivityBreakdown: { activity: string; count: number; completed: number; pending: number; inProgress: number; completedTeams: string[]; inProgressTeams: string[]; pendingTeams: string[]; completedSites: string[]; inProgressSites: string[]; pendingSites: string[] }[]
  todayStatusBreakdown: { status: string; count: number; percentage: number }[]
  todayTeamBreakdown: { team: string; count: number; completed: number; pending: number; activities: string[]; sites: string[]; activitySites: Record<string, string[]> }[]
  topTeams: { team: string; count: number; completionRate: number }[]
}

// Activity color palette - soft backgrounds with strong text
const ACTIVITY_COLORS = [
  { bg: 'from-blue-50 to-cyan-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800', hover: 'hover:border-blue-300 hover:shadow-blue-200' },
  { bg: 'from-purple-50 to-pink-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800', hover: 'hover:border-purple-300 hover:shadow-purple-200' },
  { bg: 'from-emerald-50 to-green-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', hover: 'hover:border-emerald-300 hover:shadow-emerald-200' },
  { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', hover: 'hover:border-amber-300 hover:shadow-amber-200' },
  { bg: 'from-rose-50 to-red-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-800', hover: 'hover:border-rose-300 hover:shadow-rose-200' },
  { bg: 'from-teal-50 to-cyan-50', border: 'border-teal-200', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-800', hover: 'hover:border-teal-300 hover:shadow-teal-200' },
  { bg: 'from-indigo-50 to-blue-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-800', hover: 'hover:border-indigo-300 hover:shadow-indigo-200' },
  { bg: 'from-fuchsia-50 to-pink-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700', badge: 'bg-fuchsia-100 text-fuchsia-800', hover: 'hover:border-fuchsia-300 hover:shadow-fuchsia-200' },
]

const getActivityColor = (activityName: string, index: number) => {
  const hash = activityName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return ACTIVITY_COLORS[(hash + index) % ACTIVITY_COLORS.length]
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRecords: 0,
    lastUpdated: 'Loading...',
    todayTasks: 0,
    todayCompleted: 0,
    todayPending: 0,
    todayInProgress: 0,
    todayFailed: 0,
    todayTeamsWorking: 0,
    workingTeams: [],
    idleTeams: [],
    todaySites: [],
    completedSites: [],
    inProgressSites: [],
    pendingSites: [],
    failedSites: [],
    todayActivityBreakdown: [],
    todayStatusBreakdown: [],
    todayTeamBreakdown: [],
    topTeams: []
  })
  const [loading, setLoading] = useState(true)
  const [selectedRegion, setSelectedRegion] = useState<string>('All')
  const [selectedVendor, setSelectedVendor] = useState<string>('All')
  const [selectedTeamCategory, setSelectedTeamCategory] = useState<string>('All')
  const [selectedDateCategory, setSelectedDateCategory] = useState<string>('Today')
  const [regions, setRegions] = useState<string[]>(['All'])
  const [vendors, setVendors] = useState<string[]>(['All'])
  const [teamCategories, setTeamCategories] = useState<string[]>(['All'])
  const [flippedTeamCards, setFlippedTeamCards] = useState<{[key: number]: boolean}>({})
  const [flippedActivityCards, setFlippedActivityCards] = useState<{[key: number]: boolean}>({})
  const [zoomedActivityCard, setZoomedActivityCard] = useState<number | null>(null)
  const [zoomedTeamCard, setZoomedTeamCard] = useState<number | null>(null)
  const [zoomedStatsCard, setZoomedStatsCard] = useState<number | null>(null)

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

        // Extract unique vendors from data
        const uniqueVendors = Array.from(new Set(
          data
            .map((row: any) => row.Vendor || row.vendor)
            .filter((vendor: any) => vendor && vendor !== '')
        )) as string[]
        setVendors(['All', ...uniqueVendors.sort()])

        // Extract unique team categories from data
        const uniqueTeamCategories = Array.from(new Set(
          data
            .map((row: any) => row['Team Category'] || row.teamCategory || row.team_category)
            .filter((category: any) => category && category !== '')
        )) as string[]
        setTeamCategories(['All', ...uniqueTeamCategories.sort()])


        // Get date ranges based on selected category
        const today = new Date()
        today.setHours(0, 0, 0, 0) // Reset to start of day
        const todayStr = today.toISOString().split('T')[0]
        
        let startDateStr = todayStr
        let endDateStr = todayStr
        
        switch (selectedDateCategory) {
          case 'All':
            // No date filter - include all data
            startDateStr = '1900-01-01'
            endDateStr = '2100-12-31'
            break
          case 'Today':
            startDateStr = todayStr
            endDateStr = todayStr
            break
          case 'Yesterday':
            const yesterday = new Date(today)
            yesterday.setDate(yesterday.getDate() - 1)
            startDateStr = yesterday.toISOString().split('T')[0]
            endDateStr = startDateStr
            break
          case 'Tomorrow':
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)
            startDateStr = tomorrow.toISOString().split('T')[0]
            endDateStr = startDateStr
            break
          case 'This Week':
            // Get start of week (Monday)
            const startOfWeek = new Date(today)
            const day = startOfWeek.getDay()
            const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
            startOfWeek.setDate(diff)
            startDateStr = startOfWeek.toISOString().split('T')[0]
            
            // Get end of week (Sunday)
            const endOfWeek = new Date(startOfWeek)
            endOfWeek.setDate(endOfWeek.getDate() + 6)
            endDateStr = endOfWeek.toISOString().split('T')[0]
            break
          case 'This Month':
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
            startDateStr = startOfMonth.toISOString().split('T')[0]

            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
            endDateStr = endOfMonth.toISOString().split('T')[0]
            break
          case 'This Year':
            const startOfYear = new Date(today.getFullYear(), 0, 1)
            startDateStr = startOfYear.toISOString().split('T')[0]

            const endOfYear = new Date(today.getFullYear(), 11, 31)
            endDateStr = endOfYear.toISOString().split('T')[0]
            break
        }
        
        // Get month start date (for team performance)
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        const monthStartStr = monthStart.toISOString().split('T')[0]
        
        
        // Helper function to parse Google Sheets dates (same as DailyPlanTable)
        const parseSheetDate = (dateStr: string): Date | null => {
          if (!dateStr) return null
          
          try {
            // Handle Google Sheets serial number dates (numeric)
            const numericValue = Number(dateStr)
            if (!isNaN(numericValue) && numericValue > 0) {
              // Google Sheets date serial number (days since Dec 30, 1899)
              const baseDate = new Date(Date.UTC(1899, 11, 30))
              const date = new Date(baseDate.getTime() + numericValue * 24 * 60 * 60 * 1000)
              if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
                // Return as local date (without timezone conversion)
                return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
              }
            }
            
            // Handle format like "04-Jan-2024" or "24-Nov-2025"
            const parts = dateStr.split('-')
            if (parts.length === 3) {
              const day = parseInt(parts[0])
              const monthMap: { [key: string]: number } = {
                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
              }
              const monthStr = parts[1].toLowerCase().substring(0, 3)
              const month = monthMap[monthStr]
              const year = parseInt(parts[2])
              
              if (!isNaN(day) && month !== undefined && !isNaN(year)) {
                // Create date in local timezone (no UTC conversion)
                return new Date(year, month, day)
              }
            }
            
            // Fallback to standard date parsing with UTC awareness
            const date = new Date(dateStr)
            if (!isNaN(date.getTime())) {
              // If parsed as ISO string (includes time), convert to local date only
              if (dateStr.includes('T') || dateStr.includes('Z')) {
                return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
              }
              return date
            }
            
            return null
          } catch {
            return null
          }
        }
        
        // Filter data based on selected date range
        let todayData = data.filter((row: any) => {
          if (!row.Date) return false
          
          try {
            const rowDate = parseSheetDate(String(row.Date))
            if (!rowDate) return false
            const rowDateStr = rowDate.toISOString().split('T')[0]
            
            // Check if date is within the selected range
            return rowDateStr >= startDateStr && rowDateStr <= endDateStr
          } catch (e) {
            return false
          }
        })
        
        // Apply region filter if not "All"
        if (selectedRegion !== 'All') {
          todayData = todayData.filter((row: any) => {
            const rowRegion = row.Region || row.region || ''
            return rowRegion === selectedRegion
          })
        }

        // Apply vendor filter if not "All"
        if (selectedVendor !== 'All') {
          todayData = todayData.filter((row: any) => {
            const rowVendor = row.Vendor || row.vendor || ''
            return rowVendor === selectedVendor
          })
        }

        // Apply team category filter if not "All"
        if (selectedTeamCategory !== 'All') {
          todayData = todayData.filter((row: any) => {
            const rowTeamCategory = row['Team Category'] || row.teamCategory || row.team_category || ''
            return rowTeamCategory === selectedTeamCategory
          })
        }
        
        // Filter this month's data for team performance (from day 1 to today)
        let monthData = data.filter((row: any) => {
          if (!row.Date) return false
          try {
            const rowDate = parseSheetDate(String(row.Date))
            if (!rowDate) return false
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

        // Apply vendor filter to month data
        if (selectedVendor !== 'All') {
          monthData = monthData.filter((row: any) => {
            const rowVendor = row.Vendor || row.vendor || ''
            return rowVendor === selectedVendor
          })
        }

        // Apply team category filter to month data
        if (selectedTeamCategory !== 'All') {
          monthData = monthData.filter((row: any) => {
            const rowTeamCategory = row['Team Category'] || row.teamCategory || row.team_category || ''
            return rowTeamCategory === selectedTeamCategory
          })
        }
        
        
        // Calculate today's statistics
        let todayCompleted = 0
        let todayPending = 0
        let todayInProgress = 0
        let todayFailed = 0
        
        const activityCounts: Record<string, { count: number; completed: number; pending: number; inProgress: number; completedTeams: Set<string>; inProgressTeams: Set<string>; pendingTeams: Set<string>; completedSites: Set<string>; inProgressSites: Set<string>; pendingSites: Set<string> }> = {}
        const statusCounts: Record<string, number> = {}
        const teamCountsMonth: Record<string, { count: number; completed: number; pending: number; activities: Set<string>; sites: Set<string>; activitySites: Record<string, Set<string>> }> = {}
        const todayTeamsWorking = new Set<string>() // Track teams working today
        const todaySitesSet = new Set<string>()
        const completedSitesSet = new Set<string>()
        const inProgressSitesSet = new Set<string>()
        const pendingSitesSet = new Set<string>()
        const failedSitesSet = new Set<string>()
        
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
          
          // Determine task state based on dashboard status mapping
          // On Plan > Pending, On Going > In Progress, Carry Over > Completed, Done > Completed, Failed > Failed, Idle > idle teams, Off > idle teams
          const normalizedStatus = status.toLowerCase().trim()
          const isDone = normalizedStatus === 'carry over' || normalizedStatus === 'done'
          const isInProgress = normalizedStatus === 'on going'
          const isFailed = normalizedStatus === 'failed'
          const isIdle = normalizedStatus === 'idle' || normalizedStatus === 'off'

          // Track teams working today (exclude 'No Team' and idle teams)
          if (team && team !== 'No Team' && team.trim() !== '' && !isIdle) {
            todayTeamsWorking.add(team)
          }
          
          // Track sites
          if (site && site !== 'No Site' && site.trim() !== '') {
            todaySitesSet.add(site)
          }
          
          // Count by status
          statusCounts[status] = (statusCounts[status] || 0) + 1
          
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
          } else if (isFailed) {
            todayFailed++
            if (site && site !== 'No Site' && site.trim() !== '') {
              failedSitesSet.add(site)
            }
          } else {
            todayPending++
            if (site && site !== 'No Site' && site.trim() !== '') {
              pendingSitesSet.add(site)
            }
          }
          
          // Count by activity with status breakdown
          if (!activityCounts[activity]) {
            activityCounts[activity] = {
              count: 0,
              completed: 0,
              pending: 0,
              inProgress: 0,
              completedTeams: new Set(),
              inProgressTeams: new Set(),
              pendingTeams: new Set(),
              completedSites: new Set(),
              inProgressSites: new Set(),
              pendingSites: new Set()
            }
          }
          activityCounts[activity].count++
          if (isDone) {
            activityCounts[activity].completed++
            if (team && team !== 'No Team' && team.trim() !== '') {
              activityCounts[activity].completedTeams.add(team)
            }
            if (site && site !== 'No Site' && site.trim() !== '') {
              activityCounts[activity].completedSites.add(site)
            }
          } else if (isInProgress) {
            activityCounts[activity].inProgress++
            if (team && team !== 'No Team' && team.trim() !== '') {
              activityCounts[activity].inProgressTeams.add(team)
            }
            if (site && site !== 'No Site' && site.trim() !== '') {
              activityCounts[activity].inProgressSites.add(site)
            }
          } else {
            activityCounts[activity].pending++
            if (team && team !== 'No Team' && team.trim() !== '') {
              activityCounts[activity].pendingTeams.add(team)
            }
            if (site && site !== 'No Site' && site.trim() !== '') {
              activityCounts[activity].pendingSites.add(site)
            }
          }
        })
        
        // Process selected date range data for team performance
        todayData.forEach((row: any) => {
          const status = row.Status || 'No Status'
          const activity = row.Activity || 'No Activity'
          // Try multiple possible field names for team
          const team = row['Team Name'] || row['Team'] || row['team'] || row['team_name'] || row['TeamName'] || 'No Team'

          // Use same status mapping for monthly data
          const normalizedStatus = status.toLowerCase().trim()
          const isDone = normalizedStatus === 'carry over' || normalizedStatus === 'done'
          
          // Count by team (monthly) - exclude 'No Team'
          if (team && team !== 'No Team' && team.trim() !== '') {
            if (!teamCountsMonth[team]) {
              teamCountsMonth[team] = { count: 0, completed: 0, pending: 0, activities: new Set(), sites: new Set(), activitySites: {} }
            }
            teamCountsMonth[team].count++
            if (isDone) teamCountsMonth[team].completed++
            else teamCountsMonth[team].pending++
            teamCountsMonth[team].activities.add(activity)
            // Try multiple possible field names for site
            const site = row['Site ID'] || row['Site'] || row['site'] || row['site_id'] || row['SiteID'] || row['Site Name'] || 'No Site'
            if (site && site !== 'No Site' && site.trim() !== '') {
              teamCountsMonth[team].sites.add(site)
              // Group sites by activity
              if (!teamCountsMonth[team].activitySites[activity]) {
                teamCountsMonth[team].activitySites[activity] = new Set()
              }
              teamCountsMonth[team].activitySites[activity].add(site)
            }
          }
        })
        
        // Sort activity breakdown
        const todayActivityBreakdown = Object.entries(activityCounts)
          .map(([activity, data]) => ({
            activity,
            count: data.count,
            completed: data.completed,
            pending: data.pending,
            inProgress: data.inProgress,
            completedTeams: Array.from(data.completedTeams),
            inProgressTeams: Array.from(data.inProgressTeams),
            pendingTeams: Array.from(data.pendingTeams),
            completedSites: Array.from(data.completedSites),
            inProgressSites: Array.from(data.inProgressSites),
            pendingSites: Array.from(data.pendingSites)
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
            activities: Array.from(data.activities) as string[],
            sites: Array.from(data.sites) as string[],
            activitySites: Object.fromEntries(
              Object.entries(data.activitySites).map(([activity, sitesSet]: [string, any]) => [
                activity,
                Array.from(sitesSet) as string[]
              ])
            )
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
        
        // Find idle teams (teams in selected period data but not working in the period)
        const allTeamsInPeriod = new Set(Object.keys(teamCountsMonth))
        const idleTeams = Array.from(allTeamsInPeriod).filter(team => !todayTeamsWorking.has(team))
        
        
        setStats({
          totalRecords: data.length,
          lastUpdated: new Date().toLocaleString(),
          todayTasks: todayData.length,
          todayCompleted,
          todayPending,
          todayInProgress,
          todayFailed,
          todayTeamsWorking: todayTeamsWorking.size,
          workingTeams: Array.from(todayTeamsWorking).sort(),
          idleTeams: idleTeams.sort(),
          todaySites: Array.from(todaySitesSet).sort(),
          completedSites: Array.from(completedSitesSet).sort(),
          inProgressSites: Array.from(inProgressSitesSet).sort(),
          pendingSites: Array.from(pendingSitesSet).sort(),
          failedSites: Array.from(failedSitesSet).sort(),
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
  }, [selectedRegion, selectedVendor, selectedTeamCategory, selectedDateCategory]) // Re-run when filters change

  const dashboardCards = [
    {
      title: "Total Tasks",
      value: stats.todayTasks,
      icon: Calendar,
      color: 'bg-gradient-to-br from-blue-50 to-cyan-50',
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      change: loading ? '...' : `${stats.todayTasks} tasks`,
      description: selectedDateCategory === 'Today' ? 'Scheduled for today' : selectedDateCategory === 'Yesterday' ? 'Scheduled for yesterday' : selectedDateCategory === 'Tomorrow' ? 'Scheduled for tomorrow' : selectedDateCategory === 'All' ? 'All scheduled tasks' : selectedDateCategory === 'This Year' ? 'Scheduled for this year' : `Scheduled for ${selectedDateCategory.toLowerCase()}`,
      showDetail: true,
      siteList: stats.todaySites,
      flipTitle: selectedDateCategory === 'Today' ? '📍 Today\'s Sites' : selectedDateCategory === 'Yesterday' ? '📍 Yesterday\'s Sites' : selectedDateCategory === 'Tomorrow' ? '📍 Tomorrow\'s Sites' : selectedDateCategory === 'All' ? '📍 All Sites' : selectedDateCategory === 'This Year' ? '📍 This Year\'s Sites' : `📍 ${selectedDateCategory} Sites`,
      flipColor: 'from-blue-50 to-cyan-50',
      flipBorder: 'border-blue-200',
      textColor: 'text-blue-700'
    },
    {
      title: 'Teams Working',
      value: stats.todayTeamsWorking,
      icon: Users,
      color: 'bg-gradient-to-br from-purple-50 to-pink-50',
      iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
      change: loading ? '...' : `${stats.todayTeamsWorking} teams active`,
      description: selectedDateCategory === 'Today' ? 'Teams working today' : selectedDateCategory === 'Yesterday' ? 'Teams working yesterday' : selectedDateCategory === 'Tomorrow' ? 'Teams working tomorrow' : selectedDateCategory === 'All' ? 'All teams' : selectedDateCategory === 'This Year' ? 'Teams working this year' : `Teams working in ${selectedDateCategory.toLowerCase()}`,
      showDetail: true,
      siteList: stats.workingTeams,
      flipTitle: '👥 Working Teams',
      flipColor: 'from-purple-50 to-pink-50',
      flipBorder: 'border-purple-200',
      textColor: 'text-purple-700',
      idleList: stats.idleTeams
    },
    {
      title: 'Completed',
      value: stats.todayCompleted,
      icon: CheckCircle2,
      color: 'bg-gradient-to-br from-emerald-50 to-green-50',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      change: loading ? '...' : stats.todayTasks > 0 ? `${((stats.todayCompleted / stats.todayTasks) * 100).toFixed(1)}%` : '0%',
      description: selectedDateCategory === 'Today' ? 'Tasks completed today' : selectedDateCategory === 'Yesterday' ? 'Tasks completed yesterday' : selectedDateCategory === 'Tomorrow' ? 'Tasks completed tomorrow' : selectedDateCategory === 'All' ? 'All completed tasks' : selectedDateCategory === 'This Year' ? 'Tasks completed this year' : 'Tasks completed',
      showDetail: true,
      siteList: stats.completedSites,
      flipTitle: '✅ Completed Sites',
      flipColor: 'from-emerald-50 to-green-50',
      flipBorder: 'border-emerald-200',
      textColor: 'text-emerald-700'
    },
    {
      title: 'In Progress',
      value: stats.todayInProgress,
      icon: Clock,
      color: 'bg-gradient-to-br from-amber-50 to-orange-50',
      iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
      change: loading ? '...' : stats.todayTasks > 0 ? `${((stats.todayInProgress / stats.todayTasks) * 100).toFixed(1)}%` : '0%',
      description: selectedDateCategory === 'Today' ? 'Tasks in progress today' : selectedDateCategory === 'Yesterday' ? 'Tasks in progress yesterday' : selectedDateCategory === 'Tomorrow' ? 'Tasks in progress tomorrow' : selectedDateCategory === 'All' ? 'All tasks in progress' : selectedDateCategory === 'This Year' ? 'Tasks in progress this year' : 'Tasks in progress',
      showDetail: true,
      siteList: stats.inProgressSites,
      flipTitle: '⏳ In Progress Sites',
      flipColor: 'from-amber-50 to-orange-50',
      flipBorder: 'border-amber-200',
      textColor: 'text-amber-700'
    },
    {
      title: 'Pending',
      value: stats.todayPending,
      icon: AlertCircle,
      color: 'bg-gradient-to-br from-red-50 to-red-100',
      iconBg: 'bg-gradient-to-br from-red-600 to-red-700',
      change: loading ? '...' : stats.todayTasks > 0 ? `${((stats.todayPending / stats.todayTasks) * 100).toFixed(1)}%` : '0%',
      description: selectedDateCategory === 'Today' ? 'Tasks pending today' : selectedDateCategory === 'Yesterday' ? 'Tasks pending yesterday' : selectedDateCategory === 'Tomorrow' ? 'Tasks pending tomorrow' : selectedDateCategory === 'All' ? 'All pending tasks' : selectedDateCategory === 'This Year' ? 'Tasks pending this year' : 'Tasks pending',
      showDetail: true,
      siteList: stats.pendingSites,
      flipTitle: '⚠️ Pending Sites',
      flipColor: 'from-red-50 to-red-100',
      flipBorder: 'border-red-300',
      textColor: 'text-red-700'
    },
    {
      title: 'Failed',
      value: stats.todayFailed,
      icon: XCircle,
      color: 'bg-gradient-to-br from-slate-100 to-gray-100',
      iconBg: 'bg-gradient-to-br from-slate-600 to-slate-800',
      change: loading ? '...' : stats.todayTasks > 0 ? `${((stats.todayFailed / stats.todayTasks) * 100).toFixed(1)}%` : '0%',
      description: selectedDateCategory === 'Today' ? 'Tasks failed today' : selectedDateCategory === 'Yesterday' ? 'Tasks failed yesterday' : selectedDateCategory === 'Tomorrow' ? 'Tasks failed tomorrow' : selectedDateCategory === 'All' ? 'All failed tasks' : selectedDateCategory === 'This Year' ? 'Tasks failed this year' : 'Tasks failed',
      showDetail: true,
      siteList: stats.failedSites,
      flipTitle: '❌ Failed Sites',
      flipColor: 'from-slate-100 to-gray-100',
      flipBorder: 'border-slate-400',
      textColor: 'text-slate-800'
    },
  ]

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 px-4 pt-4 pb-2">
      {/* Main Container */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 flex flex-col h-full overflow-hidden">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Header Section */}
          <div className="flex-none bg-white border-b border-slate-200/60">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                <Calendar className="h-4 w-4 text-white" />
              </div>
              Daily Dashboard
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Real-time overview of tasks and team performance
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
          </div>

          {/* Filters - Sticky */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200/60 shadow-sm">
            <div className="p-3">
              <div className="bg-gradient-to-br from-white via-blue-50/30 to-white rounded-xl shadow-sm border-2 border-slate-100 hover:border-blue-200 transition-all">
            <div className="px-3 py-2 border-b-2 border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                  <Filter className="h-3.5 w-3.5 text-white" />
                </div>
                <h3 className="text-xs font-semibold text-blue-700">Filters</h3>
              </div>
            </div>
            <div className="p-2">
              <div className="space-y-1.5">
                {/* Region Filter */}
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      <div className="w-0.5 h-3.5 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                      <span className="text-xs font-medium text-slate-700">Region</span>
                    </div>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <div className="flex flex-wrap gap-1.5">
                      {regions.map((region) => (
                        <button
                          key={region}
                          onClick={() => setSelectedRegion(region)}
                          className={`px-3 py-1 text-[11px] font-medium rounded-lg transition-all duration-200 ${
                            selectedRegion === region
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md scale-105'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {region}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Vendor Filter */}
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      <div className="w-0.5 h-3.5 bg-gradient-to-b from-purple-500 to-violet-600 rounded-full"></div>
                      <span className="text-xs font-medium text-slate-700">Vendor</span>
                    </div>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <div className="flex flex-wrap gap-1.5">
                      {vendors.map((vendor) => (
                        <button
                          key={vendor}
                          onClick={() => setSelectedVendor(vendor)}
                          className={`px-3 py-1 text-[11px] font-medium rounded-lg transition-all duration-200 ${
                            selectedVendor === vendor
                              ? 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-md scale-105'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {vendor}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Team Category Filter */}
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      <div className="w-0.5 h-3.5 bg-gradient-to-b from-emerald-500 to-green-600 rounded-full"></div>
                      <span className="text-xs font-medium text-slate-700">Team Category</span>
                    </div>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <div className="flex flex-wrap gap-1.5">
                      {teamCategories.map((category) => (
                        <button
                          key={category}
                          onClick={() => setSelectedTeamCategory(category)}
                          className={`px-3 py-1 text-[11px] font-medium rounded-lg transition-all duration-200 ${
                            selectedTeamCategory === category
                              ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md scale-105'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Date Category Filter */}
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      <div className="w-0.5 h-3.5 bg-gradient-to-b from-orange-500 to-red-600 rounded-full"></div>
                      <span className="text-xs font-medium text-slate-700">Date Range</span>
                    </div>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <div className="flex flex-wrap gap-1.5">
                      {['All', 'Today', 'Yesterday', 'Tomorrow', 'This Week', 'This Month', 'This Year'].map((category) => (
                        <button
                          key={category}
                          onClick={() => setSelectedDateCategory(category)}
                          className={`px-3 py-1 text-[11px] font-medium rounded-lg transition-all duration-200 ${
                            selectedDateCategory === category
                              ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md scale-105'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 px-3 pb-3">
          {dashboardCards.map((card, index) => {
            const IconComponent = card.icon
            const hasDetail = card.showDetail && card.siteList && card.siteList.length > 0 && !loading
            
            return (
              <div 
                key={index} 
                className={`${(card as any).color} overflow-hidden shadow-sm rounded-xl border-2 ${(card as any).flipBorder} hover:shadow-md transition-all duration-300 cursor-pointer`}
                onClick={() => hasDetail && setZoomedStatsCard(index)}
              >
                <div className="p-4 h-[120px] flex flex-col">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 ${(card as any).iconBg} rounded-xl flex items-center justify-center shadow-md`}>
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="ml-4 w-0 flex-1">
                      <dl>
                        <dt className={`text-xs font-medium ${(card as any).textColor} uppercase tracking-wider truncate`}>{card.title}</dt>
                        <dd className="flex items-baseline mt-1">
                          <div className={`text-2xl font-semibold ${(card as any).textColor}`}>
                            {loading ? '...' : card.value}
                          </div>
                        </dd>
                        <dd className={`text-xs ${(card as any).textColor} mt-1 font-medium opacity-75`}>{card.change}</dd>
                      </dl>
                    </div>
                  </div>
                  {/* Click hint */}
                  {hasDetail && (
                    <div className={`mt-auto pt-2.5 border-t-2 ${(card as any).flipBorder}`}>
                      <div className={`text-[10px] font-medium ${(card as any).textColor} flex items-center justify-center gap-1.5`}>
                        <Maximize2 className="h-3 w-3" />
                        {card.title === 'Teams Working' 
                          ? `${card.siteList.length} Working • ${(card as any).idleList?.length || 0} Idle`
                          : `${card.siteList.length} ${card.title === 'Teams Working' ? 'Team' : 'Site'}${card.siteList.length > 1 ? 's' : ''}`
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          </div>

          {/* Main Content */}
          <div className="px-3 pb-3">
            {/* Today's Activities & Team Performance in 1 Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Today's Activities - Compact */}
              <div className="bg-white shadow-sm rounded-xl border border-slate-200/60 flex flex-col overflow-hidden max-h-[50vh]">
            <div className="px-4 py-3 border-b-2 border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 flex-none">
              <h3 className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                  <Activity className="h-3.5 w-3.5 text-white" />
                </div>
                {selectedDateCategory === 'Today' ? "Today's Activities" : selectedDateCategory === 'Yesterday' ? "Yesterday's Activities" : selectedDateCategory === 'Tomorrow' ? "Tomorrow's Activities" : selectedDateCategory === 'All' ? "All Activities" : selectedDateCategory === 'This Year' ? "This Year's Activities" : `${selectedDateCategory} Activities`}
              </h3>
              <p className="mt-0.5 text-[10px] text-blue-600 font-medium">
                Activity breakdown for {selectedDateCategory === 'All' ? 'all time' : selectedDateCategory.toLowerCase()}
              </p>
            </div>
            <div className="p-3 flex-1 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-sm text-slate-500">Loading data...</p>
                </div>
              ) : stats.todayActivityBreakdown.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No activities scheduled for {selectedDateCategory === 'All' ? 'all time' : selectedDateCategory === 'This Year' ? 'this year' : selectedDateCategory.toLowerCase()}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {stats.todayActivityBreakdown.slice(0, 10).map((item, index) => {
                    const completionRate = item.count > 0 ? (item.completed / item.count) * 100 : 0
                    const isFlipped = flippedActivityCards[index] || false
                    const activityColor = getActivityColor(item.activity, index)

                    return (
                      <div
                        key={index}
                        className="relative h-[110px]"
                        style={{ perspective: '1000px' }}
                      >
                        <div
                          className={`relative w-full h-full transition-transform duration-500 ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                          style={{ transformStyle: 'preserve-3d' }}
                        >
                          {/* Front Card */}
                          <div
                            className={`absolute inset-0 rounded-xl p-3 bg-white hover:shadow-lg transition-all border-2 ${activityColor.border} ${activityColor.hover} shadow-sm cursor-pointer group`}
                            style={{ backfaceVisibility: 'hidden' }}
                            onClick={() => setFlippedActivityCards(prev => ({ ...prev, [index]: true }))}
                          >
                            <div className="h-full flex flex-col">
                              {/* Header */}
                              <div className="flex items-start justify-between mb-1">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${activityColor.badge}`}>
                                      {item.activity}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[9px] flex-wrap">
                                    <div className="flex items-center gap-0.5">
                                      <span className="text-emerald-600 font-semibold">Completed:</span>
                                      <span className="px-1 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold">{item.completed}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                      <span className="text-amber-600 font-semibold">In Progress:</span>
                                      <span className="px-1 py-0.5 bg-amber-50 text-amber-700 rounded font-bold">{item.inProgress}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                      <span className="text-rose-600 font-semibold">Pending:</span>
                                      <span className="px-1 py-0.5 bg-rose-50 text-rose-700 rounded font-bold">{item.pending}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="ml-1 text-center">
                                  <div className="text-lg font-semibold text-slate-900 leading-none">{item.count}</div>
                                  <div className="text-[7px] text-slate-500 font-normal mt-0.5">TASKS</div>
                                </div>
                              </div>

                              {/* Progress Section */}
                              <div className="mt-auto">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[8px] font-medium text-slate-600">COMPLETION</span>
                                  <span className="text-xs font-bold text-emerald-600">{completionRate.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-600 h-1.5 rounded-full transition-all duration-500 shadow-sm"
                                    style={{ width: `${completionRate}%` }}
                                  />
                                </div>
                              </div>

                              {/* Flip Hint */}
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="text-[8px] text-blue-500 font-medium bg-blue-50 px-1 py-0.5 rounded">📊</div>
                              </div>
                            </div>
                          </div>

                          {/* Back Card (Details) */}
                          <div
                            className={`absolute inset-0 rounded-xl bg-gradient-to-br ${activityColor.bg} p-4 overflow-y-auto cursor-pointer border-2 ${activityColor.border} shadow-lg`}
                            style={{
                              backfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg)'
                            }}
                            onClick={() => setFlippedActivityCards(prev => ({ ...prev, [index]: false }))}
                          >
                            {/* Header */}
                            <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${activityColor.border}`}>
                              <h5 className={`text-sm font-medium ${activityColor.text}`}>📊 {item.activity}</h5>
                              <div className="flex items-center gap-1">
                                <button
                                  className={`p-1.5 rounded-md transition-colors border ${activityColor.badge}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setZoomedActivityCard(index)
                                  }}
                                >
                                  <Maximize2 className={`h-3.5 w-3.5 ${activityColor.text}`} />
                                </button>
                                <button
                                  className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-200 rounded-md transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setFlippedActivityCards(prev => ({ ...prev, [index]: false }))
                                  }}
                                >
                                  <X className="h-3.5 w-3.5 text-gray-800" />
                                </button>
                              </div>
                            </div>

                            {/* Stats Summary */}
                            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 mb-3">
                              <div className="text-xs font-medium text-slate-700 text-center">{item.count} Total Tasks</div>
                            </div>

                            {/* Status Details */}
                            <div className="space-y-2.5">
                              {/* Completed */}
                              <div className="bg-white/70 rounded-lg p-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-xs font-medium text-emerald-700">✓ Completed</span>
                                  <span className="ml-auto text-xs font-medium text-emerald-700">{item.completed}</span>
                                </div>
                                <div className="text-[9px] text-slate-600">
                                  <div className="font-semibold mb-0.5">Teams: <span className="font-normal">{item.completedTeams.length > 0 ? item.completedTeams.slice(0, 2).join(', ') + (item.completedTeams.length > 2 ? '...' : '') : 'None'}</span></div>
                                  <div className="font-semibold">Sites: <span className="font-normal">{item.completedSites.length > 0 ? item.completedSites.slice(0, 2).join(', ') + (item.completedSites.length > 2 ? '...' : '') : 'None'}</span></div>
                                </div>
                              </div>

                              {/* In Progress */}
                              <div className="bg-white/70 rounded-lg p-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-xs font-medium text-amber-700">⏳ In Progress</span>
                                  <span className="ml-auto text-xs font-medium text-amber-700">{item.inProgress}</span>
                                </div>
                                <div className="text-[9px] text-slate-600">
                                  <div className="font-semibold mb-0.5">Teams: <span className="font-normal">{item.inProgressTeams.length > 0 ? item.inProgressTeams.slice(0, 2).join(', ') + (item.inProgressTeams.length > 2 ? '...' : '') : 'None'}</span></div>
                                  <div className="font-semibold">Sites: <span className="font-normal">{item.inProgressSites.length > 0 ? item.inProgressSites.slice(0, 2).join(', ') + (item.inProgressSites.length > 2 ? '...' : '') : 'None'}</span></div>
                                </div>
                              </div>

                              {/* Pending */}
                              <div className="bg-white/70 rounded-lg p-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-xs font-medium text-rose-700">⚠ Pending</span>
                                  <span className="ml-auto text-xs font-medium text-rose-700">{item.pending}</span>
                                </div>
                                <div className="text-[9px] text-slate-600">
                                  <div className="font-semibold mb-0.5">Teams: <span className="font-normal">{item.pendingTeams.length > 0 ? item.pendingTeams.slice(0, 2).join(', ') + (item.pendingTeams.length > 2 ? '...' : '') : 'None'}</span></div>
                                  <div className="font-semibold">Sites: <span className="font-normal">{item.pendingSites.length > 0 ? item.pendingSites.slice(0, 2).join(', ') + (item.pendingSites.length > 2 ? '...' : '') : 'None'}</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              </div>
              </div>

              {/* Team Performance Analysis - Compact */}
              <div className="bg-white shadow-sm rounded-xl border border-slate-200/60 flex flex-col overflow-hidden max-h-[50vh]">
            <div className="px-4 py-3 border-b-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 flex-none">
              <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-sm">
                  <Users className="h-3.5 w-3.5 text-white" />
                </div>
                {selectedDateCategory === 'Today' ? "Today's Team Performance" : selectedDateCategory === 'Yesterday' ? "Yesterday's Team Performance" : selectedDateCategory === 'Tomorrow' ? "Tomorrow's Team Performance" : selectedDateCategory === 'All' ? "All Team Performance" : selectedDateCategory === 'This Year' ? "This Year's Team Performance" : `${selectedDateCategory} Team Performance`}
              </h3>
              <p className="mt-0.5 text-[10px] text-emerald-600 font-medium">
                Team performance for {selectedDateCategory === 'All' ? 'all time' : selectedDateCategory.toLowerCase()}
              </p>
            </div>
            <div className="p-3 flex-1 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  <p className="mt-2 text-sm text-slate-500">Loading data...</p>
                </div>
              ) : stats.todayTeamBreakdown.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No team data for {selectedDateCategory === 'All' ? 'all time' : selectedDateCategory === 'This Year' ? 'this year' : selectedDateCategory.toLowerCase()}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {stats.todayTeamBreakdown.slice(0, 10).map((team, index) => {
                    const completionRate = team.count > 0 ? (team.completed / team.count) * 100 : 0
                    const isFlipped = flippedTeamCards[index] || false

                    return (
                      <div
                        key={index}
                        className="relative h-[110px]"
                        style={{ perspective: '1000px' }}
                      >
                        <div
                          className={`relative w-full h-full transition-transform duration-500 ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                          style={{ transformStyle: 'preserve-3d' }}
                        >
                          {/* Front Card */}
                          <div
                            className="absolute inset-0 rounded-xl p-3 bg-white hover:shadow-lg transition-all border-2 border-slate-100 hover:border-emerald-200 cursor-pointer group"
                            style={{ backfaceVisibility: 'hidden' }}
                            onClick={() => setFlippedTeamCards(prev => ({ ...prev, [index]: true }))}
                          >
                            <div className="h-full flex flex-col">
                              {/* Header */}
                              <div className="flex items-start justify-between mb-1">
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-bold text-slate-800 truncate mb-1 group-hover:text-emerald-600 transition-colors">
                                    {team.team}
                                  </h4>
                                  <div className="flex items-center gap-1 text-[9px] flex-wrap">
                                    <div className="flex items-center gap-0.5">
                                      <span className="text-emerald-600 font-semibold">Completed:</span>
                                      <span className="px-1 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold">{team.completed}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                      <span className="text-rose-600 font-semibold">Pending:</span>
                                      <span className="px-1 py-0.5 bg-rose-50 text-rose-700 rounded font-bold">{team.pending}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="ml-1 text-center">
                                  <div className="text-lg font-semibold text-slate-900 leading-none">{team.count}</div>
                                  <div className="text-[7px] text-slate-500 font-normal mt-0.5">TASKS</div>
                                </div>
                              </div>

                              {/* Progress Section */}
                              <div className="mt-auto">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[8px] font-medium text-slate-600">COMPLETION</span>
                                  <span className="text-xs font-bold text-emerald-600">{completionRate.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-600 h-1.5 rounded-full transition-all duration-500 shadow-sm"
                                    style={{ width: `${completionRate}%` }}
                                  />
                                </div>
                              </div>

                              {/* Flip Hint */}
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="text-[8px] text-emerald-600 font-medium bg-emerald-50 px-1 py-0.5 rounded">📍</div>
                              </div>
                            </div>
                          </div>

                          {/* Back Card (Sitelist) */}
                          <div
                            className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-50 p-4 overflow-y-auto cursor-pointer border-2 border-emerald-200 shadow-lg"
                            style={{
                              backfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg)'
                            }}
                            onClick={() => setFlippedTeamCards(prev => ({ ...prev, [index]: false }))}
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-emerald-200">
                              <h5 className="text-sm font-medium text-slate-800">📍 {team.team}</h5>
                              <div className="flex items-center gap-1">
                                <button
                                  className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setZoomedTeamCard(index)
                                  }}
                                >
                                  <Maximize2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  className="p-1.5 bg-slate-500 hover:bg-slate-600 text-white rounded-md transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setFlippedTeamCards(prev => ({ ...prev, [index]: false }))
                                  }}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Stats Summary */}
                            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-2 mb-3">
                              <div className="text-xs font-medium text-slate-700 text-center">
                                {team.count} tasks • {team.sites.length} sites
                              </div>
                            </div>

                            {/* Activity Sites Breakdown */}
                            <div className="space-y-2">
                              {Object.entries(team.activitySites).map(([activity, sites]) => (
                                <div key={activity} className="bg-white/70 rounded-lg p-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-medium text-slate-700 truncate">{activity}</span>
                                    <span className="text-xs font-medium text-emerald-600">{sites.length}</span>
                                  </div>
                                  <div className="text-[9px] text-slate-600 font-medium">
                                    Sites: {sites.slice(0, 3).join(', ')}{sites.length > 3 ? '...' : ''}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
            </div>
          </div>
        </div>
      
        {/* Close Main Container and Scrollable */}
      </div>

      {/* Zoom Modal for Activity Card */}
      {zoomedActivityCard !== null && stats.todayActivityBreakdown[zoomedActivityCard] && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setZoomedActivityCard(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const item = stats.todayActivityBreakdown[zoomedActivityCard]
              return (
                <>
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white">📊 {item.activity}</h3>
                      <p className="text-sm text-blue-100 font-medium">{item.count} Total Tasks</p>
                    </div>
                    <button
                      onClick={() => setZoomedActivityCard(null)}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5 text-white" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                    <div className="space-y-4">
                      {/* Completed Section */}
                      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-base font-semibold text-emerald-700">✅ Completed</h4>
                          <span className="text-2xl font-semibold text-emerald-700">{item.completed}</span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-medium text-slate-700 mb-1">Teams:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {item.completedTeams.length > 0 ? item.completedTeams.map((team, idx) => (
                                <span key={idx} className="px-2 py-1 bg-white rounded-md text-[10px] font-semibold text-slate-700 border border-emerald-200">{team}</span>
                              )) : <span className="text-xs text-slate-500">None</span>}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-700 mb-1">Sites ({item.completedSites.length}):</p>
                            <div className="flex flex-wrap gap-1.5">
                              {item.completedSites.length > 0 ? item.completedSites.map((site, idx) => (
                                <span key={idx} className="px-2 py-1 bg-white rounded-md text-[10px] font-semibold text-slate-700 border border-emerald-200">{site}</span>
                              )) : <span className="text-xs text-slate-500">None</span>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* In Progress Section */}
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-base font-semibold text-amber-700">⏳ In Progress</h4>
                          <span className="text-2xl font-semibold text-amber-700">{item.inProgress}</span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-medium text-slate-700 mb-1">Teams:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {item.inProgressTeams.length > 0 ? item.inProgressTeams.map((team, idx) => (
                                <span key={idx} className="px-2 py-1 bg-white rounded-md text-[10px] font-semibold text-slate-700 border border-amber-200">{team}</span>
                              )) : <span className="text-xs text-slate-500">None</span>}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-700 mb-1">Sites ({item.inProgressSites.length}):</p>
                            <div className="flex flex-wrap gap-1.5">
                              {item.inProgressSites.length > 0 ? item.inProgressSites.map((site, idx) => (
                                <span key={idx} className="px-2 py-1 bg-white rounded-md text-[10px] font-semibold text-slate-700 border border-amber-200">{site}</span>
                              )) : <span className="text-xs text-slate-500">None</span>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pending Section */}
                      <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-base font-semibold text-rose-700">⚠️ Pending</h4>
                          <span className="text-2xl font-semibold text-rose-700">{item.pending}</span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-medium text-slate-700 mb-1">Teams:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {item.pendingTeams.length > 0 ? item.pendingTeams.map((team, idx) => (
                                <span key={idx} className="px-2 py-1 bg-white rounded-md text-[10px] font-semibold text-slate-700 border border-rose-200">{team}</span>
                              )) : <span className="text-xs text-slate-500">None</span>}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-700 mb-1">Sites ({item.pendingSites.length}):</p>
                            <div className="flex flex-wrap gap-1.5">
                              {item.pendingSites.length > 0 ? item.pendingSites.map((site, idx) => (
                                <span key={idx} className="px-2 py-1 bg-white rounded-md text-[10px] font-semibold text-slate-700 border border-rose-200">{site}</span>
                              )) : <span className="text-xs text-slate-500">None</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Zoom Modal for Stats Card */}
      {zoomedStatsCard !== null && dashboardCards[zoomedStatsCard] && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setZoomedStatsCard(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const card = dashboardCards[zoomedStatsCard]
              const isTeamsCard = card.title === 'Teams Working'
              const cardColor = (card as any).iconBg || 'from-blue-500 to-indigo-600'
              return (
                <>
                  {/* Modal Header */}
                  <div className={`bg-gradient-to-r ${cardColor} px-6 py-4 flex items-center justify-between`}>
                    <div>
                      <h3 className="text-xl font-semibold text-white">{isTeamsCard ? '👥 Team Status' : card.flipTitle}</h3>
                      <p className="text-sm text-purple-100 font-medium">
                        {isTeamsCard ? `${card.siteList.length} working • ${(card as any).idleList?.length || 0} idle` : `${card.siteList.length} items`}
                      </p>
                    </div>
                    <button
                      onClick={() => setZoomedStatsCard(null)}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5 text-white" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                    {isTeamsCard ? (
                      <div className="space-y-6">
                        {/* Working Teams Section */}
                        <div>
                          <h4 className="text-lg font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            Working Teams ({card.siteList.length})
                          </h4>
                          {card.siteList.length > 0 ? (
                            <div className="space-y-2">
                              {card.siteList.map((item: string, idx: number) => (
                                <div 
                                  key={idx} 
                                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 hover:border-emerald-300 hover:shadow-md transition-all group"
                                >
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 group-hover:bg-emerald-600 transition-colors flex-shrink-0" />
                                  <span className="text-sm font-medium text-slate-700 break-all flex-1">{item}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 italic">No teams working</p>
                          )}
                        </div>

                        {/* Idle Teams Section */}
                        <div>
                          <h4 className="text-lg font-semibold text-rose-700 mb-3 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                            Idle Teams ({(card as any).idleList?.length || 0})
                          </h4>
                          {(card as any).idleList && (card as any).idleList.length > 0 ? (
                            <div className="space-y-2">
                              {(card as any).idleList.map((item: string, idx: number) => (
                                <div 
                                  key={idx} 
                                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-200 hover:border-rose-300 hover:shadow-md transition-all group"
                                >
                                  <div className="w-2 h-2 rounded-full bg-rose-500 group-hover:bg-rose-600 transition-colors flex-shrink-0" />
                                  <span className="text-sm font-medium text-slate-700 break-all flex-1">{item}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 italic">No idle teams</p>
                          )}
                        </div>
                      </div>
                    ) : card.siteList.length > 0 ? (
                      <div className="space-y-2">
                        {card.siteList.map((item: string, idx: number) => (
                          <div 
                            key={idx} 
                            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer"
                          >
                            <div className="w-2 h-2 rounded-full bg-blue-400 group-hover:bg-blue-600 transition-colors flex-shrink-0" />
                            <span className="text-sm font-medium text-slate-700 break-all flex-1">{item}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                          <AlertCircle className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="text-base font-medium text-slate-600">No data available</p>
                        <p className="text-sm text-slate-400 mt-1">There is no data in this category</p>
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Zoom Modal for Team Card */}
      {zoomedTeamCard !== null && stats.todayTeamBreakdown[zoomedTeamCard] && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setZoomedTeamCard(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const team = stats.todayTeamBreakdown[zoomedTeamCard]
              return (
                <>
                  {/* Modal Header */}
                  <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white">📍 {team.team}</h3>
                      <p className="text-sm text-emerald-100 font-medium">{team.count} tasks • {team.sites.length} sites</p>
                    </div>
                    <button
                      onClick={() => setZoomedTeamCard(null)}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5 text-white" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
                    <div className="space-y-4">
                      {Object.entries(team.activitySites).map(([activity, sites]) => (
                        <div key={activity} className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-base font-semibold text-slate-800">{activity}</h4>
                            <span className="text-2xl font-semibold text-emerald-600">{sites.length}</span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-700 mb-2">Sites:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {sites.map((site, idx) => (
                                <span key={idx} className="px-2.5 py-1.5 bg-white rounded-lg text-[10px] font-semibold text-slate-700 border border-emerald-300 shadow-sm">
                                  {site}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
