'use client'

import React, { useState } from 'react'
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
  Circle
} from 'lucide-react'

interface SidebarProps {
  collapsed: boolean
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

const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const pathname = usePathname()
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)

  const menuItems: MenuItem[] = [
    {
      icon: <Home className="h-4 w-4" />,
      label: 'Dashboard',
      href: '/'
    },
    {
      icon: <Calendar className="h-4 w-4" />,
      label: 'Daily Plan',
      href: '/daily-plan'
    },
    {
      icon: <Users className="h-4 w-4" />,
      label: 'Absensi',
      href: '/absensi'
    },
    {
      icon: <BarChart3 className="h-4 w-4" />,
      label: 'Reports',
      href: '/reports'
    },
    {
      icon: <Database className="h-4 w-4" />,
      label: 'Projects',
      submenu: [
        { label: 'ITC Huawei', href: '/itc-huawei' },
        { label: 'ITC ZTE', href: '/itc-zte' },
        { label: 'RNO Huawei', href: '/rno-huawei' },
        { label: 'RNO ZTE', href: '/rno-zte' }
      ]
    },
    {
      icon: <FileText className="h-4 w-4" />,
      label: 'Documents',
      href: '/documents'
    },
    {
      icon: <Settings className="h-4 w-4" />,
      label: 'Settings',
      href: '/settings'
    }
  ]

  return (
    <aside 
      className={`
        bg-white border-r border-slate-200 h-full flex flex-col
        transition-[width] duration-300 ease-out
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Brand Section */}
      <div className={`h-14 flex items-center border-b border-slate-200 px-4 ${collapsed ? 'justify-center' : 'justify-start'}`}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">Z</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <span className="text-white text-sm font-bold">Z</span>
            </div>
            <span className="text-slate-800 font-semibold text-base">ZMG System</span>
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
                      ${collapsed ? 'justify-center' : ''}
                    `}
                    title={collapsed ? item.label : ''}
                  >
                    {/* Active Indicator */}
                    {isSubmenuOpen && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-600 rounded-r-full" />
                    )}
                    
                    <div className={`${isSubmenuOpen ? 'text-blue-600' : ''}`}>
                      {item.icon}
                    </div>
                    
                    {!collapsed && (
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
                      ${collapsed ? 'justify-center' : ''}
                    `}
                    title={collapsed ? item.label : ''}
                  >
                    {/* Active Indicator */}
                    {isActive && !collapsed && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-r-full" />
                    )}
                    
                    {item.icon}
                    
                    {!collapsed && (
                      <span className="font-medium text-sm flex-1">
                        {item.label}
                      </span>
                    )}

                    {/* Hover Effect */}
                    {!isActive && !collapsed && (
                      <ChevronRight className="h-3.5 w-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    )}
                  </Link>
                )}

                {/* Submenu */}
                {hasSubmenu && isSubmenuOpen && !collapsed && (
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
      {!collapsed && (
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