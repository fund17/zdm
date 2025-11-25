# 🚀 Optimization Plan - Reduce Vercel Bandwidth Usage

## Current Problems Causing High Bandwidth:

### 1. ❌ PO Huawei Data Fetched on Every Dashboard Load
- **Location**: `src/app/dashboard/itc-huawei/page.tsx`, `src/app/dashboard/po-huawei/page.tsx`, `src/app/dashboard/rno-huawei/page.tsx`, `src/app/page.tsx`
- **Issue**: Full PO data (thousands of rows) fetched every time
- **Impact**: Hundreds of KB transferred per page load

### 2. ❌ No Server-Side Caching
- **Issue**: All API routes use `force-dynamic`, no caching
- **Impact**: Every request hits Google Sheets API

### 3. ❌ Multiple Parallel Fetches
- **Issue**: 5+ sheets fetched simultaneously on dashboard load
- **Impact**: Bandwidth multiplied by number of sheets

### 4. ❌ Large Data Transfers
- **Issue**: Full sheets data sent to client
- **Impact**: 500KB - 2MB per dashboard load

---

## 🎯 Solutions to Implement:

### Phase 1: Immediate Fixes (Reduce 70% bandwidth)

#### 1.1 Enable Next.js Static Data Caching
```javascript
// next.config.js
const nextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 300, // 5 minutes
    },
  },
  // ... existing config
}
```

#### 1.2 Add Revalidation to API Routes
```typescript
// Example: src/app/api/sheets/po-huawei/route.ts
export const revalidate = 300 // 5 minutes cache

export async function GET(request: NextRequest) {
  // ... existing code
}
```

#### 1.3 Implement API Response Caching
```typescript
// Add to API routes
const headers = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
}

return NextResponse.json(data, { headers })
```

#### 1.4 Move PO Data Loading to Background
Instead of fetching on every dashboard load:
- Load PO data only when needed (on-demand)
- Use SWR or React Query with longer cache times
- Store in IndexedDB instead of localStorage

### Phase 2: Data Optimization (Reduce 20% bandwidth)

#### 2.1 Implement Data Pagination
```typescript
// Only fetch visible/needed rows
const pageSize = 100
const offset = page * pageSize
```

#### 2.2 Compress API Responses
```typescript
// Add gzip compression
import { gzip } from 'zlib'
import { promisify } from 'util'

const gzipAsync = promisify(gzip)
```

#### 2.3 Send Only Required Fields
```typescript
// Instead of full row data
const optimizedData = data.map(row => ({
  duid: row['DUID'],
  name: row['DU Name'],
  // Only essential fields
}))
```

### Phase 3: Architecture Improvements (Reduce 10% bandwidth)

#### 3.1 Implement Redis/Upstash Cache
```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Cache PO data for 5 minutes
const cached = await redis.get('po_huawei_data')
if (cached) return cached

// Fetch and cache
const data = await fetchFromGoogleSheets()
await redis.set('po_huawei_data', data, { ex: 300 })
```

#### 3.2 Use Server Components
Convert pages to Server Components where possible:
```tsx
// app/dashboard/itc-huawei/page.tsx
export default async function ItcHuaweiDashboard() {
  // Fetch on server, cache automatically
  const data = await fetchITCData()
  
  return <ClientComponent data={data} />
}
```

#### 3.3 Implement Incremental Static Regeneration (ISR)
```typescript
export const revalidate = 300 // Regenerate every 5 minutes

export default async function Dashboard() {
  const data = await getData()
  return <DashboardView data={data} />
}
```

---

## 📊 Expected Impact:

| Optimization | Bandwidth Reduction | Effort |
|--------------|---------------------|--------|
| API Caching | 60-70% | Low |
| Data Pagination | 10-15% | Medium |
| Compression | 5-10% | Low |
| Redis Cache | 15-20% | Medium |
| Server Components | 5-10% | High |

**Total Expected Reduction: 85-90%**

---

## 🔧 Quick Wins (Implement First):

1. **Add revalidate to all API routes**
   - Time: 30 minutes
   - Impact: 60% reduction

2. **Add Cache-Control headers**
   - Time: 15 minutes
   - Impact: 10% reduction

3. **Lazy load PO data**
   - Time: 1 hour
   - Impact: 20% reduction

4. **Remove parallel fetches on home page**
   - Time: 30 minutes
   - Impact: 5% reduction

---

## 📝 Implementation Priority:

### Week 1:
- [ ] Add revalidate to all `/api/sheets/*` routes
- [ ] Add Cache-Control headers
- [ ] Test bandwidth reduction

### Week 2:
- [ ] Implement lazy loading for PO data
- [ ] Add data pagination
- [ ] Optimize home page fetches

### Week 3:
- [ ] Set up Upstash Redis (free tier)
- [ ] Implement Redis caching
- [ ] Convert dashboards to Server Components

---

## 🚨 Critical Files to Update:

1. `src/app/api/sheets/po-huawei/route.ts` - Add caching
2. `src/app/api/sheets/itc-huawei/route.ts` - Add caching
3. `src/app/dashboard/itc-huawei/page.tsx` - Lazy load PO data
4. `src/app/dashboard/po-huawei/page.tsx` - Lazy load data
5. `src/app/page.tsx` - Remove parallel fetches
6. `next.config.js` - Enable caching

---

## 📈 Monitoring:

After implementing:
1. Check Vercel Analytics → Bandwidth
2. Monitor Fast Origin Transfer usage
3. Test page load times
4. Verify data freshness

---

## 🎯 Target Metrics:

| Metric | Current | Target |
|--------|---------|--------|
| Dashboard Load | 1-2MB | 100-200KB |
| API Response Time | 2-3s | 200-500ms |
| Bandwidth/Day | High | 85% reduction |
| Cache Hit Rate | 0% | 80%+ |
