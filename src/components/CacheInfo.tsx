// Component untuk menampilkan cache info di dashboard
// Letakkan di dashboard yang menggunakan PO data

import { Clock, Database, RefreshCw } from 'lucide-react'

interface CacheInfoProps {
  lastUpdated?: string
  nextRefresh?: string
}

export function CacheInfoBanner({ lastUpdated, nextRefresh }: CacheInfoProps) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
          <Database className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-blue-900">
              Weekly Cache Strategy
            </h4>
            <span className="px-2 py-0.5 bg-blue-200 text-blue-700 text-xs font-medium rounded">
              Active
            </span>
          </div>
          <p className="text-xs text-blue-700 mb-2">
            Data PO Huawei di-cache selama 1 minggu untuk menghemat bandwidth 99.7%
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-blue-800">
                <strong>Update terakhir:</strong>{' '}
                {lastUpdated || 'Memuat...'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-blue-800">
                <strong>Update berikutnya:</strong>{' '}
                {nextRefresh || 'Rabu pagi (08:00 WIB)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact version (untuk space terbatas)
export function CacheInfoCompact({ lastUpdated }: { lastUpdated?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
      <Database className="h-3.5 w-3.5 text-slate-500" />
      <span>
        💾 Data di-cache mingguan • Update terakhir: {lastUpdated || 'Memuat...'}
      </span>
    </div>
  )
}

// Badge version (minimal)
export function CacheInfoBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
      <Database className="h-3 w-3" />
      <span>Cached (Weekly)</span>
    </div>
  )
}
