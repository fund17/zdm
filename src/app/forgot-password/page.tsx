'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, ArrowLeft, Lock, AlertCircle, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'verify' | 'newpassword'>('email')
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Verification code has been sent to your email')
        setTimeout(() => {
          setStep('verify')
          setMessage('')
        }, 1500)
      } else {
        setError(data.error || 'Failed to send verification code')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Code verified successfully')
        setTimeout(() => {
          setStep('newpassword')
          setMessage('')
        }, 1000)
      } else {
        setError(data.error || 'Invalid verification code')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Password must contain at least one letter and one number')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode, newPassword }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Password reset successfully! Redirecting to login...')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        setError(data.error || 'Failed to reset password')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('New verification code sent to your email')
      } else {
        setError(data.error || 'Failed to resend code')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 mb-4">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {step === 'email' && 'Forgot Password'}
              {step === 'verify' && 'Verify Code'}
              {step === 'newpassword' && 'Reset Password'}
            </h2>
            <p className="text-gray-600 mt-2">
              {step === 'email' && 'Enter your email to receive a verification code'}
              {step === 'verify' && 'Enter the 6-digit code sent to your email'}
              {step === 'newpassword' && 'Create a new password for your account'}
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{message}</p>
            </div>
          )}

          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleSendCode}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </form>
          )}

          {/* Step 2: Verify Code */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyCode}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Code sent to {email}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                >
                  Resend Code
                </button>
              </div>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 'newpassword' && (
            <form onSubmit={handleResetPassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter new password"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  At least 8 characters with letters and numbers
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm new password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
