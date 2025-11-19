import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AppLayout from '@/components/AppLayout'
import { TabProvider } from '@/contexts/TabContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ZMG - Management System',
  description: 'Professional management system with Google Sheets integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TabProvider>
          <AppLayout>
            {children}
          </AppLayout>
        </TabProvider>
      </body>
    </html>
  )
}