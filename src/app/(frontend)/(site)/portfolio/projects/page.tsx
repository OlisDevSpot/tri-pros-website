import type { Metadata } from 'next'
import { ShowroomGridView } from '@/features/showroom/ui/views/showroom-grid-view'
import { BottomCTA } from '@/shared/components/cta'

export const metadata: Metadata = {
  title: 'Portfolio',
  description:
    'Explore our portfolio of successful projects, showcasing our expertise and dedication to delivering exceptional results for discerning homeowners and businesses.',
}

function PortfolioPage() {
  return (
    <main>
      <ShowroomGridView />
      <BottomCTA />
    </main>
  )
}
export default PortfolioPage
