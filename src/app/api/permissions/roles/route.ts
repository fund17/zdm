import { NextResponse } from 'next/server'
import { fetchRolePermissions } from '@/lib/permissions'

/**
 * GET /api/permissions/roles
 * Get list of available roles from rolePermission sheet
 */
export async function GET() {
  try {
    const permissions = await fetchRolePermissions()
    const roles = permissions.map(p => p.role)

    return NextResponse.json({
      success: true,
      roles
    })

  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
