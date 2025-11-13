'use client'

import React, { useState } from 'react'
import { Menu, X, User, LogOut, Settings, ChevronDown } from 'lucide-react'

interface NavbarProps {
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
}

const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, sidebarCollapsed }) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

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
          <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm text-gray-700 hidden md:block">Admin</span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
        </button>

        {profileDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
            <div className="py-1">
              <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                <div className="font-medium">Administrator</div>
                <div className="text-gray-500">admin@zmg.com</div>
              </div>
              
              <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </button>
              
              <button className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar