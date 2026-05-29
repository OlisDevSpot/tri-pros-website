import type { Metadata } from 'next'
import { ComingSoonState } from '@/shared/components/states/coming-soon-state'

export const metadata: Metadata = {
  title: 'Community',
  description:
    'Join our thriving community of builders, architects, and homeowners who trust Tri Pros Remodeling for their construction needs.',
}

export default function CommunityPage() {
  return (
    <ComingSoonState
      size="page"
      title={'Our community space\nis still being built'}
      description="A home for partners, neighbors, and homeowners to plug into what we're building across Southern California. We're framing it now — check back soon."
      homeHref="/"
    />
  )
}
