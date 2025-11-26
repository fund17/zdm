import { NextRequest, NextResponse } from 'next/server'
import { getVerificationCode, markCodeAsUsed } from '@/lib/googleSheets'
import { SignJWT } from 'jose'

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    // Validate required fields
    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      )
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid code format. Code must be 6 digits.' },
        { status: 400 }
      )
    }

    // Get verification code from Google Sheets
    const verificationCode = await getVerificationCode(email, code)

    if (!verificationCode) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      )
    }

    // Mark code as used
    await markCodeAsUsed(email, code)

    // Generate temporary token for password setup (valid for 15 minutes)
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'your-secret-key-change-this'
    )

    const token = await new SignJWT({ 
      email, 
      type: 'password_setup',
      exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secret)

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      token,
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to verify code. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
