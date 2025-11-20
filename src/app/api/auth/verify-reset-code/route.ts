import { NextRequest, NextResponse } from 'next/server'
import { getVerificationCode } from '@/lib/googleSheets'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
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

    // Check if code is for password reset
    if (verificationRecord.Type !== 'password_reset') {
      return NextResponse.json(
        { error: 'Invalid verification code type' },
        { status: 400 }
      )
    }

    // Check if already used
    if (verificationRecord.UsedAt) {
      return NextResponse.json(
        { error: 'Verification code already used' },
        { status: 400 }
      )
    }

    // Check if expired (15 minutes)
    const expiresAt = new Date(verificationRecord.ExpiresAt)
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Verification code has expired' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code is valid',
    })

  } catch (error) {
    console.error('Verify reset code error:', error)
    return NextResponse.json(
      { error: 'Failed to verify code' },
      { status: 500 }
    )
  }
}
