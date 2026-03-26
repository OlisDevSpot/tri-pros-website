'use client'

import type { RealtimeEvents } from './realtime'
import { createRealtime } from '@upstash/realtime/client'

export const { useRealtime } = createRealtime<RealtimeEvents>()
