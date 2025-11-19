'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, ArrowRight, AlertCircle, CheckCircle2, RefreshCcw } from 'lucide-react'
import Link from 'next/link'

function VerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [resending, setResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const email = searchParams.get('email') || ''
  const name = searchParams.get('name') || ''

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return // Only allow digits

    const newCode = [...code]
    newCode[index] = value.slice(-1) // Take only last character
    setCode(newCode)

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newCode = [...code]
    
    for (let i = 0; i < pastedData.length; i++) {
      newCode[i] = pastedData[i]
    }
    
    setCode(newCode)
    
    // Focus last filled input or first empty
    const nextIndex = Math.min(pastedData.length, 5)
    inputRefs.current[nextIndex]?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullCode = code.join('')
    
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits')
      return
    }

    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code: fullCode }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        // Redirect to set-password page with token
        setTimeout(() => {
          router.push(`/set-password?token=${data.token}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`)
        }, 1500)
      } else {
        setError(data.error || 'Verification failed')
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch (error) {
      console.error('Verification error:', error)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError('')

    try {
      const response = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name }),
      })

      const data = await response.json()

      if (data.success) {
        setError('')
        alert('New verification code sent to your email!')
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      } else {
        setError(data.error || 'Failed to resend code')
      }
    } catch (error) {
      console.error('Resend error:', error)
      setError('Failed to resend code. Please try again.')
    } finally {
      setResending(false)
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Invalid verification link</p>
          <Link href="/register" className="text-blue-600 hover:underline font-semibold">
            Go to registration
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl"></div>
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-100 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 mb-2">Verify Email</h1>
            <p className="text-sm text-slate-500">
              We sent a 6-digit code to<br />
              <span className="font-semibold text-slate-700">{email}</span>
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Email verified!</p>
                  <p className="text-xs text-emerald-600 mt-1">Redirecting to password setup...</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-rose-50 border-2 border-rose-200 rounded-xl p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-rose-600 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-semibold text-rose-700">{error}</p>
              </div>
            </div>
          )}

          {/* Code Input Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={loading || success}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
              ))}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success || code.join('').length !== 6}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Verifying...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm">Verified!</span>
                </>
              ) : (
                <>
                  <span className="text-sm">Verify Code</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Resend Code */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600 mb-2">                  Didn&apos;t receive the code?{' '}</p>
            <button
              onClick={handleResend}
              disabled={resending || loading || success}
              className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {resending ? (
                <>
                  <div className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <RefreshCcw className="h-4 w-4" />
                  <span>Resend Code</span>
                </>
              )}
            </button>
          </div>

          {/* Back Link */}
          <div className="mt-4 text-center">
            <Link href="/register" className="text-sm text-slate-500 hover:text-slate-700">
              ← Back to registration
            </Link>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Code expires in 15 minutes
          </p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    }>
      <VerifyForm />
    </Suspense>
  )
}
