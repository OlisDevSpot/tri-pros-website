import { sessionStorageKey } from '@/shared/constants/storage-keys'

/**
 * Once per browser session (`tri-pros:app-splash-shown`). The PWA splash writes the same key,
 * so an installed launch and a proposal link share one showing per session, as before.
 */
export const PROPOSAL_SPLASH_KEY = sessionStorageKey('app-splash-shown')
