import BottomCTA from '@/components/cta'
import { PortfolioHero } from '@/features/landing/components/portfolio/portfolio-hero'

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
