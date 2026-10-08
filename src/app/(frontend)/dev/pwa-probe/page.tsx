import type { Metadata } from 'next'
import { PwaProbe } from '@/shared/domains/pwa/ui/pwa-probe'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PwaProbePage() {
  return <PwaProbe />
}
