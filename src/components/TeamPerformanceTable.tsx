'use client'

import { useState, useMemo, useEffect } from 'react'

interface ClockRecord {
  _sheet: string
  [key: string]: string
}

interface TeamPerformanceTableProps {
  data: ClockRecord[]
  selectedRegion: string
  startDate?: string
  endDate?: string
}

interface EmployeeStats {
  name: string
  region: string
  totalDays: number
  presentDays: number
  ontimeDays: number
  lateDays: number
  before7amDays: number
  before6amDays: number
  totalWorkHours: number
  uniqueSites: number
  attendanceRate: number
  ontimeRate: number
  avgWorkHoursPerDay: number
  avgSitesPerDay: number
}

export default function TeamPerformanceTable({ data, selectedRegion, startDate, endDate }: TeamPerformanceTableProps) {
  const [sortBy, setSortBy] = useState<keyof EmployeeStats>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterType, setFilterType] = useState<'all' | 'ontime' | 'late' | 'before7am' | 'before6am'>('all')
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('')

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.employee-dropdown-container')) {
        setShowEmployeeDropdown(false)
      }
    }

    if (showEmployeeDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmployeeDropdown])

  // Helper function to check clock in time
  const checkClockInTime = (clockTimeStr: string): { isBefore6am: boolean; isBefore7am: boolean; isOntime: boolean } => {
    try {
      // Format: "2025-10-01 7:25:09" or "2025-10-01 07:25:09"
      const timePart = clockTimeStr.trim().split(' ')[1] // Get time part
      if (!timePart) return { isBefore6am: false, isBefore7am: false, isOntime: false }

      const [hourStr, minuteStr] = timePart.split(':')
      const hour = parseInt(hourStr)
      const minute = parseInt(minuteStr || '0')

      // Before 6:00 AM
      if (hour < 6) {
        return { isBefore6am: true, isBefore7am: true, isOntime: true }
      }

      // Before 7:00 AM (but after 6:00 AM)
      if (hour < 7) {
        return { isBefore6am: false, isBefore7am: true, isOntime: true }
      }

      // On-time: before 9:00 AM (or exactly 9:00)
      if (hour < 9 || (hour === 9 && minute === 0)) {
        return { isBefore6am: false, isBefore7am: false, isOntime: true }
      }

      // Late: 9:00 AM or later
      return { isBefore6am: false, isBefore7am: false, isOntime: false }
    } catch {
      return { isBefore6am: false, isBefore7am: false, isOntime: false }
    }
  }

  // Helper function to calculate work hours between clock in and clock out
  const calculateWorkHours = (clockInStr: string, clockOutStr: string): number => {
    try {
      // Helper to pad time parts with leading zeros
      const normalizeTime = (timeStr: string): string => {
        const parts = timeStr.split(':')
        return parts.map(part => part.padStart(2, '0')).join(':')
      }

      // Parse clock in: "2025-09-05 6:28:10"
      const clockInParts = clockInStr.trim().split(' ')
      if (clockInParts.length !== 2) return 0
      
      const [dateIn, timeInRaw] = clockInParts
      const timeIn = normalizeTime(timeInRaw)
      
      // Parse clock out - could be "16:13:59" (time only) or "2025-09-05 16:13:59" (full datetime)
      const clockOutParts = clockOutStr.trim().split(' ')
      let dateOut: string
      let timeOut: string
      
      if (clockOutParts.length === 1) {
        // Only time provided, use same date as clock in
        dateOut = dateIn
        timeOut = normalizeTime(clockOutParts[0])
      } else if (clockOutParts.length === 2) {
        // Full datetime provided
        dateOut = clockOutParts[0]
        timeOut = normalizeTime(clockOutParts[1])
      } else {
        return 0
      }
      
      // Create Date objects with ISO format
      const clockIn = new Date(`${dateIn}T${timeIn}`)
      const clockOut = new Date(`${dateOut}T${timeOut}`)
      
      if (isNaN(clockIn.getTime()) || isNaN(clockOut.getTime())) return 0
      
      // Calculate difference
      let diffMs = clockOut.getTime() - clockIn.getTime()
      
      // If negative (clock out next day), add 24 hours
      if (diffMs < 0) {
        diffMs += 24 * 60 * 60 * 1000
      }
      
      const diffHours = diffMs / (1000 * 60 * 60)
      
      return diffHours > 0 && diffHours < 24 ? diffHours : 0
    } catch (error) {
      return 0
    }
  }

  // Process data to calculate employee statistics
  const employeeStats = useMemo(() => {
    const statsMap = new Map<string, EmployeeStats>()
    const employeeRegionMap = new Map<string, string>()
    const employeeSitesMap = new Map<string, Set<string>>()
    const employeeClockPairs = new Map<string, Array<{ clockIn: string; clockOut: string | null }>>()

    // First pass: collect all records and pair clock in/out
    // Track first clock in per employee per day
    const employeeFirstClockInPerDay = new Map<string, Set<string>>()
    
    data.forEach((record) => {
      // Apply date filter
      const recordClockTime = record['Clock Time'] || ''
      const recordDate = recordClockTime.split(' ')[0]
      if (startDate && recordDate < startDate) return
      if (endDate && recordDate > endDate) return

      const name = record['Name'] || record['Employee'] || record['Employee Name'] || 
                   record['name'] || record['employee'] || record['Nama'] || 'Unknown'
      
      if (!name || name === 'Unknown') return

      // Track employee region
      const region = record['Delivery Area'] || record['Region'] || record['region'] || ''
      if (name && region && !employeeRegionMap.has(name)) {
        employeeRegionMap.set(name, region)
      }

      // Track unique sites (DUID)
      const duid = record['DU ID'] || record['DUID'] || record['du_id'] || ''
      if (duid) {
        if (!employeeSitesMap.has(name)) {
          employeeSitesMap.set(name, new Set())
        }
        employeeSitesMap.get(name)!.add(duid)
      }

      const clockType = record['Clock In/Out'] || record['ClockInOut'] || record['Type'] || ''
      const clockTime = record['Clock Time'] || record['ClockTime'] || record['Time'] || 
                        record['clock_time'] || record['time'] || ''

      if (!clockTime) return

      if (!employeeClockPairs.has(name)) {
        employeeClockPairs.set(name, [])
      }

      const pairs = employeeClockPairs.get(name)!
      
      if (clockType.toLowerCase().includes('in')) {
        // Check if this is the first clock in for this day
        if (!employeeFirstClockInPerDay.has(name)) {
          employeeFirstClockInPerDay.set(name, new Set())
        }
        const daysSet = employeeFirstClockInPerDay.get(name)!
        
        // Only count first clock in of the day
        if (!daysSet.has(recordDate)) {
          daysSet.add(recordDate)
          // Clock In - create new pair
          pairs.push({ clockIn: clockTime, clockOut: null })
        }
      } else if (clockType.toLowerCase().includes('out')) {
        // Clock Out - match with last unpaired clock in
        const lastPair = pairs.length > 0 ? pairs[pairs.length - 1] : null
        if (lastPair && !lastPair.clockOut) {
          lastPair.clockOut = clockTime
        }
      }
    })

    // Second pass: calculate statistics
    employeeClockPairs.forEach((pairs, name) => {
      if (!statsMap.has(name)) {
        statsMap.set(name, {
          name,
          region: employeeRegionMap.get(name) || '',
          totalDays: 0,
          presentDays: 0,
          ontimeDays: 0,
          lateDays: 0,
          before7amDays: 0,
          before6amDays: 0,
          totalWorkHours: 0,
          uniqueSites: employeeSitesMap.get(name)?.size || 0,
          attendanceRate: 0,
          ontimeRate: 0,
          avgWorkHoursPerDay: 0,
          avgSitesPerDay: 0,
        })
      }

      const stats = statsMap.get(name)!
      stats.totalDays = pairs.length

      pairs.forEach((pair) => {
        if (pair.clockIn) {
          stats.presentDays++

          // Check clock in time
          const timeCheck = checkClockInTime(pair.clockIn)
          
          if (timeCheck.isBefore6am) {
            stats.before6amDays++
            stats.before7amDays++
            stats.ontimeDays++
          } else if (timeCheck.isBefore7am) {
            stats.before7amDays++
            stats.ontimeDays++
          } else if (timeCheck.isOntime) {
            stats.ontimeDays++
          } else {
            stats.lateDays++
          }

          // Calculate work hours - use 6 PM (18:00) as default if no clock out
          const clockOut = pair.clockOut || '18:00:00'
          const workHours = calculateWorkHours(pair.clockIn, clockOut)
          stats.totalWorkHours += workHours
        }
      })
    })

    // Calculate rates and averages
    statsMap.forEach((stats) => {
      stats.attendanceRate = stats.totalDays > 0 
        ? Math.round((stats.presentDays / stats.totalDays) * 100) 
        : 0
      stats.ontimeRate = stats.presentDays > 0
        ? Math.round((stats.ontimeDays / stats.presentDays) * 100)
        : 0
      stats.avgWorkHoursPerDay = stats.presentDays > 0
        ? stats.totalWorkHours / stats.presentDays
        : 0
      stats.avgSitesPerDay = stats.presentDays > 0
        ? stats.uniqueSites / stats.presentDays
        : 0
    })

    return Array.from(statsMap.values())
  }, [data, startDate, endDate])

  // Get employee clock details
  const getEmployeeDetails = (employeeName: string) => {
    // Get all records for this employee
    const employeeRecords = data.filter((record) => {
      const name = record['Name'] || record['Employee'] || record['Employee Name'] || 
                   record['name'] || record['employee'] || record['Nama'] || ''
      if (name !== employeeName) return false
      
      // Apply date filter
      const clockTime = record['Clock Time'] || ''
      const recordDate = clockTime.split(' ')[0]
      if (startDate && recordDate < startDate) return false
      if (endDate && recordDate > endDate) return false
      
      return true
    })

    // First, create all records with type info
    const allRecords: Array<{
      date: string
      time: string
      type: string
      clockIn: string
      clockOut: string | null
      workHours: number
      duid: string
      duName: string
      siteName: string
      isBefore6am: boolean
      isBefore7am: boolean
      isOntime: boolean
      fullClockTime: string
    }> = []

    // Track first clock in per day
    const firstClockInPerDay = new Set<string>()

    employeeRecords.forEach((record) => {
      const clockType = record['Clock In/Out'] || record['ClockInOut'] || record['Type'] || ''
      const clockTime = record['Clock Time'] || ''
      const fullTime = clockTime.split(' ')
      const date = fullTime[0] || ''
      const time = fullTime[1] || ''

      const isClockIn = clockType.toLowerCase().includes('in')
      const timeCheck = isClockIn ? checkClockInTime(clockTime) : { isBefore6am: false, isBefore7am: false, isOntime: false }

      // For clock in, only add first one per day
      if (isClockIn && firstClockInPerDay.has(date)) {
        return // Skip subsequent clock ins on same day
      }

      if (isClockIn) {
        firstClockInPerDay.add(date)
      }

      allRecords.push({
        date,
        time,
        type: clockType,
        clockIn: isClockIn ? time : '',
        clockOut: !isClockIn ? time : null,
        workHours: 0,
        duid: record['DU ID'] || record['DUID'] || record['du_id'] || '-',
        duName: record['DU Name'] || record['DUName'] || record['du_name'] || '-',
        siteName: record['Customer Site Name'] || record['Site Name'] || '-',
        isBefore6am: timeCheck.isBefore6am,
        isBefore7am: timeCheck.isBefore7am,
        isOntime: timeCheck.isOntime,
        fullClockTime: clockTime,
      })
    })

    // Sort by date and time first
    allRecords.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.time.localeCompare(b.time)
    })

    // Now calculate work hours by pairing clock in with next clock out
    for (let i = 0; i < allRecords.length; i++) {
      const record = allRecords[i]
      
      if (record.type.toLowerCase().includes('in')) {
        // Look for next clock out
        let foundClockOut = false
        for (let j = i + 1; j < allRecords.length; j++) {
          if (allRecords[j].type.toLowerCase().includes('out')) {
            // Found clock out, calculate work hours
            const workHours = calculateWorkHours(record.fullClockTime, allRecords[j].fullClockTime)
            record.workHours = workHours
            record.clockOut = allRecords[j].time
            foundClockOut = true
            break
          } else {
            // Another clock in before clock out, stop looking
            break
          }
        }
        
        // If no clock out found, use default 6 PM
        if (!foundClockOut) {
          const defaultClockOut = `${record.date} 18:00:00`
          const workHours = calculateWorkHours(record.fullClockTime, defaultClockOut)
          record.workHours = workHours
        }
      }
    }

    return allRecords
  }

  // Get employee names filtered by region and date range (for dropdown)
  const availableEmployeeNames = useMemo(() => {
    let filtered = employeeStats
    
    // Apply region filter
    if (selectedRegion !== 'all') {
      filtered = filtered.filter(stats => stats.region === selectedRegion)
    }
    
    // Note: Date filter is already applied in employeeStats calculation
    return Array.from(new Set(filtered.map(stats => stats.name))).sort()
  }, [employeeStats, selectedRegion])

  // Filter employee names based on search term
  const filteredEmployeeNames = useMemo(() => {
    if (!employeeSearchTerm.trim()) return availableEmployeeNames
    const searchLower = employeeSearchTerm.toLowerCase()
    return availableEmployeeNames.filter(name => name.toLowerCase().includes(searchLower))
  }, [availableEmployeeNames, employeeSearchTerm])

  // Cleanup selected employees when available employees change
  useEffect(() => {
    if (selectedEmployees.length > 0) {
      const validSelections = selectedEmployees.filter(name => availableEmployeeNames.includes(name))
      if (validSelections.length !== selectedEmployees.length) {
        setSelectedEmployees(validSelections)
      }
    }
  }, [availableEmployeeNames, selectedEmployees])

  // Filter and sort data
  const filteredAndSortedStats = useMemo(() => {
    let filtered = employeeStats
    
    // Multi-select employee filter
    if (selectedEmployees.length > 0) {
      filtered = filtered.filter((stats) => selectedEmployees.includes(stats.name))
    }

    // Apply region filter
    if (selectedRegion !== 'all') {
      filtered = filtered.filter(stats => stats.region === selectedRegion)
    }

    // Apply filter type
    if (filterType === 'ontime') {
      filtered = filtered.filter(stats => stats.ontimeRate >= 90)
    } else if (filterType === 'late') {
      filtered = filtered.filter(stats => stats.lateDays > 0)
    } else if (filterType === 'before7am') {
      filtered = filtered.filter(stats => stats.before7amDays > 0)
    } else if (filterType === 'before6am') {
      filtered = filtered.filter(stats => stats.before6amDays > 0)
    }

    filtered.sort((a, b) => {
      const aValue = a[sortBy]
      const bValue = b[sortBy]

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
      }

      const aStr = String(aValue)
      const bStr = String(bValue)
      return sortOrder === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr)
    })

    return filtered
  }, [employeeStats, sortBy, sortOrder, filterType, selectedRegion, selectedEmployees])

  // Calculate summary statistics (filtered by region, search, and filter type)
  const summaryStats = useMemo(() => {
    // Use filteredAndSortedStats which already has all filters applied
    const filteredStats = filteredAndSortedStats

    // Get employee names from filtered stats to filter data
    const filteredEmployeeNames = new Set(filteredStats.map(s => s.name))
    
    // Apply same filters to raw data for DUID visit calculation
    const filteredData = data.filter(record => {
      const name = record['Name'] || record['Employee'] || record['Employee Name'] || 
                   record['name'] || record['employee'] || record['Nama'] || 'Unknown'
      
      // Must be in filtered employees
      if (!filteredEmployeeNames.has(name)) return false
      
      // Apply region filter if needed
      if (selectedRegion !== 'all') {
        const region = record['Delivery Area'] || record['Region'] || record['region'] || ''
        if (region !== selectedRegion) return false
      }
      
      return true
    })

    const totalEmployees = filteredStats.length
    const avgAttendance = filteredStats.length > 0
      ? Math.round(
          filteredStats.reduce((sum, stats) => sum + stats.attendanceRate, 0) / 
          filteredStats.length
        )
      : 0
    const avgOntimeRate = filteredStats.length > 0
      ? Math.round(
          filteredStats.reduce((sum, stats) => sum + stats.ontimeRate, 0) / 
          filteredStats.length
        )
      : 0
    const totalOntimeDays = filteredStats.reduce((sum, stats) => sum + stats.ontimeDays, 0)
    const totalLateDays = filteredStats.reduce((sum, stats) => sum + stats.lateDays, 0)
    const totalBefore7amDays = filteredStats.reduce(
      (sum, stats) => sum + stats.before7amDays,
      0
    )
    const totalBefore6amDays = filteredStats.reduce(
      (sum, stats) => sum + stats.before6amDays,
      0
    )
    const totalWorkHours = filteredStats.reduce((sum, stats) => sum + stats.totalWorkHours, 0)
    const totalUniqueSites = filteredStats.reduce((sum, stats) => sum + stats.uniqueSites, 0)
    const totalClockInDays = filteredStats.reduce((sum, stats) => sum + stats.presentDays, 0)
    
    // Performance analysis
    const goodPerformers = filteredStats.filter(stats => 
      stats.ontimeRate >= 90 && stats.lateDays === 0 && stats.attendanceRate >= 95
    ).length
    
    const needsAttention = filteredStats.filter(stats => 
      stats.lateDays > 5 || stats.ontimeRate < 70 || stats.attendanceRate < 80
    ).length

    // Calculate average visits per DUID
    // Count how many times each DUID is visited (clock in only)
    const duidVisitCount = new Map<string, number>()
    filteredData.forEach((record) => {
      const clockType = record['Clock In/Out'] || record['ClockInOut'] || record['Type'] || ''
      if (!clockType.toLowerCase().includes('in')) return // Only count clock in
      
      const duid = record['DU ID'] || record['DUID'] || record['du_id'] || ''
      if (duid) {
        duidVisitCount.set(duid, (duidVisitCount.get(duid) || 0) + 1)
      }
    })
    
    const totalDuids = duidVisitCount.size
    const totalVisits = Array.from(duidVisitCount.values()).reduce((sum, count) => sum + count, 0)
    const avgVisitsPerDuid = totalDuids > 0 ? totalVisits / totalDuids : 0

    return {
      totalEmployees,
      avgAttendance,
      avgOntimeRate,
      totalOntimeDays,
      totalLateDays,
      totalBefore7amDays,
      totalBefore6amDays,
      totalWorkHours,
      avgWorkHoursPerDay: totalClockInDays > 0 ? totalWorkHours / totalClockInDays : 0,
      totalUniqueSites,
      avgUniqueSites: totalEmployees > 0 ? totalUniqueSites / totalEmployees : 0,
      goodPerformers,
      needsAttention,
      avgVisitsPerDuid,
    }
  }, [filteredAndSortedStats, data, selectedRegion, startDate, endDate])

  const handleSort = (column: keyof EmployeeStats) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards Row 1 - Main Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setFilterType(filterType === 'all' ? 'all' : 'all')}
          className={`bg-blue-50 rounded-lg border-2 p-3 text-left transition-all hover:shadow-md ${
            filterType === 'all' ? 'border-blue-500' : 'border-blue-200'
          }`}
        >
          <p className="text-blue-600 text-xs font-medium">Total Employees</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">
            {summaryStats.totalEmployees}
          </p>
        </button>

        <button
          onClick={() => setFilterType(filterType === 'ontime' ? 'all' : 'ontime')}
          className={`bg-green-50 rounded-lg border-2 p-3 text-left transition-all hover:shadow-md ${
            filterType === 'ontime' ? 'border-green-500' : 'border-green-200'
          }`}
        >
          <p className="text-green-600 text-xs font-medium">Avg On-Time Rate</p>
          <p className="text-2xl font-bold text-green-900 mt-1">
            {summaryStats.avgOntimeRate}%
          </p>
        </button>

        <div className="bg-emerald-50 rounded-lg border-2 border-emerald-200 p-3">
          <p className="text-emerald-600 text-xs font-medium">Total On-Time</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">
            {summaryStats.totalOntimeDays}
          </p>
          <p className="text-xs text-emerald-700">days</p>
        </div>

        <button
          onClick={() => setFilterType(filterType === 'late' ? 'all' : 'late')}
          className={`bg-yellow-50 rounded-lg border-2 p-3 text-left transition-all hover:shadow-md ${
            filterType === 'late' ? 'border-yellow-500' : 'border-yellow-200'
          }`}
        >
          <p className="text-yellow-600 text-xs font-medium">Total Late Arrivals</p>
          <p className="text-2xl font-bold text-yellow-900 mt-1">
            {summaryStats.totalLateDays}
          </p>
        </button>

        <button
          onClick={() => setFilterType(filterType === 'before7am' ? 'all' : 'before7am')}
          className={`bg-purple-50 rounded-lg border-2 p-3 text-left transition-all hover:shadow-md ${
            filterType === 'before7am' ? 'border-purple-500' : 'border-purple-200'
          }`}
        >
          <p className="text-purple-600 text-xs font-medium">Before 7AM</p>
          <p className="text-2xl font-bold text-purple-900 mt-1">
            {summaryStats.totalBefore7amDays}
          </p>
          <p className="text-xs text-purple-700">days</p>
        </button>

        <button
          onClick={() => setFilterType(filterType === 'before6am' ? 'all' : 'before6am')}
          className={`bg-indigo-50 rounded-lg border-2 p-3 text-left transition-all hover:shadow-md ${
            filterType === 'before6am' ? 'border-indigo-500' : 'border-indigo-200'
          }`}
        >
          <p className="text-indigo-600 text-xs font-medium">Before 6AM</p>
          <p className="text-2xl font-bold text-indigo-900 mt-1">
            {summaryStats.totalBefore6amDays}
          </p>
          <p className="text-xs text-indigo-700">days</p>
        </button>
      </div>

      {/* Summary Cards Row 2 - Performance Analysis */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-emerald-50 rounded-lg border-2 border-emerald-200 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-emerald-600 text-xs font-medium">Good Performers</p>
            <span className="text-lg">⭐</span>
          </div>
          <p className="text-2xl font-bold text-emerald-900">
            {summaryStats.goodPerformers}
          </p>
          <p className="text-xs text-emerald-700">≥90% ontime, 0 late, ≥95% attend</p>
        </div>

        <div className="bg-red-50 rounded-lg border-2 border-red-200 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-red-600 text-xs font-medium">Needs Attention</p>
            <span className="text-lg">⚠️</span>
          </div>
          <p className="text-2xl font-bold text-red-900">
            {summaryStats.needsAttention}
          </p>
          <p className="text-xs text-red-700">&gt;5 late or &lt;70% ontime or &lt;80% attend</p>
        </div>

        <div className="bg-cyan-50 rounded-lg border-2 border-cyan-200 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-cyan-600 text-xs font-medium">Avg Work Hours</p>
            <span className="text-lg">🕐</span>
          </div>
          <p className="text-2xl font-bold text-cyan-900">
            {summaryStats.avgWorkHoursPerDay.toFixed(1)}h
          </p>
          <p className="text-xs text-cyan-700">per day</p>
        </div>

        <div className="bg-teal-50 rounded-lg border-2 border-teal-200 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-teal-600 text-xs font-medium">Avg Sites Visited</p>
            <span className="text-lg">📍</span>
          </div>
          <p className="text-2xl font-bold text-teal-900">
            {summaryStats.avgUniqueSites.toFixed(1)}
          </p>
          <p className="text-xs text-teal-700">unique DUIDs per employee</p>
        </div>

        <div className="bg-orange-50 rounded-lg border-2 border-orange-200 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-orange-600 text-xs font-medium">Avg Visits per DUID</p>
            <span className="text-lg">🔄</span>
          </div>
          <p className="text-2xl font-bold text-orange-900">
            {summaryStats.avgVisitsPerDuid.toFixed(1)}x
          </p>
          <p className="text-xs text-orange-700">revisit rate per site</p>
        </div>
      </div>

      {/* Search and Filter Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex flex-col gap-2">
          {/* Row 1: Multi-select Employee Filter */}
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <div className="relative flex-1 w-full employee-dropdown-container">
              <button
                onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between"
              >
                <span className={selectedEmployees.length === 0 ? 'text-gray-500' : 'text-gray-900'}>
                  {selectedEmployees.length === 0 
                    ? 'Select employees to filter...' 
                    : `${selectedEmployees.length} employee${selectedEmployees.length > 1 ? 's' : ''} selected`}
                </span>
                <svg className={`w-4 h-4 transition-transform ${showEmployeeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showEmployeeDropdown && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
                  <div className="sticky top-0 bg-gray-50 p-2 border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="Search employees..."
                      value={employeeSearchTerm}
                      onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedEmployees(filteredEmployeeNames)
                        }}
                        className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Select All {employeeSearchTerm && `(${filteredEmployeeNames.length})`}
                      </button>
                      <button
                        onClick={() => setSelectedEmployees([])}
                        className="flex-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {filteredEmployeeNames.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        No employees found
                      </div>
                    ) : (
                      filteredEmployeeNames.map((name) => (
                    <label
                      key={name}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmployees.includes(name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployees([...selectedEmployees, name])
                          } else {
                            setSelectedEmployees(selectedEmployees.filter(n => n !== name))
                          }
                        }}
                        className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{name}</span>
                    </label>
                  )))}
                  </div>
                </div>
              )}
            </div>
            
            {selectedEmployees.length > 0 && (
              <button
                onClick={() => setSelectedEmployees([])}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors whitespace-nowrap"
              >
                Clear Selection
              </button>
            )}
          </div>

          {/* Row 2: Filter Buttons */}
          {filterType !== 'all' && (
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
              >
                Clear Filter
              </button>
            </div>
          )}
        </div>
        {filterType !== 'all' && (
          <p className="text-xs text-gray-600 mt-2">
            Filtered: {
              filterType === 'ontime' ? 'On-time employees (≥90%)' : 
              filterType === 'late' ? 'Employees with late arrivals' : 
              filterType === 'before7am' ? 'Clock-in before 7AM' :
              'Clock-in before 6AM'
            }
          </p>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  Employee {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalDays')}
                >
                  Total {sortBy === 'totalDays' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('presentDays')}
                >
                  Present {sortBy === 'presentDays' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('ontimeDays')}
                >
                  On-Time {sortBy === 'ontimeDays' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('ontimeRate')}
                >
                  Rate {sortBy === 'ontimeRate' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('lateDays')}
                >
                  Late {sortBy === 'lateDays' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('before7amDays')}
                >
                  &lt;7AM {sortBy === 'before7amDays' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('before6amDays')}
                >
                  &lt;6AM {sortBy === 'before6amDays' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('avgWorkHoursPerDay')}
                >
                  Avg Hours {sortBy === 'avgWorkHoursPerDay' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('avgSitesPerDay')}
                >
                  Avg Sites {sortBy === 'avgSitesPerDay' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedStats.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-gray-500 text-sm">
                    No employees found
                  </td>
                </tr>
              ) : (
                filteredAndSortedStats.map((stats, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">
                      <button
                        onClick={() => setSelectedEmployee(selectedEmployee === stats.name ? null : stats.name)}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-left"
                      >
                        {stats.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {stats.totalDays}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {stats.presentDays}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {stats.ontimeDays}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          stats.ontimeRate >= 90
                            ? 'bg-green-100 text-green-800'
                            : stats.ontimeRate >= 75
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {stats.ontimeRate}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {stats.lateDays > 0 ? (
                        <span className="text-red-600 font-medium">{stats.lateDays}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {stats.before7amDays > 0 ? (
                        <span className="text-purple-600 font-medium">{stats.before7amDays}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {stats.before6amDays > 0 ? (
                        <span className="text-indigo-600 font-medium">{stats.before6amDays}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      <span className="text-cyan-600 font-medium">
                        {stats.avgWorkHoursPerDay.toFixed(1)}h
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      <span className="text-teal-600 font-medium">
                        {stats.avgSitesPerDay.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Summary */}
      <div className="text-xs text-gray-600 text-center">
        Showing {filteredAndSortedStats.length} of {employeeStats.length} employees
      </div>

      {/* Employee Details Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">Clock In/Out Details - {selectedEmployee}</h3>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-auto max-h-[calc(80vh-80px)]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Time</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Work Hours</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">DU ID</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">DU Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Site Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getEmployeeDetails(selectedEmployee).map((detail, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm text-gray-900">{detail.date}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 font-medium">{detail.time}</td>
                      <td className="px-3 py-2 text-sm">
                        {detail.type.toLowerCase().includes('in') ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            Clock In
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                            Clock Out
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {detail.type.toLowerCase().includes('in') ? (
                          detail.isBefore6am ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                              Before 6AM
                            </span>
                          ) : detail.isBefore7am ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                              Before 7AM
                            </span>
                          ) : detail.isOntime ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              On-Time
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                              Late
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 font-medium">
                        {detail.type.toLowerCase().includes('in') && detail.workHours > 0 ? (
                          <span className="text-cyan-600">{detail.workHours.toFixed(1)}h</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">{detail.duid}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{detail.duName}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{detail.siteName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
