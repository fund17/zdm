'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Mail, CheckCircle, LogOut } from 'lucide-react'

export default function PendingActivationPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session')
        const data = await response.json()

        if (!data.success || !data.user) {
          router.push('/login')
          return
        }

        // If user is active, redirect to home
        if (data.user.isActive) {
          router.push('/')
          return
        }

        setUser(data.user)
      } catch (error) {
        router.push('/login')
      }
    }

    checkSession()
  }, [router])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      router.push('/login')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 p-4">
      <div className="max-w-md w-full">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Clock className="h-10 w-10 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Account Pending Activation
            </h1>
            <p className="text-amber-50 text-sm">
              Your registration was successful!
            </p>
          </div>

          {/* Body */}
          <div className="p-8">
            <div className="space-y-6">
              {/* Welcome Message */}
              <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Welcome, {user.name}!
                </h2>
                <p className="text-sm text-slate-600">
                  {user.email}
                </p>
              </div>

              {/* Status Steps */}
              <div className="space-y-4">
                {/* Step 1 - Completed */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">Email Verified</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Your email has been successfully verified
                    </p>
                  </div>
                </div>

                {/* Step 2 - Completed */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">Account Created</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Your account has been successfully created
                    </p>
                  </div>
                </div>

                {/* Step 3 - Pending */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center animate-pulse">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">Admin Approval</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Waiting for administrator to activate your account
                    </p>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">
                      What happens next?
                    </h4>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• Administrator will review your registration</li>
                      <li>• You&apos;ll receive an email once your account is activated</li>
                      <li>• This usually takes 1-2 business days</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Support Contact */}
              <div className="text-center pt-2">
                <p className="text-xs text-slate-600 mb-1">
                  Need help? Contact administrator:
                </p>
                <a 
                  href="mailto:admin@zmg.co.id" 
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  admin@zmg.co.id
                </a>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-8 py-4 border-t border-slate-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            You can close this page and check back later
          </p>
        </div>
      </div>
    </div>
  )
}
