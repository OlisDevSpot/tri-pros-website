import type { Metadata } from 'next'
import { ComingSoonState } from '@/shared/components/states/coming-soon-state'

export const metadata: Metadata = {
  title: 'Design-Build',
  description:
    'End-to-end design-build services from Tri Pros Remodeling — architectural planning, permitting, and construction under one roof.',
}

export default function ServicesDesignBuildPage() {
  return (
    <ComingSoonState
      size="page"
      title={'Design-build details\nare on the table'}
      description="Architectural drawings to final walkthrough, all under one roof. We're laying out the full story of how it works here — back in a hard hat moment."
      homeHref="/services"
      homeLabel="Browse all services →"
    />
  )
}
