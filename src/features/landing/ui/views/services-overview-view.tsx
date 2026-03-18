import { BottomCTA } from '@/shared/components/cta'

import { ProcessOverview } from '../components/about/process-overview'
import { ComparisonTable } from '../components/services/comparison-table'
import { PillarCard } from '../components/services/pillar-card'
import { PillarCardSecondary } from '../components/services/pillar-card-secondary'
import { ProgramsTeaser } from '../components/services/programs-teaser'
import { ServicesOverviewHero } from '../components/services/services-hero'
import { SwceSection } from '../components/services/swce-section'

export function ServicesOverviewView() {
  return (
    <div className="h-full w-full">
      <ServicesOverviewHero />

      {/* Primary Pillar Cards */}
      <section className="container py-16 lg:py-24">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PillarCard
            title="Energy-Efficient Construction"
            description="Stop paying your utility company for your home's inefficiency. Compounding savings from insulation, HVAC, windows, solar, and roofing upgrades."
            tradePreview={['HVAC', 'Solar', 'Windows', 'Insulation']}
            href="/services/energy-efficient-construction"
            pillarType="energy"
          />
          <PillarCard
            title="Luxury Renovations"
            description="The home you've always wanted — built by people who'll still be here when you need us. Kitchens, bathrooms, flooring, additions, and more."
            tradePreview={['Kitchen', 'Bathroom', 'Flooring', 'ADU']}
            href="/services/luxury-renovations"
            pillarType="luxury"
          />
        </div>
      </section>

      {/* Secondary Pillar Cards */}
      <section className="container pb-16 lg:pb-24">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
          <PillarCardSecondary
            title="Commercial Construction"
            description="Office, retail, and medical facilities built to spec."
            href="/contact"
          />
          <PillarCardSecondary
            title="Design-Build Services"
            description="Streamlined design and construction under one roof."
            href="/contact"
          />
        </div>
      </section>

      <SwceSection variant="full" />
      <ComparisonTable />
      <ProgramsTeaser pillarType="energy" />
      <ProcessOverview />
      <BottomCTA />
    </div>
  )
}
