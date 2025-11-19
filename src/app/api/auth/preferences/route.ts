import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Get user session from cookie
    const cookie = request.cookies.get('user_session')
    if (!cookie) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { loginAlerts } = await request.json()
    
    // For now, just return success
    // In future, can save to Google Sheets user preferences column
    console.log('Login alerts preference updated:', loginAlerts)

    return NextResponse.json(
      {
        success: true,
        message: 'Preferences updated successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Preferences update error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
