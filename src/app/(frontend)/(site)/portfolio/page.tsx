import type { Metadata } from 'next'
import BottomCTA from '@/shared/components/cta'
import { PortfolioHero } from '@/features/landing/ui/components/portfolio/portfolio-hero'

export const metadata: Metadata = {
  title: 'Portfolio',
  description:
    'Explore our portfolio of successful projects, showcasing our expertise and dedication to delivering exceptional results for discerning homeowners and businesses.',
}

function PortfolioPage() {
  return (
    <main>
      <PortfolioHero />
      <div className="h-screen bg-red-100"></div>
      <BottomCTA />
    </main>
  )
}
export default PortfolioPage
