'use client'

import { useState, useEffect } from 'react'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import TeamPerformanceTable from '@/components/TeamPerformanceTable'

interface ClockSheet {
  id: string
  name: string
  createdTime: string
  modifiedTime: string
}

interface ClockRecord {
  _sheet: string
  [key: string]: string
}

export default function TeamPerformancePage() {
  const [sheets, setSheets] = useState<ClockSheet[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [data, setData] = useState<ClockRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch list of Clock Detail Report sheets
  useEffect(() => {
    const fetchSheets = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/sheets/clock-report')
        if (!response.ok) throw new Error('Failed to fetch sheets')
        
        const result = await response.json()
        
        // Check if there's an error message
        if (result.error) {
          setError(`${result.error}: ${result.details || 'Please ensure service account has access to the folder'}`)
          setSheets([])
          return
        }
        
        setSheets(result.sheets || [])
        
        // Auto-select the most recent sheet
        if (result.sheets && result.sheets.length > 0) {
          setSelectedSheet(result.sheets[0].id)
        } else {
          setError('No Clock Detail Report files found in the folder. Please ensure:\n1. Files exist in folder ID: ' + 
                  (process.env.NEXT_PUBLIC_DRIVE_FOLDER_ID || '1qQorUzpvBvrk_BuBaMMmrG8_aaWYnq2M') + 
                  '\n2. Service account (absensi-service@...) has access to the folder\n3. Files contain "Clock" and "Detail" in the name')
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSheets()
  }, [])

  // Fetch data when sheet is selected
  useEffect(() => {
    if (!selectedSheet) return

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/sheets/clock-report?sheetId=${selectedSheet}`)
        if (!response.ok) throw new Error('Failed to fetch data')
        
        const result = await response.json()
        setData(result.data || [])
      } catch (err: any) {
        setError(err.message)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedSheet])

  // Initialize date filters when data changes
  useEffect(() => {
    if (data.length > 0 && !startDate && !endDate) {
      const dateRange = data.reduce((acc, record) => {
        const clockTime = record['Clock Time'] || ''
        const date = clockTime.split(' ')[0]
        if (date) {
          if (!acc.min || date < acc.min) acc.min = date
          if (!acc.max || date > acc.max) acc.max = date
        }
        return acc
      }, { min: '', max: '' })

      if (dateRange.min && dateRange.max) {
        setStartDate(dateRange.min)
        setEndDate(dateRange.max)
      }
    }
  }, [data])

  // Get unique regions from data
  const uniqueRegions = Array.from(
    new Set(
      data
        .map((record) => record['Delivery Area'] || record['Region'] || record['region'] || '')
        .filter((region) => region)
    )
  ).sort()

  return (
    <div className="p-4 space-y-3">
      {/* Compact Header with Selector */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-sm p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <h1 className="text-lg font-bold text-white">
                Team Performance Dashboard
              </h1>
              <p className="text-xs text-blue-50">
                Attendance and clock-in patterns analysis
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label htmlFor="sheet-select" className="text-xs font-medium text-white whitespace-nowrap">
                Report:
              </label>
              <select
                id="sheet-select"
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className="flex-1 md:flex-none md:w-80 px-3 py-1.5 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                disabled={loading}
              >
                {sheets.length === 0 && (
                  <option value="">No reports available</option>
                )}
                {sheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.name}
                  </option>
                ))}
              </select>
              {sheets.length > 0 && (
                <span className="text-xs text-blue-50 hidden md:inline">
                  ({sheets.length} found)
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label htmlFor="region-select" className="text-xs font-medium text-white whitespace-nowrap">
                Region:
              </label>
              <select
                id="region-select"
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="flex-1 md:flex-none md:w-48 px-3 py-1.5 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                disabled={loading || uniqueRegions.length === 0}
              >
                <option value="all">All Regions</option>
                {uniqueRegions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs font-medium text-white whitespace-nowrap">
                Date:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || undefined}
                className="px-2 py-1.5 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                disabled={loading}
              />
              <span className="text-white text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                className="px-2 py-1.5 text-sm border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-800 font-medium text-sm">Error</p>
            <p className="text-red-600 text-xs">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <LoadingSpinner />
          </div>
        )}

        {/* Data Table */}
        {!loading && !error && data.length > 0 && (
          <TeamPerformanceTable 
            data={data} 
            selectedRegion={selectedRegion}
            startDate={startDate}
            endDate={endDate}
          />
        )}

        {/* Empty State */}
        {!loading && !error && data.length === 0 && selectedSheet && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-600 text-sm">No data found in the selected report</p>
          </div>
        )}
    </div>
  )
}
