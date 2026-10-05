import type { DialerProvider } from './types'

import { justcallDialerProvider } from '@/shared/services/providers/justcall/dialer-provider'

// The SINGLE seam binding — the one place the app names its live dialer
// provider. Consumers in services/voip/campaigns/* import `dialerProvider` from
// here (never providers/justcall/* directly). Swapping providers = one line.
export const dialerProvider: DialerProvider = justcallDialerProvider

export * from './types'
