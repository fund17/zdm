import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, getVerificationCode, getSheetsClient, markCodeAsUsed } from '@/lib/googleSheets'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json()

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { error: 'Email, code, and new password are required' },
        { status: 400 }
      )
    }

    // Validate password
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'Password must contain at least one letter and one number' },
        { status: 400 }
      )
    }

    // Verify the code
    const verificationRecord = await getVerificationCode(email, code)

    if (!verificationRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      )
    }

    if (verificationRecord.Type !== 'password_reset') {
      return NextResponse.json(
        { error: 'Invalid verification code type' },
        { status: 400 }
      )
    }

    if (verificationRecord.UsedAt) {
      return NextResponse.json(
        { error: 'Verification code already used' },
        { status: 400 }
      )
    }

    const expiresAt = new Date(verificationRecord.ExpiresAt)
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Verification code has expired' },
        { status: 400 }
      )
    }

    // Get user
    const user = await getUserByEmail(email)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password in Google Sheets
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
    const sheetName = process.env.GOOGLE_SHEET_NAME_USER || 'users'

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Configuration error' },
        { status: 500 }
      )
    }

    const sheets = await getSheetsClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    })

    const rows = response.data.values || []
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No data found' },
        { status: 404 }
      )
    }

    const headers = rows[0] as string[]
    const emailIndex = headers.findIndex(h => h === 'Email')
    const passwordIndex = headers.findIndex(h => h === 'Password')

    if (emailIndex === -1 || passwordIndex === -1) {
      return NextResponse.json(
        { error: 'Invalid sheet structure' },
        { status: 500 }
      )
    }

    // Find user row
    const rowIndex = rows.findIndex((row: any[]) => row[emailIndex] === email)
    if (rowIndex === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update password
    const columnLetter = String.fromCharCode(65 + passwordIndex)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!${columnLetter}${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[hashedPassword]],
      },
    })

    // Mark verification code as used
    await markCodeAsUsed(email, code)

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
    })

  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}
