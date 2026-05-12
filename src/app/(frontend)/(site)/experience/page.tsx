import type { Metadata } from 'next'
import { ExperienceView } from '@/features/landing/ui/views/experience-view'

export const metadata: Metadata = {
  title: 'The Tri Pros Experience',
  description:
    'White-glove residential construction in Southern California. A dedicated project lead, fixed-price contracts, and transparent communication on every build.',
}

export default function ExperiencePage() {
  return <ExperienceView />
}
