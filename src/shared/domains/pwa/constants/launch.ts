import { ROOTS } from '@/shared/config/roots'

/** The launch field. The manifest background, the iOS startup images, the icons and the cover all read it. */
export const PWA_LAUNCH_FIELD = '#040f23'

/**
 * Only the installed app's start_url carries this marker, and the service worker serves the static shell
 * for that navigation alone. public/sw.js repeats the literals; change them together.
 */
export const PWA_LAUNCH_PARAM = 'launch'
export const PWA_LAUNCH_VALUE = '1'
export const PWA_START_URL = `${ROOTS.dashboard.root}?${PWA_LAUNCH_PARAM}=${PWA_LAUNCH_VALUE}`

/** The cover never fades sooner than this after the shell's first client render: a warm launch would blink. */
export const PWA_LAUNCH_COVER_MIN_MS = 300
/**
 * The fail-open ceiling for a server that never answers: past it the cover fades over the shell's skeletons.
 * On a launch the server answers, it never binds: the cover lifts when the dashboard layout commits.
 */
export const PWA_LAUNCH_COVER_MAX_MS = 4000
/** Past this with the shell still on screen the soft navigation has failed; a hard load takes over. */
export const PWA_LAUNCH_STALL_MS = 8000
