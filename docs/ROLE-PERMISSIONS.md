# Role-Based Permission System

## Overview
Sistem permission berbasis role yang membaca dari Google Sheets dan mengatur akses menu dan level permission (no access, read-only, edit).

## Google Sheets Setup

### Sheet: rolePermission
Location: `GOOGLE_SHEET_ID_USER` spreadsheet
Sheet Name: `rolePermission` (sesuai `GOOGLE_SHEET_NAME_ROLEPERMISSION`)

### Table Structure
| Role | User management | Home | Dashboard | Projects | Absensi | Daily Plan |
|------|----------------|------|-----------|----------|---------|------------|
| admin | edit | edit | edit | edit | edit | edit |
| user | no | read | no | no | no | no |
| pic | no | read | read | read | no | edit |
| dc | no | read | read | read | no | edit |
| rpm | no | read | read | edit | edit | edit |
| pd | no | read | read | edit | read | edit |
| hr | no | no | no | no | edit | read |

### Permission Levels
- **no**: Tidak ada akses, menu tidak muncul di sidebar
- **read**: Read-only, bisa melihat tapi tidak bisa edit
- **edit**: Full access, bisa update, edit, save, dll

## Implementation

### 1. Permission Utility (`src/lib/permissions.ts`)
Functions:
- `fetchRolePermissions()` - Fetch all role permissions from Google Sheets
- `getPermissionsForRole(role)` - Get permissions for specific role
- `hasMenuAccess(permissions, menuKey)` - Check if user can access menu
- `canEdit(permissions, menuKey)` - Check if user can edit
- `getPermissionLevel(permissions, menuKey)` - Get permission level

### 2. API Endpoint (`/api/permissions`)
Returns user's permissions based on their role from session cookie.

```typescript
GET /api/permissions
Response: {
  success: true,
  role: "admin",
  permissions: {
    userManagement: "edit",
    home: "edit",
    dashboard: "edit",
    projects: "edit",
    absensi: "edit",
    dailyPlan: "edit"
  }
}
```

### 3. Sidebar Integration
`src/components/Sidebar.tsx` automatically shows/hides menu items based on user permissions.

### 4. Page Protection Component (`src/components/PermissionGuard.tsx`)
Wrap pages with PermissionGuard to enforce access control:

```typescript
import { PermissionGuard } from '@/components/PermissionGuard'

export default function MyPage() {
  return (
    <PermissionGuard menuKey="projects" requiredLevel="edit">
      {/* Your page content */}
    </PermissionGuard>
  )
}
```

### 5. Hooks

**useCanEdit** - Check if user can edit:
```typescript
const canEdit = useCanEdit('projects')
```

**usePermissionLevel** - Get user's permission level:
```typescript
const level = usePermissionLevel('dashboard') // 'no' | 'read' | 'edit'
```

## Usage Examples

### Example 1: Protect User Management Page
```typescript
<PermissionGuard menuKey="userManagement" requiredLevel="edit">
  <UserManagementContent />
</PermissionGuard>
```

### Example 2: Conditional Button Based on Permission
```typescript
function MyComponent() {
  const canEdit = useCanEdit('projects')
  
  return (
    <div>
      {canEdit && (
        <button onClick={handleSave}>Save Changes</button>
      )}
    </div>
  )
}
```

### Example 3: Show Different UI for Read-Only
```typescript
function MyComponent() {
  const level = usePermissionLevel('dashboard')
  
  return (
    <div>
      {level === 'edit' && <EditTools />}
      {level === 'read' && <ReadOnlyBanner />}
    </div>
  )
}
```

## Role Definitions

### Admin
- Full access to everything
- Can manage users
- Can edit all data

### User (Default)
- Minimal access
- Only read access to Home

### PIC (Person In Charge)
- Read access to Home, Dashboard, Projects
- Edit access to Daily Plan

### DC (Data Collector)
- Read access to Home, Dashboard, Projects
- Edit access to Daily Plan

### RPM (Regional Project Manager)
- Read access to Home, Dashboard
- Edit access to Projects, Absensi, Daily Plan

### PD (Project Director)
- Read access to Home, Dashboard, Absensi
- Edit access to Projects, Daily Plan

### HR (Human Resources)
- Only access to Absensi (edit)
- Read access to Daily Plan

## Caching
Permissions are cached for 5 minutes to reduce Google Sheets API calls.
To clear cache manually, use `clearPermissionsCache()` function.

## Environment Variables Required
```env
GOOGLE_SHEET_ID_USER=your-spreadsheet-id
GOOGLE_SHEET_NAME_ROLEPERMISSION=rolePermission
GOOGLE_CLIENT_EMAIL=your-service-account-email
GOOGLE_PRIVATE_KEY=your-service-account-private-key
```

## Adding New Roles
1. Add new row in `rolePermission` sheet
2. Set permission levels for each menu
3. Users with new role will automatically get permissions

## Adding New Menu Items
1. Add new column in `rolePermission` sheet (e.g., "Reports")
2. Set permissions for each role
3. Update `MenuKey` type in `src/lib/permissions.ts`
4. Update `RolePermissions` interface
5. Update sidebar menu items to check new permission

## Security Notes
- Permissions are checked at multiple layers:
  - Sidebar (UI level)
  - PermissionGuard (Component level)
  - API endpoints should also validate permissions
- Always validate permissions on server-side for sensitive operations
- Session cookie is used for authentication
- Admin-only endpoints should check usertype === 'admin'
