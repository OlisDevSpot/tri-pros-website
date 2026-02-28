import type { Metadata } from 'next'
import { PortfolioHero } from '@/features/landing/ui/components/portfolio/portfolio-hero'
import { ProjectsGrid } from '@/features/landing/ui/components/portfolio/projects-grid'
import BottomCTA from '@/shared/components/cta'

export const metadata: Metadata = {
  title: 'Portfolio',
  description:
    'Explore our portfolio of successful projects, showcasing our expertise and dedication to delivering exceptional results for discerning homeowners and businesses.',
}

function PortfolioPage() {
  return (
    <main>
      <PortfolioHero />
      <ProjectsGrid />
      <BottomCTA />
    </main>
  )
}
export default PortfolioPage
