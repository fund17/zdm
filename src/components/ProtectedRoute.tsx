'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MenuKey } from '@/lib/permissions'

interface UserData {
  name: string
  email: string
  region: string
  usertype: string
  status: string
  role: string
}

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedUserTypes?: string[]
  requiredMenu?: MenuKey
}

export default function ProtectedRoute({ children, allowedUserTypes, requiredMenu }: ProtectedRouteProps) {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()

        if (!data.success || !data.user) {
          // Not authenticated
          router.push('/login')
          return
        }

        setUser(data.user)

        // Check if user type is allowed (legacy check)
        if (allowedUserTypes && allowedUserTypes.length > 0) {
          if (!allowedUserTypes.includes(data.user.usertype)) {
            // User type not allowed
            router.push('/')
            return
          }
        }

        // Check menu permission
        if (requiredMenu) {
          const permResponse = await fetch('/api/permissions')
          if (permResponse.ok) {
            const permData = await permResponse.json()
            const permissions = permData.permissions

            // Map menu name to permission key
            const menuPermissionMap: Record<MenuKey, keyof typeof permissions> = {
              'User management': 'userManagement',
              'Home': 'home',
              'Dashboard': 'dashboard',
              'Projects': 'projects',
              'Absensi': 'absensi',
              'Daily Plan': 'dailyPlan',
              'File Upload Center': 'fileUploadCenter',
            }

            const permKey = menuPermissionMap[requiredMenu]
            if (permKey && permissions[permKey] === 'no') {
              // No access to this menu
              router.push('/')
              return
            }
          }
        }

        setAuthorized(true)
      } catch (error) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router, allowedUserTypes, requiredMenu])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-semibold text-slate-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!authorized) {
    return null
  }

  return <>{children}</>
}
