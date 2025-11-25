'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Lock, Mail, MapPin, Briefcase, Eye, EyeOff, CheckCircle, AlertCircle,
  Shield, Bell, Edit3, Save, Calendar, Clock, Phone, Building
} from 'lucide-react'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface UserData {
  name: string
  email: string
  region: string
  usertype: string
  status: string
  phone?: string
  department?: string
  joinDate?: string
  lastLogin?: string
}

type TabType = 'overview' | 'security'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // Security tab states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Profile editing states
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    department: ''
  })

  // Login alerts preference
  const [loginAlerts, setLoginAlerts] = useState(true)

  useEffect(() => {
    // Fetch user profile with full details
    const fetchUserProfile = async () => {
      try {
        const response = await fetch('/api/auth/profile')
        const data = await response.json()

        if (data.success && data.user) {
          setUser(data.user)
          setEditForm({
            name: data.user.name || '',
            phone: data.user.phone || '',
            department: data.user.department || ''
          })
          // Set login alerts preference if available
          if (data.user.loginAlerts !== undefined) {
            setLoginAlerts(data.user.loginAlerts)
          }
        } else {
          router.push('/login')
        }
      } catch (error) {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()
  }, [router])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('Please fill in all password fields')
      setMessageType('error')
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage('New password and confirmation do not match')
      setMessageType('error')
      return
    }

    if (newPassword.length < 8) {
      setMessage('New password must be at least 8 characters')
      setMessageType('error')
      return
    }

    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setMessage('Password must contain both letters and numbers')
      setMessageType('error')
      return
    }

    setIsChangingPassword(true)

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage('Password changed successfully!')
        setMessageType('success')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setMessage(data.message || 'Failed to change password')
        setMessageType('error')
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.')
      setMessageType('error')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      })

      const data = await response.json()

      if (data.success) {
        setUser(prev => prev ? { ...prev, ...editForm } : null)
        setIsEditingProfile(false)
        setMessage('Profile updated successfully!')
        setMessageType('success')
      } else {
        setMessage(data.message || 'Failed to update profile')
        setMessageType('error')
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.')
      setMessageType('error')
    }
  }

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: User },
    { id: 'security' as TabType, label: 'Security', icon: Shield },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Profile Settings
              </h1>
              <p className="text-sm text-gray-600 mt-1">Manage your account and preferences</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-lg font-bold text-white">
                  {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar - Desktop */}
          <div className="hidden lg:block lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden sticky top-24">
              {/* Profile Summary */}
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mx-auto mb-3">
                  <span className="text-2xl font-bold bg-gradient-to-br from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <h3 className="font-bold text-white text-lg">{user.name}</h3>
                <p className="text-sm text-blue-100 mt-1 truncate">{user.email}</p>
                <div className="mt-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm">
                    {user.status}
                  </span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <nav className="p-3">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-4 py-3 rounded-lg text-left transition-all mb-1 ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700 shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-3" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Mobile Tabs */}
          <div className="lg:hidden col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
              <div className="flex space-x-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700 shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-2" />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9">
            {/* Message Display */}
            {message && (
              <div className={`mb-6 p-4 rounded-xl flex items-start animate-fadeIn ${
                messageType === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                {messageType === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                )}
                <span className={`text-sm font-medium ${
                  messageType === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {message}
                </span>
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Profile Header Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row items-start justify-between mb-6 gap-4">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Profile Information</h2>
                        <p className="text-gray-600 mt-1 text-sm">Your personal and account details</p>
                      </div>
                      <button
                        onClick={() => setIsEditingProfile(!isEditingProfile)}
                        className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 text-sm font-medium"
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        {isEditingProfile ? 'Cancel' : 'Edit Profile'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      {/* Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        {isEditingProfile ? (
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                            placeholder="Enter your full name"
                          />
                        ) : (
                          <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <User className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                            <span className="text-gray-900 text-sm">{user.name}</span>
                          </div>
                        )}
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                        <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <Mail className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                          <span className="text-gray-900 text-sm truncate">{user.email}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                        {isEditingProfile ? (
                          <input
                            type="tel"
                            value={editForm.phone}
                            onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                            placeholder="e.g., +62 812-3456-7890"
                          />
                        ) : (
                          <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <Phone className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                            <span className="text-gray-900 text-sm">{user.phone || 'Not provided'}</span>
                          </div>
                        )}
                      </div>

                      {/* Department */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                        {isEditingProfile ? (
                          <input
                            type="text"
                            value={editForm.department}
                            onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                            placeholder="e.g., Engineering, Sales"
                          />
                        ) : (
                          <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <Building className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                            <span className="text-gray-900 text-sm">{user.department || 'Not specified'}</span>
                          </div>
                        )}
                      </div>

                      {/* Region */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
                        <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <MapPin className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                          <span className="text-gray-900 text-sm">{user.region}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Contact admin to change region</p>
                      </div>

                      {/* User Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                        <div className="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <Briefcase className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0" />
                          <span className="text-blue-900 font-medium text-sm uppercase">{user.usertype}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Contact admin to change role</p>
                      </div>
                    </div>

                    {/* Save/Cancel Buttons */}
                    {isEditingProfile && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                        <button
                          onClick={() => {
                            setIsEditingProfile(false)
                            setEditForm({
                              name: user.name || '',
                              phone: user.phone || '',
                              department: user.department || ''
                            })
                            setMessage('')
                          }}
                          className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveProfile}
                          className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors flex items-center justify-center text-sm font-medium shadow-sm"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Account Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <Calendar className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Member Since</p>
                        <p className="text-base font-bold text-gray-900 mt-1 truncate">{user.joinDate || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Clock className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Last Login</p>
                        <p className="text-base font-bold text-gray-900 mt-1 truncate">{user.lastLogin || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center">
                      <div className={`p-3 rounded-lg ${user.status === 'Active' ? 'bg-green-100' : 'bg-red-100'}`}>
                        <Shield className={`h-5 w-5 ${user.status === 'Active' ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Status</p>
                        <p className={`text-base font-bold mt-1 ${user.status === 'Active' ? 'text-green-600' : 'text-red-600'}`}>
                          {user.status}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                {/* Password Change Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-red-500 to-pink-600 p-6">
                    <div className="flex items-center text-white">
                      <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                        <Lock className="h-6 w-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-xl font-bold">Change Password</h3>
                        <p className="text-red-100 text-sm mt-1">Update your password to keep your account secure</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8">
                    <form onSubmit={handleChangePassword} className="space-y-5">
                      {/* Current Password */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Password
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full pl-4 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-sm"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* New Password */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            New Password
                          </label>
                          <div className="relative">
                            <input
                              type={showNewPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full pl-4 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-sm"
                              placeholder="Enter new password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Confirm New Password
                          </label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full pl-4 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-sm"
                              placeholder="Confirm new password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Password Requirements */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-blue-900 mb-2">Password Requirements:</p>
                        <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                          <li>At least 8 characters long</li>
                          <li>Must contain both letters and numbers</li>
                          <li>Use a unique password you haven't used before</li>
                        </ul>
                      </div>

                      {/* Submit Button */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4">
                        <button
                          type="submit"
                          disabled={isChangingPassword}
                          className="px-8 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 text-white font-medium rounded-lg hover:from-red-700 hover:to-pink-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                        >
                          {isChangingPassword ? (
                            <>
                              <LoadingSpinner />
                              <span className="ml-2">Updating...</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4 mr-2" />
                              Update Password
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Security Settings */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-500 to-orange-600 p-6">
                    <div className="flex items-center text-white">
                      <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                        <Bell className="h-6 w-6 text-white" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-xl font-bold">Security Preferences</h3>
                        <p className="text-yellow-100 text-sm mt-1">Manage your account security settings</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8">
                    <div className="space-y-4">
                      <div className="flex items-start sm:items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors gap-4">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm">Login Alerts</h4>
                          <p className="text-xs text-gray-600 mt-1">Get notified via email when someone logs into your account</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={loginAlerts}
                            onChange={async (e) => {
                              const newValue = e.target.checked
                              setLoginAlerts(newValue)
                              
                              try {
                                await fetch('/api/auth/preferences', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ loginAlerts: newValue }),
                                })
                              } catch (error) {

                              }
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
