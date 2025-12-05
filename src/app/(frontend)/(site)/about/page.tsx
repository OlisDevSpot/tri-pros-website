import BottomCTA from '@/components/cta'
import AboutHero from '@/features/landing/components/about/about-hero'
import CompanyStory from '@/features/landing/components/about/company-story'
import CredentialsSection from '@/features/landing/components/about/credentials'
import ProcessOverview from '@/features/landing/components/about/process-overview'
import TeamSection from '@/features/landing/components/about/team'

export const metadata = {
  title: 'About Elite Construction | Three Generations of Master Craftsmanship',
  description:
    'Learn about our company heritage, founder\'s story, and the master craftsmen who have been building architectural masterpieces for over 25 years.',
}

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <AboutHero />
      <CompanyStory />
      <TeamSection />
      <CredentialsSection />
      <ProcessOverview />
      <BottomCTA />
    </main>
  )
}
