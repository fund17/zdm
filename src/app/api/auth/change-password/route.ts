import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, getSheetsClient } from '@/lib/googleSheets'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: 'New password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { success: false, message: 'Password must contain both letters and numbers' },
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

    // Get user from Google Sheets
    const user = await getUserByEmail(userEmail)

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      )
    }

    // Verify current password with bcrypt
    const passwordMatch = await bcrypt.compare(currentPassword, user.Password)
    
    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, message: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password in Google Sheets
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
    const sheetName = process.env.GOOGLE_SHEET_NAME_USER || 'users'
    const sheets = await getSheetsClient()

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    })

    const rows = response.data.values || []
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'User data not found' },
        { status: 404 }
      )
    }

    const headers = rows[0] as string[]
    const emailIndex = headers.findIndex(h => h === 'Email')
    const passwordIndex = headers.findIndex(h => h === 'Password')

    if (emailIndex === -1 || passwordIndex === -1) {
      return NextResponse.json(
        { success: false, message: 'Required columns not found in sheet' },
        { status: 500 }
      )
    }

    const rowIndex = rows.findIndex((row: any[]) => 
      row[emailIndex]?.toLowerCase() === userEmail.toLowerCase()
    )

    if (rowIndex <= 0) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      )
    }

    const columnLetter = String.fromCharCode(65 + passwordIndex) // Convert index to column letter
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!${columnLetter}${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[hashedPassword]],
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
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
