'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PermissionGuard } from '@/components/PermissionGuard'
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Shield, 
  Mail, 
  Phone, 
  MapPin,
  Calendar,
  Search,
  Filter,
  RefreshCcw,
  Settings,
  Lock,
  Eye,
  Edit,
  Save,
  X
} from 'lucide-react'

type TabType = 'users' | 'permissions'

interface RolePermission {
  Role: string
  Menu: string
  Permission: 'no' | 'read' | 'edit'
}

interface User {
  ID: string
  Email: string
  Name: string
  Region: string
  Role: string
  IsVerified: string
  IsActive: string
  registerDate: string
  phoneNo: string
  departement: string
  Login: string
}

export default function UserManagementPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('users')
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all')
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [editingRegion, setEditingRegion] = useState<string | null>(null)
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [availableRegions] = useState<string[]>([
    'All Region',
    'Bali Nusra',
    'Central Java',
    'East Java',
    'Jabodetabek',
    'Kalimantan',
    'Sulawesi',
    'West Java'
  ])

  // Role Permissions state
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [loadingPermissions, setLoadingPermissions] = useState(false)
  const [editingPermission, setEditingPermission] = useState<string | null>(null)
  const [savingPermission, setSavingPermission] = useState(false)
  const [permissionSearchQuery, setPermissionSearchQuery] = useState('')

  useEffect(() => {
    fetchUsers()
    fetchAvailableRoles()
    fetchRolePermissions()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, searchQuery, statusFilter, roleFilter])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/users')
      const data = await response.json()

      if (data.success) {
        setUsers(data.data)
      }
    } catch (error) {

    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableRoles = async () => {
    try {
      const response = await fetch('/api/permissions/roles')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.roles && data.roles.length > 0) {
          setAvailableRoles(data.roles)
        } else {
          // Fallback to default roles
          setAvailableRoles(['admin', 'user', 'pic', 'dc', 'rpm', 'pd', 'hr'])
        }
      } else {
        // Fallback to default roles if API fails
        setAvailableRoles(['admin', 'user', 'pic', 'dc', 'rpm', 'pd', 'hr'])
      }
    } catch (error) {

      // Fallback to default roles if API fails
      setAvailableRoles(['admin', 'user', 'pic', 'dc', 'rpm', 'pd', 'hr'])
    }
  }

  const fetchRolePermissions = async () => {
    setLoadingPermissions(true)
    try {
      const response = await fetch('/api/permissions/role-permissions')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.permissions) {
          setRolePermissions(data.permissions)
        }
      }
    } catch (error) {

    } finally {
      setLoadingPermissions(false)
    }
  }

  const updateRolePermission = async (role: string, menu: string, permission: 'no' | 'read' | 'edit') => {
    setSavingPermission(true)
    try {
      const response = await fetch('/api/permissions/role-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, menu, permission }),
      })

      if (response.ok) {
        await fetchRolePermissions()
        setEditingPermission(null)
      }
    } catch (error) {

    } finally {
      setSavingPermission(false)
    }
  }

  const filterUsers = () => {
    let filtered = [...users]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(user => 
        user.Name.toLowerCase().includes(query) ||
        user.Email.toLowerCase().includes(query) ||
        user.departement?.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter(user => user.IsActive === 'yes')
      } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(user => user.IsActive === 'no')
      } else if (statusFilter === 'pending') {
        filtered = filtered.filter(user => user.IsVerified === 'yes' && user.IsActive === 'no')
      }
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.Role === roleFilter)
    }

    setFilteredUsers(filtered)
  }

  const updateUserField = async (userId: string, field: string, value: string) => {
    setUpdating(userId)
    try {
      const response = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, field, value }),
      })

      if (response.ok) {
        await fetchUsers()
      }
    } catch (error) {

    } finally {
      setUpdating(null)
    }
  }

  const toggleUserActive = (user: User) => {
    const newValue = user.IsActive === 'yes' ? 'no' : 'yes'
    updateUserField(user.ID, 'IsActive', newValue)
  }

  const changeUserRole = (userId: string, newRole: string) => {
    updateUserField(userId, 'Role', newRole)
    setEditingRole(null)
  }

  const changeUserRegion = (userId: string, regions: string[]) => {
    const regionString = regions.join(', ')
    updateUserField(userId, 'Region', regionString)
    setEditingRegion(null)
    setSelectedRegions([])
  }

  const toggleRegionSelection = (region: string) => {
    setSelectedRegions(prev => {
      if (prev.includes(region)) {
        return prev.filter(r => r !== region)
      } else {
        return [...prev, region]
      }
    })
  }

  const startEditingRegion = (userId: string, currentRegion: string) => {
    setEditingRegion(userId)
    // Parse existing regions
    if (currentRegion && currentRegion !== '-') {
      const regions = currentRegion.split(',').map(r => r.trim()).filter(Boolean)
      setSelectedRegions(regions)
    } else {
      setSelectedRegions([])
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const stats = {
    total: users.length,
    active: users.filter(u => u.IsActive === 'yes').length,
    pending: users.filter(u => u.IsVerified === 'yes' && u.IsActive === 'no').length,
    admins: users.filter(u => u.Role === 'admin').length,
  }

  return (
    <PermissionGuard menuKey="userManagement" requiredLevel="edit">
      <div className="h-full flex flex-col p-4 md:p-6">
        {/* Header */}
        <div className="flex-none mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-sm">
                  <Users className="h-6 w-6 text-white" />
                </div>
                User Management
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage user accounts, roles, and permissions
            </p>
          </div>
          <button
            onClick={() => {
              if (activeTab === 'users') {
                fetchUsers()
              } else {
                fetchRolePermissions()
              }
            }}
            disabled={loading || loadingPermissions}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <RefreshCcw className={`h-4 w-4 ${(loading || loadingPermissions) ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-none mb-4">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'users'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Users
                </div>
              </button>
              <button
                onClick={() => setActiveTab('permissions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'permissions'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Role Permissions
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Users Tab Content */}
        {activeTab === 'users' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Administrators</p>
                <p className="text-2xl font-bold text-purple-600">{stats.admins}</p>
              </div>
              <Shield className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending Approval</option>
            </select>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-auto h-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registered
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.ID} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {user.Name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.Name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.Email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center gap-1">
                        <Phone className="h-3 w-3 text-gray-400" />
                        {user.phoneNo || '-'}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {user.Region || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.departement || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        {formatDate(user.registerDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {user.Login ? formatDate(user.Login) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {editingRegion === user.ID ? (
                        <div className="relative inline-block">
                          <div className="bg-white border border-gray-300 rounded-lg p-3 shadow-lg min-w-[250px] max-w-[300px]">
                            {/* Selected chips */}
                            {selectedRegions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-gray-200">
                                {selectedRegions.map((region) => (
                                  <span
                                    key={region}
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                  >
                                    {region}
                                    <button
                                      onClick={() => toggleRegionSelection(region)}
                                      className="ml-1 hover:text-blue-900"
                                    >
                                      <XCircle className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            {/* Checkboxes */}
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {availableRegions.map((region) => (
                                <label
                                  key={region}
                                  className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedRegions.includes(region)}
                                    onChange={() => toggleRegionSelection(region)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-xs text-gray-700">{region}</span>
                                </label>
                              ))}
                            </div>
                            
                            {/* Action buttons */}
                            <div className="flex gap-2 mt-3 pt-2 border-t border-gray-200">
                              <button
                                onClick={() => changeUserRegion(user.ID, selectedRegions)}
                                disabled={updating === user.ID || selectedRegions.length === 0}
                                className="flex-1 px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingRegion(null)
                                  setSelectedRegions([])
                                }}
                                className="flex-1 px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditingRegion(user.ID, user.Region)}
                          disabled={updating === user.ID}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer max-w-[200px]"
                        >
                          <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{user.Region || 'Set Region'}</span>
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {editingRole === user.ID ? (
                        <select
                          value={user.Role}
                          onChange={(e) => changeUserRole(user.ID, e.target.value)}
                          disabled={updating === user.ID}
                          className="px-3 py-1 rounded-lg border border-gray-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 capitalize"
                          autoFocus
                          onBlur={() => setEditingRole(null)}
                        >
                          {availableRoles.map((role) => (
                            <option key={role} value={role} className="capitalize">
                              {role.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingRole(user.ID)}
                          disabled={updating === user.ID}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium uppercase ${
                            user.Role === 'admin'
                              ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                              : user.Role === 'user'
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                              : user.Role === 'pic'
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : user.Role === 'dc'
                              ? 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200'
                              : user.Role === 'rpm'
                              ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                              : user.Role === 'pd'
                              ? 'bg-violet-100 text-violet-800 hover:bg-violet-200'
                              : 'bg-pink-100 text-pink-800 hover:bg-pink-200'
                          } transition-colors disabled:opacity-50 cursor-pointer`}
                        >
                          {user.Role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                          {user.Role}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        user.IsActive === 'yes'
                          ? 'bg-emerald-100 text-emerald-800'
                          : user.IsVerified === 'yes'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.IsActive === 'yes' ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : user.IsVerified === 'yes' ? (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Unverified
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => toggleUserActive(user)}
                        disabled={updating === user.ID || user.IsVerified !== 'yes'}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                          user.IsActive === 'yes'
                            ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {updating === user.ID ? (
                          <RefreshCcw className="h-4 w-4 animate-spin inline" />
                        ) : user.IsActive === 'yes' ? (
                          'Deactivate'
                        ) : (
                          'Activate'
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && !loading && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No users found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )}

        {/* Role Permissions Tab Content */}
        {activeTab === 'permissions' && (
          <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
            {loadingPermissions ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              </div>
            ) : (
              <div className="overflow-auto h-full">
                <div className="p-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-purple-600" />
                      Role Permission Matrix
                    </h2>
                    <p className="text-sm text-gray-600">
                      Configure menu access permissions for each role. 
                      <span className="font-medium ml-1">no</span> = hidden, 
                      <span className="font-medium ml-1">read</span> = view only, 
                      <span className="font-medium ml-1">edit</span> = full access
                    </p>
                  </div>

                  {/* Search bar */}
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search menu..."
                        value={permissionSearchQuery}
                        onChange={(e) => setPermissionSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                            Menu
                          </th>
                          {availableRoles.map((role) => (
                            <th key={role} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <div className="flex items-center justify-center gap-1">
                                {role === 'admin' && <Shield className="h-4 w-4 text-purple-500" />}
                                {role}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Array.from(new Set(rolePermissions.map(p => p.Menu)))
                          .filter(menu => 
                            menu.toLowerCase().includes(permissionSearchQuery.toLowerCase())
                          )
                          .map((menu) => (
                          <tr key={menu} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                              {menu}
                            </td>
                            {availableRoles.map((role) => {
                              const permission = rolePermissions.find(
                                p => p.Role === role && p.Menu === menu
                              )
                              const permissionValue = permission?.Permission || 'no'
                              const isEditing = editingPermission === `${role}-${menu}`

                              return (
                                <td key={`${role}-${menu}`} className="px-6 py-4 whitespace-nowrap text-center">
                                  {isEditing ? (
                                    <div className="flex items-center justify-center gap-2">
                                      <select
                                        value={permissionValue}
                                        onChange={(e) => {
                                          updateRolePermission(role, menu, e.target.value as any)
                                        }}
                                        disabled={savingPermission}
                                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                      >
                                        <option value="no">No Access</option>
                                        <option value="read">Read Only</option>
                                        <option value="edit">Full Access</option>
                                      </select>
                                      <button
                                        onClick={() => setEditingPermission(null)}
                                        className="p-1 text-gray-400 hover:text-gray-600"
                                        disabled={savingPermission}
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setEditingPermission(`${role}-${menu}`)}
                                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                        permissionValue === 'edit'
                                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                          : permissionValue === 'read'
                                          ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                      }`}
                                    >
                                      {permissionValue === 'edit' && <Edit className="h-3 w-3 mr-1" />}
                                      {permissionValue === 'read' && <Eye className="h-3 w-3 mr-1" />}
                                      {permissionValue === 'no' && <Lock className="h-3 w-3 mr-1" />}
                                      {permissionValue === 'edit' ? 'Full Access' : permissionValue === 'read' ? 'Read Only' : 'No Access'}
                                    </button>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {rolePermissions.length === 0 && !loadingPermissions && (
                      <div className="text-center py-12">
                        <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No role permissions found</p>
                        <p className="text-sm text-gray-500 mt-2">
                          Please check your Google Sheets rolePermission table
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </PermissionGuard>
  )
}
