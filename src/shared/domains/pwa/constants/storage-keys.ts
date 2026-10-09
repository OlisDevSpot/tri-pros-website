import { STORAGE_KEY_PREFIX } from '@/shared/constants/storage-keys'

/** '1' on a device switches the service worker off: it is removed, with its caches, on the next load. */
export const PWA_SW_DISABLED_KEY = `${STORAGE_KEY_PREFIX}sw-disabled`
