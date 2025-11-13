'use client'

import React, { useState, useEffect } from 'react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

interface AppLayoutProps {
  children: React.ReactNode
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      // Keep sidebar collapsed on mobile but don't force it on desktop
      if (mobile) {
        setSidebarCollapsed(true)
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Navbar - Fixed */}
      <div className="flex-none z-50">
        <Navbar 
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="flex-none">
          <Sidebar collapsed={sidebarCollapsed} />
        </div>

        {/* Mobile overlay when sidebar is open */}
        {isMobile && !sidebarCollapsed && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* Main content - Fixed height, no scroll */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-6 overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout