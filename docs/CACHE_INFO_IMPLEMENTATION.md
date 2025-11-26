# 📝 Cara Implementasi Cache Info di Dashboard

## 1. Import Component

Tambahkan di dashboard yang menggunakan PO data (ITC Huawei, PO Huawei, RNO Huawei):

```tsx
import { CacheInfoBanner, CacheInfoCompact, CacheInfoBadge } from '@/components/CacheInfo'
```

## 2. Implementasi di Dashboard

### Option A: Banner (Recommended - Most visible)

```tsx
// src/app/dashboard/itc-huawei/page.tsx
export default function ItcHuaweiDashboard() {
  const [poData, setPoData] = useState<any>(null)
  
  useEffect(() => {
    const fetchPO = async () => {
      const res = await fetch('/api/sheets/po-huawei')
      const data = await res.json()
      setPoData(data)
    }
    fetchPO()
  }, [])

  return (
    <div className="p-4">
      {/* Tambahkan di atas dashboard content */}
      {poData?.cacheInfo && (
        <CacheInfoBanner 
          lastUpdated={poData.lastUpdated}
          nextRefresh={poData.cacheInfo.nextRefresh}
        />
      )}
      
      {/* Rest of dashboard */}
      <div className="grid grid-cols-3 gap-4">
        {/* Cards, charts, etc */}
      </div>
    </div>
  )
}
```

### Option B: Compact (Inline with header)

```tsx
// src/app/dashboard/po-huawei/page.tsx
export default function PoHuaweiDashboard() {
  const [poData, setPoData] = useState<any>(null)

  return (
    <div className="p-4">
      {/* Header with cache info */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">PO Huawei Dashboard</h1>
        {poData?.lastUpdated && (
          <CacheInfoCompact lastUpdated={poData.lastUpdated} />
        )}
      </div>
      
      {/* Dashboard content */}
    </div>
  )
}
```

### Option C: Badge (Minimal - Near title)

```tsx
// src/app/dashboard/rno-huawei/page.tsx
export default function RnoHuaweiDashboard() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">RNO Huawei Dashboard</h1>
        <CacheInfoBadge />
      </div>
      
      {/* Dashboard content */}
    </div>
  )
}
```

## 3. Complete Example

```tsx
'use client'

import { useState, useEffect } from 'react'
import { CacheInfoBanner } from '@/components/CacheInfo'
import { LoadingSpinner } from '@/components/LoadingSpinner'

export default function ItcHuaweiDashboard() {
  const [allData, setAllData] = useState<any[]>([])
  const [poData, setPoData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch ITC data
        const itcRes = await fetch('/api/sheets/itc-huawei')
        const itcData = await itcRes.json()
        setAllData(itcData.data || [])

        // Fetch PO data (cached weekly)
        const poRes = await fetch('/api/sheets/po-huawei')
        const poData = await poRes.json()
        setPoData(poData)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 p-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        {/* Header */}
        <h1 className="text-xl font-bold text-slate-900 mb-4">
          ITC Huawei Dashboard
        </h1>

        {/* Cache Info Banner */}
        {poData?.cacheInfo && (
          <CacheInfoBanner 
            lastUpdated={poData.lastUpdated}
            nextRefresh={poData.cacheInfo.nextRefresh}
          />
        )}

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Your cards, charts, tables here */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold">Total Sites</h3>
            <p className="text-3xl font-bold">{allData.length}</p>
          </div>
          
          {/* More cards... */}
        </div>
      </div>
    </div>
  )
}
```

## 4. Styling Customization

### Custom Colors (Match your theme):

```tsx
// Blue theme (default)
<CacheInfoBanner /> 

// Green theme
<div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 ...">

// Purple theme
<div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 ...">

// Amber theme (warning style)
<div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 ...">
```

### Size Variants:

```tsx
// Large (hero banner)
<div className="p-4"> ... </div>

// Medium (default)
<div className="p-3"> ... </div>

// Small (compact)
<div className="p-2"> ... </div>
```

## 5. Advanced: With Refresh Button (Admin Only)

```tsx
import { CacheInfoBanner } from '@/components/CacheInfo'
import { RefreshCw } from 'lucide-react'

export default function Dashboard() {
  const [poData, setPoData] = useState<any>(null)
  const [refreshing, setRefreshing] = useState(false)

  const handleForceRefresh = async () => {
    if (!confirm('Force refresh cache? This will fetch fresh data from Google Sheets.')) {
      return
    }

    setRefreshing(true)
    try {
      // Option 1: Force redeploy via Vercel API (future)
      // Option 2: Clear specific cache (future)
      // Option 3: For now, just refetch
      const res = await fetch('/api/sheets/po-huawei', {
        cache: 'no-store', // Bypass cache
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const data = await res.json()
      setPoData(data)
      alert('✅ Data refreshed successfully!')
    } catch (error) {
      alert('❌ Failed to refresh data')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="p-4">
      {/* Banner with refresh button */}
      <div className="relative">
        {poData?.cacheInfo && (
          <CacheInfoBanner 
            lastUpdated={poData.lastUpdated}
            nextRefresh={poData.cacheInfo.nextRefresh}
          />
        )}
        
        {/* Admin refresh button (top-right of banner) */}
        {isAdmin && (
          <button
            onClick={handleForceRefresh}
            disabled={refreshing}
            className="absolute top-3 right-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Force Refresh'}
          </button>
        )}
      </div>
      
      {/* Rest of dashboard */}
    </div>
  )
}
```

## 6. Mobile Responsive

Component sudah responsive by default:

```tsx
// Desktop: 2 columns
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

// Mobile: Stack vertically
// Tablet+: Side by side
```

## 7. Loading State

```tsx
{loading ? (
  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 animate-pulse">
    <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
    <div className="h-3 bg-slate-200 rounded w-2/3"></div>
  </div>
) : (
  poData?.cacheInfo && (
    <CacheInfoBanner 
      lastUpdated={poData.lastUpdated}
      nextRefresh={poData.cacheInfo.nextRefresh}
    />
  )
)}
```

## 8. Hide After User Sees

```tsx
const [showCacheInfo, setShowCacheInfo] = useState(() => {
  // Show by default, hide after user dismisses
  return localStorage.getItem('hideCacheInfo') !== 'true'
})

const handleDismiss = () => {
  localStorage.setItem('hideCacheInfo', 'true')
  setShowCacheInfo(false)
}

return (
  <>
    {showCacheInfo && poData?.cacheInfo && (
      <div className="relative">
        <CacheInfoBanner {...poData} />
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-blue-600 hover:text-blue-800"
        >
          ✕
        </button>
      </div>
    )}
  </>
)
```

---

Choose the implementation that best fits your UI! 🎨
