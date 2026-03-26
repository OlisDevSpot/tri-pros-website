'use client'

import { RealtimeProvider as UpstashRealtimeProvider } from '@upstash/realtime/client'

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  return (
    <UpstashRealtimeProvider
      api={{
        url: '/api/realtime',
        withCredentials: true,
      }}
      maxReconnectAttempts={10}
    >
      {children}
    </UpstashRealtimeProvider>
  )
}
