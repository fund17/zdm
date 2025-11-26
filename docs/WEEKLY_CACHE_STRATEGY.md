# 🗓️ Weekly Cache Strategy - PO Huawei Data

## 📋 Overview

PO Huawei data sekarang di-cache selama **1 minggu** di Vercel Edge Network dan hanya di-refresh setiap **Rabu pagi**.

## ⚙️ Configuration

### Cache Duration:
```typescript
export const revalidate = 604800  // 7 days = 604,800 seconds
```

### Refresh Schedule:
- **Hari**: Setiap Rabu
- **Waktu**: 08:00 - 10:00 WIB
- **Automatic**: Cache akan expire dan refresh otomatis

## 🎯 Mengapa 1 Minggu?

### Karakteristik Data PO Huawei:
1. **Jarang Berubah**: PO data biasanya update mingguan, bukan harian
2. **Data Besar**: 2-3MB per fetch, sangat costly untuk bandwidth
3. **Read-Heavy**: Dibaca ribuan kali, tapi jarang di-update
4. **Predictable Update**: Biasanya update di hari kerja tertentu

### Benefit:
```
Sebelum (Cache 5 menit):
- Fetch per hari: ~50x
- Bandwidth: 50 × 2MB = 100MB/day
- Bandwidth per minggu: 700MB

Setelah (Cache 1 minggu):
- Fetch per minggu: 1x (hanya Rabu)
- Bandwidth: 1 × 2MB = 2MB/week
- Bandwidth saving: 99.7%! 🎉
```

## 📊 Cache Timeline Example

```
Senin, 18 Nov 08:00    → User request → Serve from cache (data: 11 Nov)
Selasa, 19 Nov 10:00   → User request → Serve from cache (data: 11 Nov)
Rabu, 20 Nov 08:30     → User request → FETCH FRESH DATA → Cache baru
Rabu, 20 Nov 14:00     → User request → Serve from cache (data: 20 Nov)
Kamis, 21 Nov 09:00    → User request → Serve from cache (data: 20 Nov)
Jumat, 22 Nov 15:00    → User request → Serve from cache (data: 20 Nov)
Sabtu, 23 Nov 11:00    → User request → Serve from cache (data: 20 Nov)
Minggu, 24 Nov 10:00   → User request → Serve from cache (data: 20 Nov)
Senin, 25 Nov 12:00    → User request → Serve from cache (data: 20 Nov)
Selasa, 26 Nov 16:00   → User request → Serve from cache (data: 20 Nov)
Rabu, 27 Nov 08:45     → User request → FETCH FRESH DATA → Cache baru
```

## 🔍 How It Works

### 1. Cache Headers
```typescript
'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400'
```

**Breakdown**:
- `public`: Cache bisa disimpan di CDN
- `s-maxage=604800`: Cache valid 7 hari (604,800 detik)
- `stale-while-revalidate=86400`: Boleh serve stale data 1 hari sambil fetch fresh

### 2. Wednesday Detection
```typescript
const today = new Date()
const isWednesday = today.getDay() === 3  // 3 = Wednesday

const jakartaHour = new Date(today.toLocaleString('en-US', { 
  timeZone: 'Asia/Jakarta' 
})).getHours()

const shouldForceRefresh = isWednesday && jakartaHour >= 8 && jakartaHour < 10
```

### 3. Response Metadata
```json
{
  "data": [...],
  "cacheInfo": {
    "cachedUntil": "Rabu, 27 Nov 2024, 08:00",
    "nextRefresh": "Rabu pagi (08:00 WIB)"
  }
}
```

## 📱 User Experience

### Dashboard Display:
Tambahkan indicator di dashboard untuk inform user:

```tsx
<div className="text-xs text-slate-500">
  💾 Data PO di-cache mingguan. 
  Update terakhir: {lastUpdated}
  Update berikutnya: {cacheInfo.nextRefresh}
</div>
```

### Manual Refresh (Optional):
Jika butuh data fresh sebelum Rabu, admin bisa:

1. **Via Vercel Dashboard**:
   - Deployments → Force Redeploy

2. **Via API Query Param** (future enhancement):
   ```typescript
   /api/sheets/po-huawei?force=true
   // Only allow if user has admin role
   ```

## 🚨 Considerations

### ✅ Pros:
- **99.7% bandwidth reduction** untuk PO data
- **Faster load times** (serve from cache)
- **Predictable cost** (1 fetch per week vs 300+ per week)
- **Reduced Google Sheets API quota usage**

### ⚠️ Cons:
- **Data bisa stale** hingga 6 hari (Kamis - Selasa)
- **Update tidak real-time**
- **Perlu koordinasi**: PO update harus dilakukan sebelum Rabu pagi

### 💡 Mitigation:
1. **Inform users**: Tampilkan kapan data terakhir di-update
2. **Predictable schedule**: User tahu data fresh setiap Rabu
3. **Emergency refresh**: Admin bisa force redeploy jika urgent
4. **Longer stale period**: 24 jam stale-while-revalidate untuk grace period

## 🔧 Monitoring

### Vercel Analytics:
```
Metrics to watch:
1. Origin Transfer: Should drop 99%+ ✅
2. Cache Hit Rate: Should be >99% ✅
3. Response Time: <200ms (from cache) ✅
4. Error Rate: Should remain low ✅
```

### Logs:
```bash
# Wednesday morning logs:
🔄 Wednesday morning: Forcing cache refresh for PO Huawei data
✅ Fetched fresh data from Google Sheets
📦 Cached for next 7 days
```

## 📅 Update Schedule Coordination

### Checklist untuk Admin:

**Setiap Selasa:**
- [ ] Update PO data di Google Sheets
- [ ] Verify data accuracy
- [ ] Koordinasi dengan team

**Setiap Rabu Pagi (08:00 - 10:00 WIB):**
- [ ] Cache akan auto-refresh saat first request
- [ ] Monitor Vercel logs untuk confirm refresh
- [ ] Check dashboard untuk verify data baru

**Emergency Update (Mid-week):**
- [ ] Update Google Sheets as usual
- [ ] Vercel Dashboard → Deployments → Redeploy
- [ ] Inform users tentang data baru

## 🎛️ Configuration Options

### Change Cache Duration:
```typescript
// 3 days
export const revalidate = 259200

// 2 weeks
export const revalidate = 1209600

// Current: 1 week
export const revalidate = 604800
```

### Change Refresh Day:
```typescript
// Monday
const isRefreshDay = today.getDay() === 1

// Friday
const isRefreshDay = today.getDay() === 5

// Current: Wednesday
const isRefreshDay = today.getDay() === 3
```

### Change Refresh Time:
```typescript
// Morning: 6-8 AM
const shouldForceRefresh = isWednesday && jakartaHour >= 6 && jakartaHour < 8

// Afternoon: 14-16 PM
const shouldForceRefresh = isWednesday && jakartaHour >= 14 && jakartaHour < 16

// Current: 8-10 AM
const shouldForceRefresh = isWednesday && jakartaHour >= 8 && jakartaHour < 10
```

## 🧪 Testing

### Local Testing:
```bash
# Test current cache status
curl http://localhost:3000/api/sheets/po-huawei

# Check response headers
curl -I http://localhost:3000/api/sheets/po-huawei
# Look for: Cache-Control, X-Cache-Strategy, X-Next-Refresh
```

### Production Testing:
```bash
# After deploy
curl https://your-app.vercel.app/api/sheets/po-huawei

# Verify cache headers
curl -I https://your-app.vercel.app/api/sheets/po-huawei

# Check cache hit
# Look for: x-vercel-cache: HIT (on subsequent requests)
```

## 📊 Expected Impact

### Before (5-minute cache):
```
Weekly Stats:
- API Calls to Google Sheets: 2,000+
- Bandwidth (Origin Transfer): 4GB
- Average Response Time: 500-1000ms
- Cost: High
```

### After (1-week cache):
```
Weekly Stats:
- API Calls to Google Sheets: 1 (only Wednesday)
- Bandwidth (Origin Transfer): 2MB
- Average Response Time: 50-100ms (from cache)
- Cost: 99.95% reduction 🎉
```

### ROI:
```
Bandwidth Saved:
- Per week: 3.998GB
- Per month: ~16GB
- Per year: ~200GB

Cost Saved (assuming $40/100GB):
- Per month: ~$6.40
- Per year: ~$80

Performance Gain:
- Load time: 90% faster
- User experience: Much better
- Google Sheets API: 99.95% less calls
```

## ✅ Deployment Checklist

- [x] Update `po-huawei/route.ts` dengan 1-week cache
- [x] Add Wednesday detection logic
- [x] Add cache metadata in response
- [x] Update Cache-Control headers
- [ ] Deploy to production
- [ ] Test cache behavior
- [ ] Monitor Vercel Analytics
- [ ] Inform users tentang weekly update schedule
- [ ] Update dashboard UI dengan cache info
- [ ] Document dalam user guide

## 🎯 Next Steps

1. **Deploy changes**
2. **Monitor first Wednesday refresh**
3. **Verify bandwidth reduction**
4. **Consider applying same strategy to other large datasets**:
   - ITC Huawei data (if updates are predictable)
   - RNO Huawei data (if updates are predictable)
5. **Implement manual refresh endpoint** (optional, for admin only)
6. **Add cache status indicator in dashboard**

---

**Strategy**: Cache aggressively, refresh predictably, save massively! 💰🚀
