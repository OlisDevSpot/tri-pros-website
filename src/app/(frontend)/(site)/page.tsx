import BottomCTA from '@/components/cta'
import HomeHero from '@/features/landing/components/home/home-hero'
import PastProjects from '@/features/landing/components/home/past-projects'
import ServicesPreview from '@/features/landing/components/home/services-preview'
import TestimonialsSection from '@/features/landing/components/home/testimonials'
import ValuePropositions from '@/features/landing/components/home/value-proposition'

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
