import { ReactNode } from 'react'

export default function PendingActivationLayout({
  children,
}: {
  children: ReactNode
}) {
  // Simple layout without sidebar or navbar for pending activation page
  return <>{children}</>
}
