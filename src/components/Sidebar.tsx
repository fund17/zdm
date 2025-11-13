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
  ChevronDown,
  Database
} from 'lucide-react'

interface SidebarProps {
  collapsed: boolean
}

interface MenuItem {
  icon: React.ReactNode
  label: string
  href?: string
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
      icon: <Home className="h-5 w-5" />,
      label: 'Dashboard',
      href: '/'
    },
    {
      icon: <Calendar className="h-5 w-5" />,
      label: 'Daily Plan',
      href: '/daily-plan'
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: 'Absensi',
      href: '/absensi'
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      label: 'Reports',
      href: '/reports'
    },
    {
      icon: <Database className="h-5 w-5" />,
      label: 'Project Management',
      submenu: [
        {
          label: 'ITC HUAWEI',
          href: '/itc-huawei'
        },
        {
          label: 'ITC ZTE',
          href: '/itc-zte'
        },
        {
          label: 'RNO HUAWEI',
          href: '/rno-huawei'
        },
        {
          label: 'RNO ZTE',
          href: '/rno-zte'
        }
      ]
    },
    {
      icon: <FileText className="h-5 w-5" />,
      label: 'Documents',
      href: '/documents'
    },
    {
      icon: <Settings className="h-5 w-5" />,
      label: 'Settings',
      href: '/settings'
    }
  ]

  return (
    <aside 
      className={`
        bg-gray-900 text-white transition-all duration-300 ease-in-out h-full
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      <div className="p-3">
        <nav className="space-y-1">
          {menuItems.map((item, index) => {
            // Check if item has submenu or direct href
            const hasSubmenu = item.submenu && item.submenu.length > 0
            const isSubmenuOpen = openSubmenu === item.label
            const isActive = !hasSubmenu && pathname === item.href
            
            return (
              <div key={index}>
                {/* Render as button if has submenu, Link if direct href */}
                {hasSubmenu ? (
                  <button
                    onClick={() => setOpenSubmenu(isSubmenuOpen ? null : item.label)}
                    className={`
                      w-full flex items-center p-2.5 rounded-lg transition-all duration-200 group
                      ${isSubmenuOpen 
                        ? 'bg-gray-800 text-white' 
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }
                      ${collapsed ? 'justify-center' : 'space-x-3'}
                    `}
                    title={collapsed ? item.label : ''}
                  >
                    <span className="flex-shrink-0">
                      {item.icon}
                    </span>
                    
                    {!collapsed && (
                      <>
                        <span className="font-medium text-sm">{item.label}</span>
                        <ChevronDown 
                          className={`h-3.5 w-3.5 ml-auto transition-transform duration-200 ${isSubmenuOpen ? 'rotate-180' : ''}`} 
                        />
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href!}
                    className={`
                      flex items-center p-2.5 rounded-lg transition-all duration-200 group
                      ${isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }
                      ${collapsed ? 'justify-center' : 'space-x-3'}
                    `}
                    title={collapsed ? item.label : ''}
                  >
                    <span className="flex-shrink-0">
                      {item.icon}
                    </span>
                    
                    {!collapsed && (
                      <>
                        <span className="font-medium text-sm">{item.label}</span>
                        <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50 group-hover:opacity-100 transition-opacity" />
                      </>
                    )}
                  </Link>
                )}

                {/* Render submenu items when open */}
                {hasSubmenu && isSubmenuOpen && !collapsed && (
                  <div className="mt-1 ml-4 space-y-1">
                    {item.submenu!.map((subItem, subIndex) => {
                      const isSubActive = pathname === subItem.href
                      return (
                        <Link
                          key={subIndex}
                          href={subItem.href}
                          className={`
                            flex items-center p-2 pl-4 rounded-lg transition-all duration-200
                            ${isSubActive 
                              ? 'bg-blue-600 text-white' 
                              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }
                          `}
                        >
                          <span className="text-sm">{subItem.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar