'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, MapPin } from 'lucide-react'
import Link from 'next/link'

function SetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [region, setRegion] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const token = searchParams.get('token') || ''
  const email = searchParams.get('email') || ''
  const name = searchParams.get('name') || ''

  const validatePassword = (pwd: string) => {
    const errors = []
    if (pwd.length < 8) errors.push('at least 8 characters')
    if (!/[a-zA-Z]/.test(pwd)) errors.push('at least one letter')
    if (!/[0-9]/.test(pwd)) errors.push('at least one number')
    return errors
  }

  const passwordErrors = password ? validatePassword(password) : []
  const passwordsMatch = password && confirmPassword && password === confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate password
    if (passwordErrors.length > 0) {
      setError(`Password must contain ${passwordErrors.join(', ')}`)
      return
    }

    // Validate password match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password, name, region }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push('/login?registered=true')
        }, 2000)
      } else {
        setError(data.error || 'Failed to create account')
      }
    } catch (error) {
      console.error('Set password error:', error)
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Invalid or expired link</p>
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
              <Lock className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 mb-2">Set Password</h1>
            <p className="text-sm text-slate-500">
              Create a secure password for<br />
              <span className="font-semibold text-slate-700">{email}</span>
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Account created successfully!</p>
                  <p className="text-xs text-emerald-600 mt-1">Redirecting to login...</p>
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Region Field (Optional) */}
            <div className="space-y-2">
              <label htmlFor="region" className="block text-sm font-bold text-slate-700">
                Region <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="region"
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  placeholder="e.g., Bali Nusra, Jakarta"
                  disabled={loading || success}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-bold text-slate-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-12 py-3 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  placeholder="••••••••"
                  disabled={loading || success}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={loading || success}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {password && passwordErrors.length > 0 && (
                <p className="text-xs text-rose-600">
                  Must contain {passwordErrors.join(', ')}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-bold text-slate-700">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-12 py-3 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  placeholder="••••••••"
                  disabled={loading || success}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={loading || success}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-rose-600">
                  Passwords do not match
                </p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Passwords match
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success || passwordErrors.length > 0 || !passwordsMatch}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <div className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Creating account...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm">Success!</span>
                </>
              ) : (
                <span className="text-sm">Create Account</span>
              )}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Password must be at least 8 characters with letters and numbers
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    }>
      <SetPasswordForm />
    </Suspense>
  )
}
