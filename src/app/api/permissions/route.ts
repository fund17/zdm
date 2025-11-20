import { NextRequest, NextResponse } from 'next/server'
import { getPermissionsForRole } from '@/lib/permissions'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/permissions
 * Get permissions for the current user based on their role
 */
export async function GET(request: NextRequest) {
  try {
    // Get user session from cookie
    const userSessionCookie = request.cookies.get('user_session')
    
    if (!userSessionCookie) {
      return NextResponse.json(
        { error: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    // Parse user session
    let userSession
    try {
      userSession = JSON.parse(userSessionCookie.value)
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid session data' },
        { status: 401 }
      )
    }

    const userRole = userSession.usertype || 'user'

    // Fetch permissions for user's role
    const permissions = await getPermissionsForRole(userRole)

    if (!permissions) {
      return NextResponse.json(
        { error: 'Role not found in permissions table' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      role: userRole,
      permissions: {
        userManagement: permissions.userManagement,
        home: permissions.home,
        dashboard: permissions.dashboard,
        projects: permissions.projects,
        absensi: permissions.absensi,
        dailyPlan: permissions.dailyPlan,
      }
    })

  } catch (error) {
    console.error('Error fetching permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
