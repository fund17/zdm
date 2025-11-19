import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, createVerificationCode, checkRateLimit } from '@/lib/googleSheets'
import { sendVerificationEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json()

    // Validate required fields
    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate domain (only @zmg.co.id)
    if (!email.toLowerCase().endsWith('@zmg.co.id')) {
      return NextResponse.json(
        { error: 'Only @zmg.co.id email addresses are allowed' },
        { status: 400 }
      )
    }

    // Check rate limit
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    
    const rateLimit = await checkRateLimit(email, clientIp)
    if (!rateLimit.allowed) {
      const blockedUntil = rateLimit.blockedUntil 
        ? new Date(rateLimit.blockedUntil).toLocaleTimeString()
        : 'temporarily'
      
      return NextResponse.json(
        { 
          error: `Too many attempts. Please try again after ${blockedUntil}`,
          blockedUntil: rateLimit.blockedUntil
        },
        { status: 429 }
      )
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered. Please login instead.' },
        { status: 400 }
      )
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // Save verification code to Google Sheets
    await createVerificationCode(email, code, 'registration')

    // Send verification email
    await sendVerificationEmail(email, code, name)

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      remainingAttempts: rateLimit.remainingAttempts,
    })

  } catch (error) {
    console.error('❌ Registration error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process registration. Please try again later.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
