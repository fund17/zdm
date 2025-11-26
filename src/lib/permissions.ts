import { google } from 'googleapis'

// Permission levels
export type PermissionLevel = 'no' | 'read' | 'edit'

// Menu keys that match our table columns
export type MenuKey = 
  | 'User management' 
  | 'Home' 
  | 'Dashboard' 
  | 'Projects' 
  | 'Absensi' 
  | 'Daily Plan'
  | 'File Upload Center'

// Permission map for a role
export interface RolePermissions {
  role: string
  userManagement: PermissionLevel
  home: PermissionLevel
  dashboard: PermissionLevel
  projects: PermissionLevel
  absensi: PermissionLevel
  dailyPlan: PermissionLevel
  fileUploadCenter: PermissionLevel
}

// Cache for permissions (to avoid fetching on every request)
let permissionsCache: RolePermissions[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch role permissions from Google Sheets
 */
export async function fetchRolePermissions(): Promise<RolePermissions[]> {
  // Check cache first
  const now = Date.now()
  if (permissionsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return permissionsCache
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
    const sheetName = process.env.GOOGLE_SHEET_NAME_ROLEPERMISSION || 'rolePermission'

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:I100`, // Get all rows (A-I for 8 columns)
    })

    const rows = response.data.values
    if (!rows || rows.length === 0) {
      throw new Error('No data found in rolePermission sheet')
    }

    // First row is headers
    const headers = rows[0]
    const permissions: RolePermissions[] = []

    // Process each role row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row[0]) continue // Skip empty rows

      permissions.push({
        role: row[0].toLowerCase(), // admin, user, pic, dc, rpm, pd, hr
        userManagement: (row[1]?.toLowerCase() || 'no') as PermissionLevel,
        home: (row[2]?.toLowerCase() || 'no') as PermissionLevel,
        dashboard: (row[3]?.toLowerCase() || 'no') as PermissionLevel,
        projects: (row[4]?.toLowerCase() || 'no') as PermissionLevel,
        absensi: (row[5]?.toLowerCase() || 'no') as PermissionLevel,
        dailyPlan: (row[6]?.toLowerCase() || 'no') as PermissionLevel,
        fileUploadCenter: (row[7]?.toLowerCase() || 'no') as PermissionLevel,
      })
    }

    // Update cache
    permissionsCache = permissions
    cacheTimestamp = now

    return permissions
  } catch (error) {

    throw error
  }
}

/**
 * Get permissions for a specific role
 */
export async function getPermissionsForRole(role: string): Promise<RolePermissions | null> {
  const permissions = await fetchRolePermissions()
  const rolePermission = permissions.find(p => p.role === role.toLowerCase())
  return rolePermission || null
}

/**
 * Check if user has access to a specific menu
 */
export function hasMenuAccess(permissions: RolePermissions, menuKey: MenuKey): boolean {
  const permissionMap: Record<MenuKey, PermissionLevel> = {
    'User management': permissions.userManagement,
    'Home': permissions.home,
    'Dashboard': permissions.dashboard,
    'Projects': permissions.projects,
    'Absensi': permissions.absensi,
    'Daily Plan': permissions.dailyPlan,
    'File Upload Center': permissions.fileUploadCenter,
  }

  const level = permissionMap[menuKey]
  return level !== 'no'
}

/**
 * Check if user can edit (not just read)
 */
export function canEdit(permissions: RolePermissions, menuKey: MenuKey): boolean {
  const permissionMap: Record<MenuKey, PermissionLevel> = {
    'User management': permissions.userManagement,
    'Home': permissions.home,
    'Dashboard': permissions.dashboard,
    'Projects': permissions.projects,
    'Absensi': permissions.absensi,
    'Daily Plan': permissions.dailyPlan,
    'File Upload Center': permissions.fileUploadCenter,
  }

  const level = permissionMap[menuKey]
  return level === 'edit'
}

/**
 * Get permission level for a menu
 */
export function getPermissionLevel(permissions: RolePermissions, menuKey: MenuKey): PermissionLevel {
  const permissionMap: Record<MenuKey, PermissionLevel> = {
    'User management': permissions.userManagement,
    'Home': permissions.home,
    'Dashboard': permissions.dashboard,
    'Projects': permissions.projects,
    'Absensi': permissions.absensi,
    'Daily Plan': permissions.dailyPlan,
    'File Upload Center': permissions.fileUploadCenter,
  }

  return permissionMap[menuKey] || 'no'
}

/**
 * Clear permissions cache (useful after updating permissions)
 */
export function clearPermissionsCache(): void {
  permissionsCache = null
  cacheTimestamp = 0
}
