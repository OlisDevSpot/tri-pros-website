import type { Metadata } from 'next'
import AboutHero from '@/features/landing/ui/components/about/about-hero'
import CompanyStory from '@/features/landing/ui/components/about/company-story'
import CredentialsSection from '@/features/landing/ui/components/about/credentials'
import { ProcessOverview } from '@/features/landing/ui/components/about/process-overview'
import TeamSection from '@/features/landing/ui/components/about/team'
import BottomCTA from '@/shared/components/cta'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn about our company heritage, founder\'s story, and the master craftsmen who have been building architectural masterpieces for over 25 years.',
}

export default function AboutPage() {
  return (
    <main className="min-h-screen container">
      <AboutHero />
      <CompanyStory />
      <TeamSection />
      <CredentialsSection />
      <ProcessOverview />
      <BottomCTA />
    </main>
  )
}
