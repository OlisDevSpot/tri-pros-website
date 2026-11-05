'use client'

import dynamic from 'next/dynamic'

import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'

interface TwoFuturesChartLoaderProps {
  portrait: boolean
}

// recharts loads with the Benefits window, not with the scene; the plot keeps its height while it does.
const TwoFuturesChart = dynamic(() => import('@/features/trade-scenes/ui/components/benefits/two-futures-chart').then(m => m.TwoFuturesChart), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-lg" />,
})

export function TwoFuturesChartLoader({ portrait }: TwoFuturesChartLoaderProps) {
  return (
    <div data-futures-plot className={cn('relative', portrait ? 'h-23' : 'h-35')}>
      <TwoFuturesChart portrait={portrait} />
    </div>
  )
}
