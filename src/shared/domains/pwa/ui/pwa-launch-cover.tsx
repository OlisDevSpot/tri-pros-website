'use client'

import { usePathname } from 'next/navigation'
import { SplashScreen } from '@/shared/components/splash-screen/splash-screen'
import { ROOTS } from '@/shared/config/roots'
import { usePwaLaunchPhase } from '@/shared/domains/pwa/hooks/use-pwa-launch-phase'

function noop() {}

/**
 * The installed app's launch cover, continuing the native startup image: the mark at rest on the launch
 * field. Open in the server HTML of the shell document only, so it is that document's first paint; held
 * open through the shell's soft navigation by the launch phase; closed by the dashboard's ready beacon
 * or the bound. Any other document renders nothing. A leaf with no children that reads only the router's
 * pathname, so it cannot disturb a hydrating boundary below it.
 */
export function PwaLaunchCover() {
  const phase = usePwaLaunchPhase()
  const pathname = usePathname()
  const open = phase === 'covering' || (phase === 'idle' && pathname === ROOTS.pwa.shell)
  return <SplashScreen dismiss={{ mode: 'held' }} entrance={false} open={open} onDismiss={noop} />
}
