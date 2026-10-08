import { sessionStorageKey } from '@/shared/constants/storage-keys'

/** Once per browser session (`tri-pros:app-splash-shown`): a proposal link shows the splash once, then not again that session. */
export const PROPOSAL_SPLASH_KEY = sessionStorageKey('app-splash-shown')
