import BottomCTA from '@/components/BottomCTA'
import AboutHero from '@/features/landing/components/about/AboutHero'
import CompanyStory from '@/features/landing/components/about/CompanyStory'
import CredentialsSection from '@/features/landing/components/about/CredentialsSection'
import ProcessOverview from '@/features/landing/components/about/ProcessOverview'
import TeamSection from '@/features/landing/components/about/TeamSection'

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
