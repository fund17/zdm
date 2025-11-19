'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface Tab {
  id: string
  path: string
  label: string
  icon?: string
  cachedData?: any
  lastVisited?: number
}

interface TabContextType {
  tabs: Tab[]
  activeTabId: string | null
  addTab: (path: string, label: string, icon?: string) => void
  closeTab: (tabId: string) => void
  switchTab: (tabId: string) => void
  getTabLabel: (path: string) => string
  getTabCache: (path: string) => any
  setTabCache: (path: string, data: any) => void
  clearTabCache: (path: string) => void
}

const TabContext = createContext<TabContextType | undefined>(undefined)

const MAX_TABS = 5
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Helper function to get label from path
const getDefaultLabel = (path: string): string => {
  const pathMap: Record<string, string> = {
    '/': 'Home',
    '/dashboard/daily': 'Daily Dashboard',
    '/dashboard/itc-huawei': 'ITC Huawei',
    '/dashboard/po-huawei': 'PO Huawei',
    '/daily-plan': 'Daily Plan',
    '/itc-huawei': 'ITC Huawei Project',
    '/users': 'User Management',
    '/profile': 'Profile',
    '/absensi': 'Absensi',
  }
  return pathMap[path] || path.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Page'
}

export const TabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()

  // Initialize with current path
  useEffect(() => {
    if (pathname && tabs.length === 0) {
      const initialTab: Tab = {
        id: Date.now().toString(),
        path: pathname,
        label: getDefaultLabel(pathname),
      }
      setTabs([initialTab])
      setActiveTabId(initialTab.id)
    }
  }, [pathname, tabs.length])

  // Sync active tab with current pathname
  useEffect(() => {
    if (pathname) {
      const existingTab = tabs.find(tab => tab.path === pathname)
      if (existingTab) {
        setActiveTabId(existingTab.id)
      }
    }
  }, [pathname, tabs])

  const addTab = useCallback((path: string, label: string, icon?: string) => {
    setTabs(prevTabs => {
      // Check if tab already exists
      const existingTab = prevTabs.find(tab => tab.path === path)
      if (existingTab) {
        setActiveTabId(existingTab.id)
        return prevTabs
      }

      // If we have max tabs, remove the oldest non-active tab
      let newTabs = [...prevTabs]
      if (newTabs.length >= MAX_TABS) {
        // Find first tab that's not active
        const tabToRemove = newTabs.find(tab => tab.id !== activeTabId)
        if (tabToRemove) {
          newTabs = newTabs.filter(tab => tab.id !== tabToRemove.id)
        } else {
          // If all tabs are somehow active, remove the first one
          newTabs = newTabs.slice(1)
        }
      }

      const newTab: Tab = {
        id: Date.now().toString(),
        path,
        label: label || getDefaultLabel(path),
        icon,
      }

      setActiveTabId(newTab.id)
      return [...newTabs, newTab]
    })
  }, [activeTabId])

  const closeTab = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const newTabs = prevTabs.filter(tab => tab.id !== tabId)
      
      // If closing active tab, switch to another tab
      if (tabId === activeTabId) {
        if (newTabs.length > 0) {
          const closedTabIndex = prevTabs.findIndex(tab => tab.id === tabId)
          const nextTab = newTabs[Math.max(0, closedTabIndex - 1)]
          setActiveTabId(nextTab.id)
          router.push(nextTab.path)
        } else {
          setActiveTabId(null)
          router.push('/')
        }
      }

      return newTabs
    })
  }, [activeTabId, router])

  const switchTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (tab) {
      setActiveTabId(tabId)
      // Update lastVisited when switching to tab
      setTabs(prevTabs => 
        prevTabs.map(t => 
          t.id === tabId ? { ...t, lastVisited: Date.now() } : t
        )
      )
      router.push(tab.path)
    }
  }, [tabs, router])

  const getTabLabel = useCallback((path: string): string => {
    return getDefaultLabel(path)
  }, [])

  const getTabCache = useCallback((path: string): any => {
    const tab = tabs.find(t => t.path === path)
    if (!tab || !tab.cachedData) return null
    
    // Check if cache is still valid (within CACHE_DURATION)
    const cacheAge = Date.now() - (tab.lastVisited || 0)
    if (cacheAge > CACHE_DURATION) {
      return null // Cache expired
    }
    
    return tab.cachedData
  }, [tabs])

  const setTabCache = useCallback((path: string, data: any) => {
    setTabs(prevTabs => {
      return prevTabs.map(tab => {
        if (tab.path === path) {
          return {
            ...tab,
            cachedData: data,
            lastVisited: Date.now()
          }
        }
        return tab
      })
    })
  }, [])

  const clearTabCache = useCallback((path: string) => {
    setTabs(prevTabs => {
      return prevTabs.map(tab => {
        if (tab.path === path) {
          return {
            ...tab,
            cachedData: undefined,
            lastVisited: undefined
          }
        }
        return tab
      })
    })
  }, [])

  return (
    <TabContext.Provider value={{ tabs, activeTabId, addTab, closeTab, switchTab, getTabLabel, getTabCache, setTabCache, clearTabCache }}>
      {children}
    </TabContext.Provider>
  )
}

export const useTabs = () => {
  const context = useContext(TabContext)
  if (!context) {
    throw new Error('useTabs must be used within TabProvider')
  }
  return context
}
