import { handle } from '@upstash/realtime'
import { realtime } from '@/shared/services/upstash/realtime'

export const GET = handle({
  realtime,
  middleware: async ({ request: _req, channels: _channels }) => {
    // TODO: Add auth check once meeting-specific auth is decided
    // For now, allow all connections (meetings are agent-only)

  },
})

export const runtime = 'nodejs'
export const maxDuration = 300
