import { NextResponse } from 'next/server'
import { clearPermissionsCache } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/permissions/clear-cache
 * Clear the permissions cache (admin only)
 */
export async function POST() {
  try {
    clearPermissionsCache()
    
    return NextResponse.json({
      success: true,
      message: 'Permissions cache cleared successfully'
    })
  } catch (error) {
    console.error('Error clearing permissions cache:', error)
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    )
  }
}
