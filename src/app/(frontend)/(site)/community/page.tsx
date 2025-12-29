import type { Metadata } from 'next'
import { ViewportHero } from '@/shared/components/viewport-hero'

export const metadata: Metadata = {
  title: 'Community',
  description:
    'Join our thriving community of builders, architects, and homeowners who trust Tri Pros Remodeling for their construction needs.',
}

export default function CommunityPage() {
  return (
    <ViewportHero>
      <h1>Community</h1>
    </ViewportHero>
  )
}
