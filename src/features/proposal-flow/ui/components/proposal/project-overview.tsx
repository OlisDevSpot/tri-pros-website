'use client'

import { Hero } from './hero'
import { OverviewFacts } from './overview-facts'
import { OverviewParts } from './overview-parts'

export function ProjectOverview() {
  return (
    <>
      <Hero />
      <div className="mx-auto grid max-w-230 grid-cols-[minmax(0,1fr)] gap-7 px-4.5 pt-7 pb-13 @min-[700px]/proposal:px-10 @min-[700px]/proposal:pt-10 @min-[700px]/proposal:pb-18">
        <OverviewFacts />
        <OverviewParts />
      </div>
    </>
  )
}
