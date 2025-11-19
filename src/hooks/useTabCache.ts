'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useTabs } from '@/contexts/TabContext'

interface UseTabCacheOptions<T> {
  fetchData: () => Promise<T>
  dependencies?: any[]
  cacheDuration?: number
}

/**
 * Custom hook to manage data caching per tab
 * Automatically fetches data on mount if cache is empty or expired
 * Stores data in tab cache to avoid refetching when switching back to tab
 */
export function useTabCache<T>(options: UseTabCacheOptions<T>) {
  const { fetchData, dependencies = [], cacheDuration } = options
  const pathname = usePathname()
  const { getTabCache, setTabCache } = useTabs()
  
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (forceRefresh = false) => {
    // Check if we have cached data
    if (!forceRefresh) {
      const cachedData = getTabCache(pathname)
      if (cachedData) {
        setData(cachedData)
        setLoading(false)
        return cachedData
      }
    }

    // Fetch fresh data
    setLoading(true)
    setError(null)
    
    try {
      const result = await fetchData()
      setData(result)
      setTabCache(pathname, result)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data'
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [pathname, fetchData, getTabCache, setTabCache])

  // Load data on mount or when dependencies change
  useEffect(() => {
    loadData()
  }, [pathname, ...dependencies])

  const refresh = useCallback(() => {
    return loadData(true)
  }, [loadData])

  return {
    data,
    loading,
    error,
    refresh,
    setData: (newData: T) => {
      setData(newData)
      setTabCache(pathname, newData)
    }
  }
}

/**
 * Simple hook to just get/set tab cache without automatic fetching
 */
export function useSimpleTabCache<T>(defaultValue?: T) {
  const pathname = usePathname()
  const { getTabCache, setTabCache, clearTabCache } = useTabs()
  
  const getCached = useCallback((): T | null => {
    return getTabCache(pathname) || defaultValue || null
  }, [pathname, getTabCache, defaultValue])

  const setCached = useCallback((data: T) => {
    setTabCache(pathname, data)
  }, [pathname, setTabCache])

  const clear = useCallback(() => {
    clearTabCache(pathname)
  }, [pathname, clearTabCache])

  return {
    getCached,
    setCached,
    clear
  }
}
