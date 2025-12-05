import BottomCTA from '@/components/cta'
import AboutHero from '@/features/landing/ui/components/about/about-hero'
import CompanyStory from '@/features/landing/ui/components/about/company-story'
import CredentialsSection from '@/features/landing/ui/components/about/credentials'
import { FounderStory } from '@/features/landing/ui/components/about/founder-story'
import ProcessOverview from '@/features/landing/ui/components/about/process-overview'
import TeamSection from '@/features/landing/ui/components/about/team'

export const metadata = {
  title: 'About Tri Pros Remodeling | Three Generations of Master Craftsmanship',
  description:
    'Learn about our company heritage, founder\'s story, and the master craftsmen who have been building architectural masterpieces for over 25 years.',
}

export default function AboutPage() {
  return (
    <main className="min-h-screen container">
      <AboutHero />
      <FounderStory />
      <CompanyStory />
      <TeamSection />
      <CredentialsSection />
      <ProcessOverview />
      <BottomCTA />
    </main>
  )
}
