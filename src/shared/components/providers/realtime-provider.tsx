'use client'

import { AblyProvider } from 'ably/react'
import { ablyClient } from '@/shared/services/upstash/realtime-client'

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  return (
    <AblyProvider client={ablyClient}>
      {children}
    </AblyProvider>
  )
}
