import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail } from '@/lib/googleSheets'

export async function GET(request: NextRequest) {
  try {
    // Get user session from cookie
    const cookie = request.cookies.get('user_session')
    if (!cookie) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      )
    }

    const userData = JSON.parse(cookie.value)
    const userEmail = userData.email

    // Get full user data from Google Sheets
    const user = await getUserByEmail(userEmail)

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      )
    }

    // Format dates
    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'N/A'
      try {
        // Handle both ISO format and MM/DD/YYYY format
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return dateStr // Return as-is if not valid date
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })
      } catch {
        return dateStr
      }
    }

    const formatDateTime = (isoDate: string) => {
      if (!isoDate) return 'N/A'
      try {
        const date = new Date(isoDate)
        if (isNaN(date.getTime())) return 'N/A'
        return date.toLocaleString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      } catch {
        return 'N/A'
      }
    }

    // Return user profile with all details
    return NextResponse.json(
      {
        success: true,
        user: {
          name: user.Name,
          email: user.Email,
          region: user.Region || 'Not specified',
          usertype: user.Role || 'user',
          status: user.IsActive === 'yes' ? 'Active' : 'Inactive',
          phone: user.phoneNo || '',
          department: user.departement || '',
          joinDate: formatDate(user.registerDate),
          lastLogin: formatDateTime(user.Login),
          isVerified: user.IsVerified === 'yes',
          isActive: user.IsActive === 'yes',
          loginAlerts: true, // Default value, can be stored in future
        },
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
