import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Current password and new password are required' },
        { status: 400 }
      )
    }

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
        { success: false, message: 'User data not found' },
        { status: 404 }
      )
    }

    // Find user row
    const rowIndex = rows.findIndex((row) => row[1] === userEmail)

    if (rowIndex === -1 || rowIndex === 0) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      )
    }

    const userRow = rows[rowIndex]
    const storedPassword = userRow[2]

    // Verify current password
    if (storedPassword !== currentPassword) {
      return NextResponse.json(
        { success: false, message: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Update password in Google Sheets
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!C${rowIndex + 1}`, // Column C is password
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[newPassword]],
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Password changed successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
