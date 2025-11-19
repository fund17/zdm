'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Mail, Eye, EyeOff, LogIn } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  useEffect(() => {
    // Check if user was redirected from protected page
    const redirect = searchParams.get('redirect')
    if (redirect) {
      setError('Please login to access that page')
    }
    // load remember me email
    try {
      const remembered = localStorage.getItem('rememberEmail')
      if (remembered) {
        setEmail(remembered)
        setRememberMe(true)
      }
    } catch (e) {
      // ignore
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (data.success) {
        try {
          if (rememberMe) {
            localStorage.setItem('rememberEmail', email)
          } else {
            localStorage.removeItem('rememberEmail')
          }
        } catch (e) {
          // ignore
        }
        // Get redirect parameter or default to home
        const redirectTo = searchParams.get('redirect') || '/'
        router.push(redirectTo)
        router.refresh()
      } else {
        setError(data.message || 'Login failed')
      }
    } catch (error) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl"></div>
      </div>

      {/* Grid Container */}
      <div className="relative w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left Intro / Illustration */}
        <div className="hidden md:flex flex-col justify-center px-6 py-8 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg h-[520px]">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-lg">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">ZMG Management System</h2>
              <p className="text-sm opacity-90">Secure access for project and rollout management</p>
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-3xl font-extrabold leading-tight mb-2">Welcome back</h3>
            <p className="text-sm text-white/90 mb-6">Sign in to continue managing projects, POs, and daily plans.</p>
            <ul className="text-sm list-disc pl-5 space-y-2 text-white/90">
              <li>Fast project insights</li>
              <li>PO tracking & status</li>
              <li>File management & reports</li>
            </ul>
          </div>
          <div className="mt-auto pt-6 text-xs text-white/80">
            Need help? Contact <a href="mailto:adminbalom@zmg.co.id" className="underline">adminbalom@zmg.co.id</a>
          </div>
        </div>
        {/* Card / Form */}
        <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-100 p-8 h-[520px] flex flex-col justify-center">
          <form onSubmit={handleSubmit} className="space-y-6" aria-labelledby="login-title">
            {/* Error Message */}
            {error && (
              <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-rose-700 text-center">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-left">
                <h1 id="login-title" className="text-2xl font-extrabold text-slate-800">Sign in to your account</h1>
                <p className="text-sm text-slate-500">Enter your company credentials to continue</p>
              </div>
              {/* Right side (Demo & Forgot) removed - moved Forgot link below password field */}
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-bold text-slate-700">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  placeholder="admin@zmg.co.id"
                  disabled={loading}
                />
              </div>

              {/* NOTE: Forgot password link moved under the Password field (see block below) */}
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
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {/* Forgot password link - positioned under password field on the right */}
              <div className="mt-2 text-right">
                <a href="/forgot-password" className="text-xs text-blue-600 hover:underline">Forgot password?</a>
              </div>
            </div>

              {/* Remember / Submit Row */}
              <div className="flex items-center justify-between gap-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" className="form-checkbox h-4 w-4" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span className="text-sm text-slate-600">Remember me</span>
                </label>
                <div className="flex gap-2 items-center">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-xl transition-all duration-200 shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <LogIn className="h-4 w-4" />
                    )}
                    <span className="text-sm">Sign In</span>
                  </button>
                </div>
              </div>
              {/* Social SSO and OR divider removed */}

              </form>

              {/* Register Link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-600">
                  Don&apos;t have an account?{' '}
                  <a href="/register" className="font-bold text-blue-600 hover:text-blue-700 hover:underline">
                    Register now
                  </a>
                </p>
              </div>
              </div>

        {/* Footer */}
        <div className="text-center md:col-span-2 mt-8">
          <p className="text-xs text-slate-500 font-medium">
            © 2025 ZMG Management System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
