import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PortfolioGridView } from '@/features/project-management/ui/views/portfolio-grid-view'
import { BottomCTA } from '@/shared/components/cta'

export const metadata: Metadata = {
  title: 'Portfolio',
  description:
    'Explore our portfolio of successful projects, showcasing our expertise and dedication to delivering exceptional results for discerning homeowners and businesses.',
}

function PortfolioPage() {
  return (
    <main>
      <Suspense>
        <PortfolioGridView />
      </Suspense>
      <BottomCTA />
    </main>
  )
}
export default PortfolioPage
