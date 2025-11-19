import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, createUser } from '@/lib/googleSheets'
import { sendWelcomeEmail } from '@/lib/email'
import { jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { token, password, name, region } = await request.json()

    // Validate required fields
    if (!token || !password || !name) {
      return NextResponse.json(
        { error: 'Token, password, and name are required' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Password must contain at least one letter and one number
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain at least one letter and one number' },
        { status: 400 }
      )
    }

    // Verify JWT token
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'your-secret-key-change-this'
    )

    let email: string
    try {
      const { payload } = await jwtVerify(token, secret)
      
      if (payload.type !== 'password_setup') {
        return NextResponse.json(
          { error: 'Invalid token type' },
          { status: 400 }
        )
      }

      email = payload.email as string
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token. Please request a new verification code.' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists. Please login instead.' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user in Google Sheets
    await createUser(email, name, hashedPassword, region || '')

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name).catch(err => console.error('Welcome email error:', err))

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. You can now login.',
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to create account. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
