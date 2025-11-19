import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail } from '@/lib/googleSheets'
import bcrypt from 'bcryptjs'
import { getSheetsClient } from '@/lib/googleSheets'
import { sendLoginAlertEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Get user from Google Sheets using new structure
    const user = await getUserByEmail(email)

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if user is verified and active
    if (user.IsVerified !== 'yes') {
      return NextResponse.json(
        { success: false, message: 'Please verify your email first' },
        { status: 403 }
      )
    }

    if (user.IsActive !== 'yes') {
      return NextResponse.json(
        { success: false, message: 'Account is not active. Please contact administrator.' },
        { status: 403 }
      )
    }

    // Verify password (bcrypt comparison)
    const passwordMatch = await bcrypt.compare(password, user.Password)
    
    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Update last login timestamp
    try {
      const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
      const sheetName = process.env.GOOGLE_SHEET_NAME_USER || 'users'
      const sheets = await getSheetsClient()
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      })

      const rows = response.data.values || []
      if (rows.length === 0) return
      
      const headers = rows[0] as string[]
      const emailIndex = headers.findIndex(h => h === 'Email')
      const loginIndex = headers.findIndex(h => h === 'Login')
      
      if (emailIndex === -1 || loginIndex === -1) {
        console.error('Required columns not found in sheet')
        return
      }

      const rowIndex = rows.findIndex((row: any[]) => 
        row[emailIndex]?.toLowerCase() === email.toLowerCase()
      )
      
      if (rowIndex > 0) {
        const columnLetter = String.fromCharCode(65 + loginIndex) // Convert index to column letter (A, B, C, etc)
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!${columnLetter}${rowIndex + 1}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [[new Date().toISOString()]],
          },
        })
      }
    } catch (error) {
      console.error('Error updating last_login:', error)
      // Don't fail login if update fails
    }

    // Create response with new schema
    const userData = {
      name: user.Name,
      email: user.Email,
      region: user.Region || '',
      usertype: user.Role || 'user',
    }

    const response = NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        user: userData,
      },
      { status: 200 }
    )

    // Set cookie for session management
    response.cookies.set('user_session', JSON.stringify(userData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/'
    })

    // Send login alert email (non-blocking)
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'Unknown'
    const userAgent = request.headers.get('user-agent') || 'Unknown'
    
    // Send email asynchronously without blocking response
    sendLoginAlertEmail(user.Email, user.Name, ipAddress, userAgent).catch(err => {
      console.error('Failed to send login alert email:', err)
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
