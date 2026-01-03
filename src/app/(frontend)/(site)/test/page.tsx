'use client'

import { useQuery } from '@tanstack/react-query'
import { TopSpacer } from '@/shared/components/top-spacer'
import { ViewportHero } from '@/shared/components/viewport-hero'
import { useTRPC } from '@/trpc/helpers'

export default function TestPage() {
  const trpc = useTRPC()
  const test = useQuery(trpc.test.queryOptions())

  return (
    <ViewportHero>
      <TopSpacer>
        <pre>{JSON.stringify(test.data, null, 2)}</pre>
      </TopSpacer>
    </ViewportHero>
  )
}
