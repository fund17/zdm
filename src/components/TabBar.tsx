'use client'

import React from 'react'
import { useTabs } from '@/contexts/TabContext'
import { X, Home, BarChart3, Calendar, Database, Users, Shield, User } from 'lucide-react'

const iconMap: Record<string, React.ReactNode> = {
  home: <Home className="h-3.5 w-3.5" />,
  dashboard: <BarChart3 className="h-3.5 w-3.5" />,
  calendar: <Calendar className="h-3.5 w-3.5" />,
  database: <Database className="h-3.5 w-3.5" />,
  users: <Users className="h-3.5 w-3.5" />,
  shield: <Shield className="h-3.5 w-3.5" />,
  user: <User className="h-3.5 w-3.5" />,
}

const getIconForPath = (path: string): React.ReactNode => {
  if (path === '/') return iconMap.home
  if (path.startsWith('/dashboard')) return iconMap.dashboard
  if (path.startsWith('/daily-plan')) return iconMap.calendar
  if (path.startsWith('/itc-huawei') || path.startsWith('/rno-')) return iconMap.database
  if (path.startsWith('/users')) return iconMap.shield
  if (path.startsWith('/absensi')) return iconMap.users
  if (path.startsWith('/profile')) return iconMap.user
  return iconMap.home
}

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, closeTab, switchTab } = useTabs()

  if (tabs.length === 0) {
    return null
  }

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center overflow-x-auto scrollbar-hide">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId
          const icon = getIconForPath(tab.path)

          return (
            <div
              key={tab.id}
              className={`
                group relative flex items-center gap-2 px-4 py-2.5 min-w-[140px] max-w-[200px]
                cursor-pointer transition-all duration-150 border-r border-gray-200
                ${isActive 
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-b-blue-500' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
              onClick={() => switchTab(tab.id)}
            >
              {/* Icon */}
              <div className={`flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                {icon}
              </div>

              {/* Label */}
              <span className="flex-1 text-sm font-medium truncate">
                {tab.label}
              </span>

              {/* Close button */}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  className={`
                    flex-shrink-0 p-0.5 rounded transition-colors
                    ${isActive 
                      ? 'hover:bg-blue-200 text-blue-600' 
                      : 'hover:bg-gray-200 text-gray-400'
                    }
                    opacity-0 group-hover:opacity-100
                  `}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Active indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </div>
          )
        })}

        {/* Tab count indicator */}
        {tabs.length > 0 && (
          <div className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
            {tabs.length}/5 tabs
          </div>
        )}
      </div>

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
