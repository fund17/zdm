# Converting Pages to Use Tab Cache

## Quick Guide for Converting Existing Pages

### Before (Traditional useState + useEffect):
```typescript
export default function MyPage() {
  const [data, setData] = useState<MyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/my-data')
      const result = await response.json()
      setData(result.data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchData()
  }

  return (
    <div>
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage error={error} />}
      {data && <DataDisplay data={data} />}
      <button onClick={handleRefresh}>Refresh</button>
    </div>
  )
}
```

### After (With useTabCache):
```typescript
import { useTabCache } from '@/hooks/useTabCache'

export default function MyPage() {
  const { data, loading, error, refresh } = useTabCache<MyData[]>({
    fetchData: async () => {
      const response = await fetch('/api/my-data')
      const result = await response.json()
      return result.data
    }
  })

  return (
    <div>
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage error={error} />}
      {data && <DataDisplay data={data} />}
      <button onClick={refresh}>Refresh</button>
    </div>
  )
}
```

## Step-by-Step Conversion

### 1. Add Import
```typescript
import { useTabCache } from '@/hooks/useTabCache'
```

### 2. Replace useState Declarations
Remove:
```typescript
const [data, setData] = useState<Type[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
```

Add:
```typescript
const { data, loading, error, refresh, setData } = useTabCache<Type[]>({
  fetchData: async () => {
    // Your fetch logic here
    const response = await fetch('/api/endpoint')
    const result = await response.json()
    return result.data // Must return the data
  }
})
```

### 3. Remove useEffect for Initial Fetch
Remove:
```typescript
useEffect(() => {
  fetchData()
}, [])
```

The hook automatically fetches on mount.

### 4. Update Refresh Functions
Replace all calls to your fetch function with `refresh()`:
```typescript
// Before
const handleRefresh = () => {
  fetchData()
}

// After
const handleRefresh = () => {
  refresh()
}
```

Or directly use `refresh` from the hook:
```typescript
<button onClick={refresh}>Refresh</button>
```

### 5. Handle Null Data
Since cached data can be `null`, add null checks:
```typescript
// Before
<DataTable data={data} />

// After
<DataTable data={data || []} />
```

Or:
```typescript
{data && <DataTable data={data} />}
```

## Advanced Usage

### With Dependencies
If your fetch depends on other state:
```typescript
const [filter, setFilter] = useState('all')

const { data, loading, refresh } = useTabCache({
  fetchData: async () => {
    const response = await fetch(`/api/data?filter=${filter}`)
    return response.json()
  },
  dependencies: [filter] // Refetch when filter changes
})
```

### Manual Data Updates
Use `setData` to update cache without refetch:
```typescript
const { data, setData } = useTabCache({...})

const handleUpdate = (newItem) => {
  setData([...data, newItem]) // Updates cache immediately
}
```

### Conditional Fetching
Skip fetch if dependencies aren't ready:
```typescript
const { data, loading } = useTabCache({
  fetchData: async () => {
    if (!userId) return [] // Return empty if not ready
    const response = await fetch(`/api/users/${userId}`)
    return response.json()
  },
  dependencies: [userId]
})
```

## Pages to Convert

### ✅ Already Converted
- `/users` - User Management
- `/daily-plan` - Daily Plan Table
- `/dashboard/itc-huawei` - ITC Huawei Dashboard (partial)

### ⏳ Pending Conversion
- `/dashboard/po-huawei` - PO Huawei Dashboard
- `/dashboard/daily` - Daily Dashboard
- `/itc-huawei` - ITC Huawei Project Page
- `/` - Home page (if has data fetching)
- `/profile` - Profile page (if has data fetching)

## Benefits of Tab Cache

1. **Performance**: 
   - No refetch when switching back to tab (within 5 min)
   - Reduced API calls = faster response
   - Better UX with instant data display

2. **User Experience**:
   - Seamless tab switching
   - No loading state when returning to tab
   - Work on multiple pages simultaneously

3. **Developer Experience**:
   - Less boilerplate code
   - Automatic cache management
   - Consistent pattern across pages

4. **Resource Efficiency**:
   - Reduced server load
   - Lower bandwidth usage
   - Smart cache expiration

## Common Patterns

### Loading States
```typescript
const { data, loading } = useTabCache({...})

if (loading) return <LoadingSpinner />
if (!data) return <EmptyState />
return <DataDisplay data={data} />
```

### Error Handling
```typescript
const { data, error, refresh } = useTabCache({...})

if (error) {
  return (
    <ErrorBanner 
      message={error}
      onRetry={refresh}
    />
  )
}
```

### Combining with Local State
```typescript
const { data: serverData } = useTabCache({...})
const [localFilters, setLocalFilters] = useState({...})

const filteredData = useMemo(() => {
  if (!serverData) return []
  return serverData.filter(item => /* filter logic */)
}, [serverData, localFilters])
```

## Testing

After converting a page:
1. Open the page → Should fetch data
2. Switch to another tab → Navigate away
3. Switch back to original tab → Should use cache (instant load)
4. Wait 5+ minutes → Switch back → Should refetch (cache expired)
5. Click refresh button → Should force refetch and update cache

## Troubleshooting

### Data not updating after mutation
Use `refresh()` after POST/PUT/DELETE:
```typescript
const handleSave = async () => {
  await fetch('/api/save', { method: 'POST', body: ... })
  await refresh() // Refetch to get updated data
}
```

### Cache not working
Check:
- Is component wrapped in `<TabProvider>`?
- Is `fetchData` returning data (not setting state)?
- Are dependencies array correct?

### TypeScript errors
Ensure type parameter matches return type:
```typescript
// ✅ Correct
const { data } = useTabCache<User[]>({
  fetchData: async () => {
    // ... fetch logic
    return users // Type: User[]
  }
})

// ❌ Wrong
const { data } = useTabCache<User[]>({
  fetchData: async () => {
    setUsers(users) // Don't set state here
  }
})
```

## Next Steps

1. Convert remaining dashboard pages
2. Test tab switching behavior
3. Monitor cache hit rates
4. Adjust CACHE_DURATION if needed (default: 5 min)
5. Consider adding cache invalidation strategies for real-time data
