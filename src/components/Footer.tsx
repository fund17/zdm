'use client'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 py-2 px-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="text-xs text-slate-600">
          © {new Date().getFullYear()} ZMG Management System. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
