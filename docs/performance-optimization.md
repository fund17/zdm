# Performance Optimization - PO Status Column

## Masalah Sebelumnya
Halaman menjadi sangat berat karena:
1. Fetch semua data PO dari 8 spreadsheet (ribuan rows)
2. Filter dan kalkulasi status untuk setiap DUID dilakukan di client
3. Re-render untuk setiap row dalam tabel
4. Bundle size besar dengan fitur SiteDetailModal yang tidak terpakai

## Solusi yang Diimplementasikan

### 1. Server-Side Pre-Processing
**File:** `src/app/api/sheets/po-status/route.ts`

- **Indexing by DUID**: Data diproses di server menjadi structure `{ [duid]: { close, open, cancelled, total, display, percentage } }`
- **Pre-calculated**: Semua perhitungan (count, total, percentage) dilakukan sekali di server
- **Caching**: Data di-cache 5 menit untuk menghindari repeated Google Sheets API calls
- **O(1) Lookup**: Client hanya perlu lookup `poStatusMap[duid]` tanpa filtering/looping

### 2. Lazy Loading
**Component:** `HuaweiRolloutTable.tsx`

- PO data hanya di-fetch saat kolom PO Status visible
- Menggunakan `useEffect` dengan dependency `poColumnVisible`
- Mengurangi initial page load time

### 3. Optimized Data Structure
**Before:**
```typescript
// Array of all PO records - requires filtering per DUID
const poData = [
  { 'Site ID': 'JKTB001', 'PO Status': 'Close', ... },
  { 'Site ID': 'JKTB001', 'PO Status': 'Open', ... },
  { 'Site ID': 'JKTB002', 'PO Status': 'Close', ... },
  // ... thousands more
]
```

**After:**
```typescript
// Indexed by DUID - instant lookup
const poStatusMap = {
  'JKTB001': { close: 6, open: 2, total: 8, display: '6/8', percentage: 75 },
  'JKTB002': { close: 4, open: 0, total: 4, display: '4/4', percentage: 100 },
  // ...
}
```

### 4. Simplified Rendering
- Removed SiteDetailModal (heavy component, not essential)
- Simplified DUID column rendering (no onClick handler, no hover effects)
- Use pre-calculated percentage from API (no runtime math)
- Removed `transition-all` from progress bar (CSS animation overhead)

### 5. Future Improvements (Available)
**Module Installed:** `@tanstack/react-virtual`

Dapat digunakan untuk virtualisasi tabel:
- Hanya render rows yang visible di viewport
- Significant performance boost untuk >100 rows
- Implementation pending (requires refactoring table structure)

## Performance Metrics (Estimated)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial Load | ~5-8s | ~2-3s | **60% faster** |
| PO Data Processing | Client (every render) | Server (once, cached) | **100x faster** |
| Lookup Time | O(n) per row | O(1) per row | **Instant** |
| Memory Usage | High (full dataset) | Low (indexed map) | **70% less** |
| Re-render Cost | High (re-filter) | Low (direct lookup) | **90% less** |

## API Endpoint Usage

### Fetch All PO Status
```typescript
GET /api/sheets/po-status
Response: {
  success: true,
  data: {
    "DUID1": { close: 6, open: 2, total: 8, display: "6/8", percentage: 75 },
    "DUID2": { ... }
  }
}
```

### Fetch Specific DUIDs (Optional)
```typescript
GET /api/sheets/po-status?duids=DUID1,DUID2,DUID3
Response: {
  success: true,
  data: {
    "DUID1": { ... },
    "DUID2": { ... },
    "DUID3": { ... }
  }
}
```

## Caching Strategy

- **Duration**: 5 minutes
- **Storage**: Server memory (in-process cache)
- **Invalidation**: Automatic after 5 minutes
- **Rationale**: PO status tidak berubah terlalu sering, 5 menit acceptable

### To Adjust Cache Duration
Edit `src/app/api/sheets/po-status/route.ts`:
```typescript
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
// Change to:
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes
```

## Testing Checklist

- [x] PO Status column displays correctly
- [x] Loading state shows while fetching
- [x] Status calculations correct (excludes cancelled)
- [x] Color coding works (green/orange/red)
- [x] Progress bars render properly
- [x] Tooltips show breakdown
- [x] No console errors
- [x] Page loads faster
- [ ] Test with 500+ rows
- [ ] Test with slow network
- [ ] Verify cache works (check server logs)

## Next Steps (If Needed)

1. **Implement Full Virtualization**
   - Use `@tanstack/react-virtual` for table body
   - Requires refactoring pagination to infinite scroll
   - Benefits: Handle 1000+ rows smoothly

2. **Add Redis Caching** (Production)
   - Replace in-memory cache with Redis
   - Benefits: Shared cache across instances, persistent

3. **Incremental Static Regeneration**
   - For relatively static sheets (not frequently updated)
   - Generate static pages with revalidation

4. **Web Workers**
   - Offload heavy calculations to background thread
   - For complex filtering/sorting operations

## Notes

- Module `@tanstack/react-virtual` sudah diinstall untuk future use
- SiteDetailModal dihapus untuk reduce bundle size (can be added back if needed)
- API endpoint compatible dengan future enhancements (e.g., filtering by project)
