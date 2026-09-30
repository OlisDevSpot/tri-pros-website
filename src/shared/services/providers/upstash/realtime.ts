import { lazyAsync } from '@/shared/config/lazy-async'

import { getAblyConfig } from './lib/config'

// HOW REALTIME SYNC WORKS:
// 1. A tRPC mutation writes to Postgres
// 2. After the write, the server publishes an event to an Ably channel (meeting:{id})
// 3. The receiving client's useChannel hook picks up the event via WebSocket
// 4. The hook calls invalidate() → React Query refetches from DB
//
// The client IGNORES the event payload — it only uses the event as a trigger to refetch.
// We still send the changed data for forward-compatibility: if we ever want to skip the
// refetch and apply changes directly to the React Query cache (lower latency, offline
// support), the data is already there.
//
// Ably REST client is used server-side (short-lived HTTP POST to publish, no persistent
// connection). The client-side uses Ably Realtime (WebSocket, managed by Ably's infra —
// no Vercel function time consumed for the connection).
//
// The REST client loads and is constructed on the first publish, not at boot: the SDK
// brings its own HTTP and WebSocket stacks, which no page render needs. A missing
// ABLY_API_KEY rejects that first publish with `NotConfiguredError` instead of crashing
// app boot.

function createRealtimeClient() {
  const rest = lazyAsync(async () => {
    const { Rest } = await import('ably')
    return new Rest({ key: getAblyConfig().apiKey })
  })

  return {
    async publish(channel: string, event: string, data: unknown): Promise<void> {
      await (await rest()).channels.get(channel).publish(event, data)
    },
  }
}

export type RealtimeClient = ReturnType<typeof createRealtimeClient>

export const realtimeClient = createRealtimeClient()
