# Cache Strategy Update - Vercel Edge Cache

## Problem Statement
Cache di Vercel Edge tidak ter-update setelah user melakukan perubahan data melalui:
- Inline editing pada tabel
- Import data dari Excel
- Batch update

Hal ini menyebabkan data yang ditampilkan tidak sinkron dengan Google Sheets.

## Solution Implemented

### 1. Daily Plan Table - Direct Fetch (No Cache)
**File**: `/src/app/api/sheets/route.ts`

**Changes**:
```typescript
// Before
export const revalidate = 10800 // 3 hours cache
response.headers.set('Cache-Control', 'public, s-maxage=10800, stale-while-revalidate=30')

// After
export const revalidate = 0 // No cache
response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
```

**Reason**: Daily Plan adalah tabel yang paling sering di-update melalui inline editing, sehingga lebih baik menggunakan direct fetch untuk memastikan data selalu fresh.

### 2. ITC Huawei & RNO Huawei - Cache with Revalidation
**Files**: 
- `/src/app/api/sheets/itc-huawei/route.ts`
- `/src/app/api/sheets/rno-huawei/route.ts`

**Strategy**: Tetap menggunakan cache 3 jam, namun cache akan di-invalidate otomatis setelah ada update/import.

### 3. Cache Invalidation Functions

#### ITC Huawei
**Files with invalidation**:
- `/src/app/api/sheets/itc-huawei/update/route.ts` - Single cell update
- `/src/app/api/sheets/itc-huawei/batch-update/route.ts` - Batch update
- `/src/app/api/sheets/itc-huawei/import/route.ts` - Import data

```typescript
function invalidateItcCache() {
  try {
    revalidatePath('/api/sheets/itc-huawei')
    revalidatePath('/itc-huawei')
    revalidatePath('/dashboard/itc-huawei')
    console.log('ITC Huawei cache invalidated')
  } catch (error) {
    console.warn('Failed to invalidate ITC cache:', error)
  }
}
```

#### RNO Huawei
**Files with invalidation**:
- `/src/app/api/sheets/rno-huawei/update/route.ts` - Single cell update
- `/src/app/api/sheets/rno-huawei/import/route.ts` - Import data

```typescript
function invalidateRnoCache() {
  try {
    revalidatePath('/api/sheets/rno-huawei')
    revalidatePath('/rno-huawei')
    revalidatePath('/dashboard/rno-huawei')
    console.log('RNO Huawei cache invalidated')
  } catch (error) {
    console.warn('Failed to invalidate RNO cache:', error)
  }
}
```

## Benefits

### 1. Daily Plan - Always Fresh
- ✅ No stale data after inline editing
- ✅ Immediate updates visible to all users
- ⚠️ Slightly higher bandwidth usage (trade-off for data freshness)

### 2. ITC/RNO Huawei - Optimized Balance
- ✅ Reduced bandwidth usage (3 hour cache)
- ✅ Automatic cache invalidation after updates
- ✅ Fresh data after user actions
- ✅ Fast loading for read-only operations

## Cache Flow

### Before Update
```
User Request → Edge Cache (3 hours) → Return Cached Data
```

### After Update
```
1. User updates data → Google Sheets updated
2. revalidatePath() called → Edge Cache invalidated
3. Next user request → Edge Cache MISS → Fetch from Google Sheets
4. New data cached for 3 hours
```

## Testing Checklist

- [ ] Test inline editing pada Daily Plan - data langsung update
- [ ] Test import Excel pada Daily Plan - data langsung update
- [ ] Test inline editing pada ITC Huawei - cache ter-invalidate
- [ ] Test batch update pada ITC Huawei - cache ter-invalidate
- [ ] Test import Excel pada ITC Huawei - cache ter-invalidate
- [ ] Test inline editing pada RNO Huawei - cache ter-invalidate
- [ ] Test import Excel pada RNO Huawei - cache ter-invalidate
- [ ] Verify dashboard data updates after edits

## Performance Impact

### Daily Plan
- **Before**: 3 hour cache, stale data after updates
- **After**: No cache, always fresh data
- **Impact**: Slight increase in Fast Origin Transfer, but guaranteed data accuracy

### ITC/RNO Huawei
- **Before**: 3 hour cache, stale data after updates
- **After**: 3 hour cache + auto-invalidation on updates
- **Impact**: Minimal bandwidth increase, only when users update data

## Migration Notes

1. No database migration required
2. No frontend changes required
3. Cache headers automatically applied
4. Backward compatible with existing code

## Future Improvements

1. **Selective Cache Invalidation**: Only invalidate specific regions/sheets
2. **Optimistic Updates**: Update UI immediately, then sync with server
3. **WebSocket Notifications**: Real-time updates to all connected users
4. **Cache Tags**: More granular cache control with Vercel Cache Tags

## Related Documentation

- [Vercel Edge Caching](https://vercel.com/docs/concepts/edge-network/caching)
- [Next.js revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [Google Sheets API](https://developers.google.com/sheets/api)
