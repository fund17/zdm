'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        // Redirect to verify page after 2 seconds
        setTimeout(() => {
          router.push(`/verify?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`)
        }, 2000)
      } else {
        setError(data.error || 'Registration failed')
      }
    } catch (error) {
      console.error('Registration error:', error)
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

      {/* Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-100 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4">
              <User className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 mb-2">Create Account</h1>
            <p className="text-sm text-slate-500">Register with your @zmg.co.id email</p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Verification code sent!</p>
                  <p className="text-xs text-emerald-600 mt-1">Check your email for the 6-digit code.</p>
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
            {/* Name Field */}
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-bold text-slate-700">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  placeholder="John Doe"
                  disabled={loading || success}
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-bold text-slate-700">
                Company Email
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
                  pattern=".*@zmg\.co\.id$"
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                  placeholder="yourname@zmg.co.id"
                  disabled={loading || success}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Only @zmg.co.id email addresses are allowed
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Sending code...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm">Redirecting...</span>
                </>
              ) : (
                <>
                  <span className="text-sm">Continue</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link href="/login" className="font-bold text-blue-600 hover:text-blue-700 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            By registering, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}
