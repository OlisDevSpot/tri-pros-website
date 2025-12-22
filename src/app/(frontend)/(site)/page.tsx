import type { Metadata } from 'next'
import BottomCTA from '@/components/cta'
import HomeHero from '@/features/landing/ui/components/home/home-hero'
import PastProjects from '@/features/landing/ui/components/home/past-projects'
import ServicesPreview from '@/features/landing/ui/components/home/services-preview'
import TestimonialsSection from '@/features/landing/ui/components/home/testimonials'
import ValuePropositions from '@/features/landing/ui/components/home/value-proposition'

export const metadata: Metadata = {
  title: 'Home',
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background shadow-xl">
      <HomeHero />
      <ValuePropositions />
      <ServicesPreview />
      <PastProjects />
      <TestimonialsSection />
      <BottomCTA />
    </main>
  )
}
