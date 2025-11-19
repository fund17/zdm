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
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-y-auto pb-2">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sticky top-24">
              {/* Profile Summary */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900">{user.name}</h3>
                <p className="text-sm text-gray-500">{user.email}</p>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {user.status}
                  </span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-4 py-3 rounded-xl text-left transition-all ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
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

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Profile Header Card */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>
                      <p className="text-gray-600 mt-1">Your personal and account details</p>
                    </div>
                    <button
                      onClick={() => setIsEditingProfile(!isEditingProfile)}
                      className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      {isEditingProfile ? 'Cancel' : 'Edit'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      ) : (
                        <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                          <User className="h-5 w-5 text-gray-400 mr-3" />
                          <span className="text-gray-900">{user.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                      <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                        <Mail className="h-5 w-5 text-gray-400 mr-3" />
                        <span className="text-gray-900">{user.email}</span>
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                      {isEditingProfile ? (
                        <input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="Enter phone number"
                        />
                      ) : (
                        <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                          <Phone className="h-5 w-5 text-gray-400 mr-3" />
                          <span className="text-gray-900">{user.phone || 'Not provided'}</span>
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="Enter department"
                        />
                      ) : (
                        <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                          <Building className="h-5 w-5 text-gray-400 mr-3" />
                          <span className="text-gray-900">{user.department || 'Not specified'}</span>
                        </div>
                      )}
                    </div>

                    {/* Region */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
                      <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                        <MapPin className="h-5 w-5 text-gray-400 mr-3" />
                        <span className="text-gray-900">{user.region}</span>
                      </div>
                    </div>

                    {/* User Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">User Type</label>
                      <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                        <Briefcase className="h-5 w-5 text-gray-400 mr-3" />
                        <span className="text-gray-900">{user.usertype}</span>
                      </div>
                    </div>
                  </div>

                  {/* Save/Cancel Buttons */}
                  {isEditingProfile && (
                    <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                      <button
                        onClick={() => {
                          setIsEditingProfile(false)
                          setEditForm({
                            name: user.name || '',
                            phone: user.phone || '',
                            department: user.department || ''
                          })
                        }}
                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        className="px-6 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors flex items-center"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>

                {/* Account Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <Calendar className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Member Since</p>
                        <p className="text-lg font-bold text-gray-900">{user.joinDate || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Clock className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Last Login</p>
                        <p className="text-lg font-bold text-gray-900">{user.lastLogin || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <div className="flex items-center">
                      <div className={`p-3 rounded-lg ${user.status === 'Active' ? 'bg-green-100' : 'bg-red-100'}`}>
                        <Shield className={`h-6 w-6 ${user.status === 'Active' ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Account Status</p>
                        <p className={`text-lg font-bold ${user.status === 'Active' ? 'text-green-600' : 'text-red-600'}`}>
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
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                  <div className="flex items-center mb-6">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <Lock className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-xl font-bold text-gray-900">Change Password</h3>
                      <p className="text-gray-600">Update your password to keep your account secure</p>
                    </div>
                  </div>

                  {message && (
                    <div className={`mb-6 p-4 rounded-xl flex items-start ${
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

                  <form onSubmit={handleChangePassword} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Current Password */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Password
                        </label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Enter current password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

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
                            className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Enter new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                            className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Confirm new password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <div className="text-sm text-gray-600">
                        Password must be at least 8 characters with letters and numbers
                      </div>
                      <button
                        type="submit"
                        disabled={isChangingPassword}
                        className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        {isChangingPassword ? (
                          <>
                            <LoadingSpinner />
                            <span className="ml-2">Updating...</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-5 w-5 mr-2" />
                            Update Password
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Security Settings */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                  <div className="flex items-center mb-6">
                    <div className="p-3 bg-yellow-100 rounded-lg">
                      <Bell className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-xl font-bold text-gray-900">Security Settings</h3>
                      <p className="text-gray-600">Additional security options for your account</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                      <div>
                        <h4 className="font-medium text-gray-900">Login Alerts</h4>
                        <p className="text-sm text-gray-600">Get notified via email when someone logs into your account</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={loginAlerts}
                          onChange={async (e) => {
                            const newValue = e.target.checked
                            setLoginAlerts(newValue)
                            
                            // Save preference (optional - for future use)
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
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
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
