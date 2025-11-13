'use client'

import React, { useState, useEffect } from 'react'
import { Menu, X, User, LogOut, Settings, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface NavbarProps {
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
}

interface UserData {
  name: string
  email: string
  region: string
  usertype: string
  status: string
}

const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, sidebarCollapsed }) => {
  const router = useRouter()
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch user session
    const fetchUserSession = async () => {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()
        
        if (data.success && data.user) {
          setUser(data.user)
        }
      } catch (error) {
        console.error('Failed to fetch user session:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserSession()
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return 'U'
    return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between shadow-sm h-14">
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? (
            <Menu className="h-4 w-4 text-gray-600" />
          ) : (
            <X className="h-4 w-4 text-gray-600" />
          )}
        </button>
        
        <div className="text-xl font-bold text-gray-800">
          ZMG
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
          className="flex items-center space-x-2 p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-xs font-bold text-white">{getUserInitials()}</span>
          </div>
          <span className="text-sm text-gray-700 font-medium hidden md:block">
            {loading ? 'Loading...' : user?.name || 'User'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
        </button>

        {profileDropdownOpen && user && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setProfileDropdownOpen(false)}
            />
            
            {/* Dropdown */}
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border-2 border-slate-100 z-50">
              <div className="py-1">
                {/* User Info */}
                <div className="px-4 py-3 border-b-2 border-slate-100">
                  <div className="font-bold text-sm text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md">
                      {user.usertype}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md">
                      {user.region}
                    </span>
                  </div>
                </div>
                
                {/* Profile */}
                <button 
                  onClick={() => {
                    setProfileDropdownOpen(false)
                    router.push('/profile')
                  }}
                  className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <User className="h-4 w-4 mr-2.5" />
                  Profile
                </button>
                
                {/* Settings */}
                <button className="flex items-center w-full px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <Settings className="h-4 w-4 mr-2.5" />
                  Settings
                </button>
                
                {/* Logout */}
                <button 
                  onClick={handleLogout}
                  className="flex items-center w-full px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors border-t-2 border-slate-100"
                >
                  <LogOut className="h-4 w-4 mr-2.5" />
                  Logout
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  )
}

export default Navbar