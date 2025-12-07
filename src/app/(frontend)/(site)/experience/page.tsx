import type { Metadata } from 'next'
import { ExperienceView } from '@/features/landing/ui/views/experience-view'

export const metadata: Metadata = {
  title: 'Experience',
  description:
    'Experience Tri Pros Remodeling - Your Trusted Luxury Construction Partner for Over 25 Years',
}

export default function ExperiencePage() {
  return (
    <main className="min-h-screen">
      <ExperienceView />
    </main>
  )
}
