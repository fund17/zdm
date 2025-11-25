'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Lock } from 'lucide-react'

type PermissionLevel = 'no' | 'read' | 'edit'

interface PermissionGuardProps {
  children: React.ReactNode
  menuKey: 'userManagement' | 'home' | 'dashboard' | 'projects' | 'absensi' | 'dailyPlan'
  requiredLevel?: 'read' | 'edit'
  fallback?: React.ReactNode
}

interface UserPermissions {
  userManagement: PermissionLevel
  home: PermissionLevel
  dashboard: PermissionLevel
  projects: PermissionLevel
  absensi: PermissionLevel
  dailyPlan: PermissionLevel
}

/**
 * PermissionGuard Component
 * Wraps page content and checks if user has required permission level
 * - If no access: Shows access denied or redirects
 * - If read-only: Can render with isReadOnly prop passed to children
 * - If edit: Full access
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  menuKey,
  requiredLevel = 'read',
  fallback
}) => {
  const router = useRouter()
  const [permissions, setPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const response = await fetch('/api/permissions')
        if (!response.ok) {
          router.push('/login')
          return
        }

        const data = await response.json()
        const userPermissions = data.permissions as UserPermissions
        setPermissions(userPermissions)

        // Check if user has required access level
        const userLevel = userPermissions[menuKey]
        
        if (userLevel === 'no') {
          setHasAccess(false)
        } else if (requiredLevel === 'edit') {
          setHasAccess(userLevel === 'edit')
        } else {
          // requiredLevel is 'read', so 'read' or 'edit' is acceptable
          setHasAccess(userLevel === 'read' || userLevel === 'edit')
        }
      } catch (error) {

        setHasAccess(false)
      } finally {
        setLoading(false)
      }
    }

    checkPermissions()
  }, [menuKey, requiredLevel, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <Lock className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Access Denied
            </h2>
            <p className="text-slate-600 mb-6">
              You don't have permission to access this page. Please contact your administrator if you believe this is an error.
            </p>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <AlertCircle className="h-4 w-4" />
              Go to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // User has access, render children
  return <>{children}</>
}

/**
 * Hook to check if user can edit in the current context
 */
export const useCanEdit = (menuKey: keyof UserPermissions): boolean => {
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    const checkEditPermission = async () => {
      try {
        const response = await fetch('/api/permissions')
        if (response.ok) {
          const data = await response.json()
          const userLevel = data.permissions[menuKey] as PermissionLevel
          setCanEdit(userLevel === 'edit')
        }
      } catch (error) {

      }
    }

    checkEditPermission()
  }, [menuKey])

  return canEdit
}

/**
 * Hook to get user's permission level for a menu
 */
export const usePermissionLevel = (menuKey: keyof UserPermissions): PermissionLevel | null => {
  const [level, setLevel] = useState<PermissionLevel | null>(null)

  useEffect(() => {
    const fetchLevel = async () => {
      try {
        const response = await fetch('/api/permissions')
        if (response.ok) {
          const data = await response.json()
          setLevel(data.permissions[menuKey] as PermissionLevel)
        }
      } catch (error) {

      }
    }

    fetchLevel()
  }, [menuKey])

  return level
}
