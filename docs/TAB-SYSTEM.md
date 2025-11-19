# Tab Navigation System with Data Caching

## Overview
Sistem navigasi berbasis tab yang memungkinkan user membuka hingga 5 tab sekaligus. Setiap tab menyimpan cache data selama 5 menit untuk menghindari fetch ulang ketika berpindah tab.

## Features
- **Multi-tab browsing**: Buka hingga 5 halaman dalam tab berbeda
- **Data caching**: Data tidak perlu di-fetch ulang saat kembali ke tab
- **Smart navigation**: Klik menu membuka tab baru atau switch ke tab existing
- **Tab management**: Close individual tabs, auto-remove oldest tab saat limit tercapai
- **Visual feedback**: Active tab indicator, tab count, close buttons

## Components

### 1. TabContext (`src/contexts/TabContext.tsx`)
Context provider untuk mengelola state semua tab.

**Features:**
- Menyimpan array tab dengan metadata (id, path, label, cachedData, lastVisited)
- Automatic tab addition/removal
- Cache management dengan expiry (5 menit default)
- Active tab tracking

**API:**
```typescript
interface TabContextType {
  tabs: Tab[]
  activeTabId: string | null
  addTab: (path: string, label: string, icon?: string) => void
  closeTab: (tabId: string) => void
  switchTab: (tabId: string) => void
  getTabLabel: (path: string) => string
  getTabCache: (path: string) => any
  setTabCache: (path: string, data: any) => void
  clearTabCache: (path: string) => void
}
```

### 2. TabBar Component (`src/components/TabBar.tsx`)
UI component untuk menampilkan dan mengelola tab.

**Features:**
- Horizontal scrollable tab bar
- Active tab highlighting
- Close button (visible on hover)
- Tab count indicator (X/5 tabs)
- Icons based on page type
- Smooth transitions

### 3. useTabCache Hook (`src/hooks/useTabCache.ts`)
Custom hook untuk automatic data caching per tab.

**Usage:**
```typescript
const { data, loading, error, refresh, setData } = useTabCache({
  fetchData: async () => {
    const response = await fetch('/api/users')
    const data = await response.json()
    return data.data
  },
  dependencies: [] // optional
})
```

**Features:**
- Automatic data fetching on first load
- Check cache before fetching
- Store data in tab cache after fetch
- Manual refresh with `refresh()` function
- Cache expiry after 5 minutes

## Integration

### App Layout
Updated `src/app/layout.tsx` to wrap app with `TabProvider`:
```typescript
<TabProvider>
  <AppLayout>
    {children}
  </AppLayout>
</TabProvider>
```

### AppLayout Component
Added `<TabBar />` above main content:
```typescript
<main className="flex-1 flex flex-col overflow-hidden">
  <div className="flex-none">
    <TabBar />
  </div>
  <div className="flex-1 p-6 overflow-hidden">
    {children}
  </div>
</main>
```

### Sidebar Navigation
Updated `src/components/Sidebar.tsx` to use tab navigation:
- Replaced `<Link>` with `<button onClick={handleNavigate}>`
- Calls `addTab()` before navigation
- Works with both main menu and submenu items

## Usage Examples

### Example 1: Use Tab Cache in Page Component
```typescript
'use client'

import { useTabCache } from '@/hooks/useTabCache'

export default function MyPage() {
  const { data, loading, refresh } = useTabCache({
    fetchData: async () => {
      const res = await fetch('/api/my-data')
      return res.json()
    }
  })

  return (
    <div>
      {loading && <Spinner />}
      {data && <DisplayData data={data} />}
      <button onClick={refresh}>Refresh</button>
    </div>
  )
}
```

### Example 2: Manual Cache Control
```typescript
import { useSimpleTabCache } from '@/hooks/useTabCache'

export default function MyPage() {
  const { getCached, setCached, clear } = useSimpleTabCache()

  const handleSave = (data: any) => {
    setCached(data) // Save to cache
  }

  const loadFromCache = () => {
    const cached = getCached()
    if (cached) {
      // Use cached data
    }
  }

  return (
    <div>
      {/* Your component */}
    </div>
  )
}
```

### Example 3: Programmatic Tab Control
```typescript
import { useTabs } from '@/contexts/TabContext'

export default function MyComponent() {
  const { addTab, closeTab, switchTab, tabs } = useTabs()

  const openNewTab = () => {
    addTab('/dashboard/daily', 'Daily Dashboard')
  }

  const closeCurrentTab = () => {
    const currentTab = tabs.find(t => t.path === pathname)
    if (currentTab) {
      closeTab(currentTab.id)
    }
  }

  return (
    <div>
      <button onClick={openNewTab}>Open Dashboard</button>
      <button onClick={closeCurrentTab}>Close Tab</button>
    </div>
  )
}
```

## Configuration

### Maximum Tabs
Change in `src/contexts/TabContext.tsx`:
```typescript
const MAX_TABS = 5 // Change to desired number
```

### Cache Duration
Change in `src/contexts/TabContext.tsx`:
```typescript
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes (in milliseconds)
```

## Page Label Mapping
Default labels are defined in `getDefaultLabel()` function in TabContext:
```typescript
const pathMap: Record<string, string> = {
  '/': 'Home',
  '/dashboard/daily': 'Daily Dashboard',
  '/dashboard/itc-huawei': 'ITC Huawei',
  '/dashboard/po-huawei': 'PO Huawei',
  '/daily-plan': 'Daily Plan',
  '/itc-huawei': 'ITC Huawei Project',
  '/users': 'User Management',
  '/profile': 'Profile',
  '/absensi': 'Absensi',
}
```

## Icon Mapping
Icons for tabs are defined in `TabBar.tsx`:
```typescript
const getIconForPath = (path: string): React.ReactNode => {
  if (path === '/') return iconMap.home
  if (path.startsWith('/dashboard')) return iconMap.dashboard
  if (path.startsWith('/daily-plan')) return iconMap.calendar
  // ... etc
}
```

## Behavior

### Tab Creation
1. User clicks menu item in sidebar
2. System checks if tab for that path already exists
3. If exists: Switch to existing tab
4. If not exists:
   - If tabs < 5: Create new tab
   - If tabs = 5: Remove oldest non-active tab, create new tab

### Tab Switching
1. User clicks tab in TabBar
2. System switches activeTabId
3. Updates lastVisited timestamp
4. Router navigates to tab's path

### Tab Closing
1. User clicks close button (X) on tab
2. If closing active tab: Switch to previous tab
3. Remove tab from array
4. If last tab: Redirect to home

### Cache Behavior
1. First visit to page: Fetch data, store in cache
2. Switch to another tab: Data remains in cache
3. Switch back: Load from cache (if < 5 minutes old)
4. After 5 minutes: Cache expired, fetch fresh data
5. Manual refresh: Force fetch, update cache

## Benefits
- **Performance**: Mengurangi API calls dengan caching
- **UX**: Smooth navigation tanpa loading ulang
- **Productivity**: Multi-tasking dengan multiple tabs
- **Memory Efficient**: Cache auto-expired setelah 5 menit
- **Smart**: Automatic cache management per tab

## Implemented Pages
- ✅ User Management (`/users`) - Using `useTabCache`
- ⏳ Other pages can be updated similarly

## Adding Tab Cache to New Pages

1. Import the hook:
```typescript
import { useTabCache } from '@/hooks/useTabCache'
```

2. Replace useState + useEffect + fetch with useTabCache:
```typescript
// Before
const [data, setData] = useState([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetchData()
}, [])

// After
const { data, loading, refresh } = useTabCache({
  fetchData: async () => {
    // Your fetch logic
  }
})
```

3. Use `refresh()` for manual refresh instead of re-calling fetch function.

## Notes
- Cache is stored in memory (not localStorage)
- Cache clears when app is reloaded
- Each tab has independent cache
- Cache automatically expires after CACHE_DURATION
- Tab state persists during navigation within app
