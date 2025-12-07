'use client'

import BottomCTA from '@/components/cta'
import { useIsMobile } from '@/hooks/use-mobile'
import ProcessOverview from '../components/about/process-overview'
import ServicesHero from '../components/services/service-hero'
import ServicesList from '../components/services/services-list'
import ServicesListScroll from '../components/services/services-list-scroll'

export function ServicesView() {
  const isMobile = useIsMobile()

  return (
    <div className="h-full w-full">
      <ServicesHero />
      {!isMobile && <ServicesListScroll />}
      {isMobile && <ServicesList />}
      <ProcessOverview />
      <BottomCTA />
    </div>
  )
}
