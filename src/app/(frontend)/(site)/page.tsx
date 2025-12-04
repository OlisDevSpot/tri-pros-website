import BottomCTA from '@/components/BottomCTA'
import HomeHero from '@/features/landing/components/home/HomeHero'
import PastProjects from '@/features/landing/components/home/PastProjects'
import ServicesPreview from '@/features/landing/components/home/ServicesPreview'
import TestimonialsSection from '@/features/landing/components/home/TestimonialsSection'
import ValuePropositions from '@/features/landing/components/home/ValuePropositions'

export default function Home() {
  return (
    <main className="min-h-screen">
      <HomeHero />
      <ValuePropositions />
      <ServicesPreview />
      <PastProjects />
      <TestimonialsSection />
      <BottomCTA />
    </main>
  )
}
