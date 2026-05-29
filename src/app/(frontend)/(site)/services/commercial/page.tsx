import type { Metadata } from 'next'
import { ComingSoonState } from '@/shared/components/states/coming-soon-state'

export const metadata: Metadata = {
  title: 'Commercial',
  description:
    'Tri Pros Remodeling commercial construction services — tenant improvements, build-outs, and ground-up projects across Southern California.',
}

export default function ServicesCommercialPage() {
  return (
    <ComingSoonState
      size="page"
      title={'Commercial work\nis getting framed up'}
      description="Tenant improvements, build-outs, and ground-up commercial projects across Southern California. Page goes live as soon as the paint dries."
      homeHref="/services"
      homeLabel="Browse all services →"
    />
  )
}
