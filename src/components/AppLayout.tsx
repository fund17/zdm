'use client'

import React, { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import Footer from './Footer'

interface AppLayoutProps {
  children: React.ReactNode
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{
    name: string
    email: string
    region: string
    usertype: string
    isActive?: boolean
  } | null>(null)

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      // Public pages that don't require authentication
      const publicPages = ['/login', '/register', '/verify', '/set-password', '/pending-activation']
      
      // Don't check auth on public pages
      if (publicPages.includes(pathname)) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()
        
        if (data.success && data.user) {
          setIsAuthenticated(true)
          setUser(data.user)
          
          // Check if user is not active, redirect to pending activation page
          if (data.user.isActive === false) {
            router.push('/pending-activation')
            return
          }
        } else {
          setIsAuthenticated(false)
          setUser(null)
          // Redirect to login if not authenticated and not on public page
          router.push('/login')
        }
      } catch (error) {
        setIsAuthenticated(false)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [pathname, router])

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

  // Public pages that should not have sidebar/navbar
  const pagesWithoutLayout = ['/login', '/register', '/verify', '/set-password', '/pending-activation']
  
  // If on public page or not authenticated, show content without layout
  if (pagesWithoutLayout.includes(pathname) || (!isAuthenticated && !loading)) {
    return <>{children}</>
  }

  // Show loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // If user is not active, don't show sidebar/navbar (extra safety check)
  if (user && user.isActive === false) {
    return <>{children}</>
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
        <div className={`flex-none ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
          <Sidebar collapsed={sidebarCollapsed} user={user} />
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
          
          {/* Footer */}
          <div className="flex-none">
            <Footer />
          </div>
        </main>
      </div>
    </div>
  )
}

export default AppLayout