import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, createVerificationCode } from '@/lib/googleSheets'
import { sendVerificationEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await getUserByEmail(email)
    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json(
        { success: true, message: 'If the email exists, a verification code has been sent.' },
        { status: 200 }
      )
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // Save verification code
    await createVerificationCode(email, code, 'password_reset')

    // Send email
    await sendVerificationEmail(email, code, 'password_reset')

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
    })

  } catch (error) {

    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    )
  }
}
