'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Home, 
  Calendar, 
  Users, 
  FileText, 
  BarChart3, 
  Settings,
  ChevronRight,
  Database,
  Circle,
  User,
  Shield,
  Upload
} from 'lucide-react'

interface SidebarProps {
  collapsed: boolean
  user?: {
    name: string
    email: string
    region: string
    usertype: string
  } | null
}

interface UserPermissions {
  userManagement: 'no' | 'read' | 'edit'
  home: 'no' | 'read' | 'edit'
  dashboard: 'no' | 'read' | 'edit'
  projects: 'no' | 'read' | 'edit'
  absensi: 'no' | 'read' | 'edit'
  dailyPlan: 'no' | 'read' | 'edit'
  fileUploadCenter: 'no' | 'read' | 'edit'
}

interface MenuItem {
  icon: React.ReactNode
  label: string
  href?: string
  badge?: string
  submenu?: SubMenuItem[]
}

interface SubMenuItem {
  label: string
  href: string
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, user }) => {
  const pathname = usePathname()
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [loadingPermissions, setLoadingPermissions] = useState(true)

  // Fetch user permissions
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const response = await fetch('/api/permissions')
        if (response.ok) {
          const data = await response.json()
          setPermissions(data.permissions)
        }
      } catch (error) {
        console.error('Error fetching permissions:', error)
      } finally {
        setLoadingPermissions(false)
      }
    }

    if (user) {
      fetchPermissions()
    } else {
      setLoadingPermissions(false)
    }
  }, [user])

  // Determine if sidebar should show text (expanded state)
  const isExpanded = !collapsed || isHovered

  // Helper function to check if menu should be shown
  const shouldShowMenu = (permissionKey: keyof UserPermissions): boolean => {
    if (!permissions) return false
    return permissions[permissionKey] !== 'no'
  }

  const menuItems: MenuItem[] = []

  // Home
  if (shouldShowMenu('home')) {
    menuItems.push({
      icon: <Home className="h-4 w-4" />,
      label: 'Home',
      href: '/'
    })
  }

  // Dashboards
  if (shouldShowMenu('dashboard')) {
    menuItems.push({
      icon: <BarChart3 className="h-4 w-4" />,
      label: 'Dashboards',
      submenu: [
        { label: 'Daily Dashboard', href: '/dashboard/daily' },
        { label: 'ITC Huawei', href: '/dashboard/itc-huawei' },
        { label: 'PO Huawei', href: '/dashboard/po-huawei' }
      ]
    })
  }

  // Daily Plan
  if (shouldShowMenu('dailyPlan')) {
    menuItems.push({
      icon: <Calendar className="h-4 w-4" />,
      label: 'Daily Plan',
      href: '/daily-plan'
    })
  }

  // Projects
  if (shouldShowMenu('projects')) {
    menuItems.push({
      icon: <Database className="h-4 w-4" />,
      label: 'Projects',
      submenu: [
        { label: 'ITC Huawei', href: '/itc-huawei' },
        { label: 'ITC ZTE', href: '/itc-zte' },
        { label: 'RNO Huawei', href: '/rno-huawei' },
        { label: 'RNO ZTE', href: '/rno-zte' }
      ]
    })
  }

  // Absensi
  if (shouldShowMenu('absensi')) {
    menuItems.push({
      icon: <Users className="h-4 w-4" />,
      label: 'Absensi',
      href: '/absensi'
    })
  }

  // User Management (admin only)
  if (shouldShowMenu('userManagement')) {
    menuItems.push({
      icon: <Shield className="h-4 w-4" />,
      label: 'User Management',
      href: '/users'
    })
  }

  // File Upload Center
  if (shouldShowMenu('fileUploadCenter')) {
    menuItems.push({
      icon: <Upload className="h-4 w-4" />,
      label: 'File Upload Center',
      href: '/file-upload'
    })
  }

  return (
    <aside 
      className={`
        bg-white border-r border-slate-200 h-full flex flex-col
        transition-all duration-300 ease-out shadow-lg
        ${collapsed && !isHovered ? 'w-16' : 'w-64'}
        ${collapsed ? 'fixed left-0 top-14 z-40' : 'relative z-auto shadow-none'}
      `}
      onMouseEnter={() => collapsed && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* User Profile Section */}
      <div className={`h-16 flex items-center border-b border-slate-200 px-4 ${!isExpanded ? 'justify-center' : 'justify-start'}`}>
        {!isExpanded ? (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <User className="h-4 w-4 text-white" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <User className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {user?.name || 'User'}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {user?.region || 'Region'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {menuItems.map((item, index) => {
            const hasSubmenu = item.submenu && item.submenu.length > 0
            const isSubmenuOpen = openSubmenu === item.label
            const isActive = !hasSubmenu && pathname === item.href
            
            return (
              <div key={index}>
                {/* Main Menu Item */}
                {hasSubmenu ? (
                  <button
                    onClick={() => setOpenSubmenu(isSubmenuOpen ? null : item.label)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg
                      transition-all duration-150 group relative
                      ${isSubmenuOpen 
                        ? 'bg-slate-100 text-slate-900' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }
                      ${!isExpanded ? 'justify-center' : ''}
                    `}
                    title={!isExpanded ? item.label : ''}
                  >
                    {/* Active Indicator */}
                    {isSubmenuOpen && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-600 rounded-r-full" />
                    )}
                    
                    <div className={`${isSubmenuOpen ? 'text-blue-600' : ''}`}>
                      {item.icon}
                    </div>
                    
                    {isExpanded && (
                      <>
                        <span className="font-medium text-sm flex-1 text-left">
                          {item.label}
                        </span>
                        <ChevronRight 
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${isSubmenuOpen ? 'rotate-90' : ''}`} 
                        />
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href!}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg
                      transition-all duration-150 group relative
                      ${isActive 
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-200' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }
                      ${!isExpanded ? 'justify-center' : ''}
                    `}
                    title={!isExpanded ? item.label : ''}
                  >
                    {/* Active Indicator */}
                    {isActive && isExpanded && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-r-full" />
                    )}
                    
                    {item.icon}
                    
                    {isExpanded && (
                      <span className="font-medium text-sm flex-1">
                        {item.label}
                      </span>
                    )}

                    {/* Hover Effect */}
                    {!isActive && isExpanded && (
                      <ChevronRight className="h-3.5 w-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    )}
                  </Link>
                )}

                {/* Submenu */}
                {hasSubmenu && isSubmenuOpen && isExpanded && (
                  <div className="mt-0.5 ml-7 space-y-0.5 border-l-2 border-slate-200 pl-3 py-1 animate-slideDown">
                    {item.submenu!.map((subItem, subIndex) => {
                      const isSubActive = pathname === subItem.href
                      return (
                        <Link
                          key={subIndex}
                          href={subItem.href}
                          className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-md text-xs
                            transition-all duration-150 group relative
                            ${isSubActive 
                              ? 'bg-blue-50 text-blue-700 font-medium' 
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                            }
                          `}
                        >
                          <Circle className={`h-1.5 w-1.5 ${isSubActive ? 'fill-blue-600' : 'fill-slate-400'}`} />
                          <span className="flex-1">{subItem.label}</span>
                          {isSubActive && (
                            <div className="w-1 h-1 rounded-full bg-blue-600" />
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Footer - Optional User Info */}
      {isExpanded && (
        <div className="border-t border-slate-200 p-3">
          <div className="text-[10px] text-slate-400 text-center">
            © 2024 ZMG System
          </div>
        </div>
      )}
    </aside>
  )
}

export default Sidebar