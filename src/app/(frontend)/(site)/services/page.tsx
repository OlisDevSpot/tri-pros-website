import type { Metadata } from 'next'

import { ServicesOverviewView } from '@/features/landing/ui/views/services-overview-view'

export const metadata: Metadata = {
  title: 'Services | Tri Pros Remodeling',
  description:
    'Licensed, insured, and warranted home improvement services in Southern California. Energy-efficient construction, luxury renovations, and more.',
}

// Next.js requires export default for page files
export default function ServicesPage() {
  return (
    <main className="h-full">
      <ServicesOverviewView />
    </main>
  )
}
