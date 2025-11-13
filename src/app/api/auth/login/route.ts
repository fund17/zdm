import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
    const sheetName = process.env.GOOGLE_SHEET_NAME_USER || 'new_user'

    // Fetch user data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:G`, // name, email, pass, region, usertype, status, last_login
    })

    const rows = response.data.values

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No user data found' },
        { status: 404 }
      )
    }

    // Find user (skip header row)
    const userRow = rows.slice(1).find((row) => row[1] === email)

    if (!userRow) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const [name, userEmail, userPass, region, usertype, status] = userRow

    // Check if user is active
    if (status !== 'active') {
      return NextResponse.json(
        { success: false, message: 'Account is not active' },
        { status: 403 }
      )
    }

    // Verify password (plain text comparison - consider hashing in production)
    if (userPass !== password) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Update last_login timestamp
    const rowIndex = rows.findIndex((row) => row[1] === email)
    if (rowIndex > 0) {
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!G${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })]],
          },
        })
      } catch (error) {
        console.error('Error updating last_login:', error)
        // Don't fail login if update fails
      }
    }

    // Create user session data
    const userData = {
      name,
      email: userEmail,
      region,
      usertype,
      status,
    }

    // Create response with user data
    const response_json = NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        user: userData,
      },
      { status: 200 }
    )

    // Set cookie for session (valid for 7 days)
    response_json.cookies.set('user_session', JSON.stringify(userData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response_json
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
