import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get('user_session')

    if (!cookie || !cookie.value) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      )
    }

    const userData = JSON.parse(cookie.value)

    return NextResponse.json(
      {
        success: true,
        user: userData,
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Invalid session' },
      { status: 401 }
    )
  }
}
