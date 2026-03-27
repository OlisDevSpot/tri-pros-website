'use client'

import * as Ably from 'ably'

// Subscribe-only key — safe for client-side use
// eslint-disable-next-line node/prefer-global/process
const apiKey = process.env.NEXT_PUBLIC_ABLY_API_KEY!

export const ablyClient = new Ably.Realtime({
  key: apiKey,
  autoConnect: typeof window !== 'undefined',
})
