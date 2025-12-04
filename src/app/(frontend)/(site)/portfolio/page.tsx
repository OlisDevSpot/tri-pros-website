import BottomCTA from '@/components/BottomCTA'
import { PortfolioHero } from '@/features/landing/components/portfolio/PortfolioHero'

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
