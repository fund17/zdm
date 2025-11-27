'use client'

import { HuaweiRolloutPageContent } from '@/components/HuaweiRolloutPageContent'
import { useState, useEffect } from 'react'

export default function ItcHuaweiPage() {
  const [userRegion, setUserRegion] = useState<string | undefined>()

  // Set dynamic page title
  useEffect(() => {
    document.title = 'ZMG - ITC Huawei Rollout'
  }, [])

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/session')
        if (response.ok) {
          const result = await response.json()
          if (result.user?.region) {
            setUserRegion(result.user.region)
          }
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
      }
    }

    fetchUser()
  }, [])

  return (
    <HuaweiRolloutPageContent 
      apiBasePath="/api/sheets/itc-huawei"
      pageTitle="ITC Huawei Rollout"
      userRegion={userRegion}
    />
  )
}
