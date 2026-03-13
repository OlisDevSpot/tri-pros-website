'use client'

import type { PipelineStats } from '@/shared/dal/server/dashboard/get-pipeline-stats'

import { Card, CardContent } from '@/shared/components/ui/card'

interface Props {
  metrics: PipelineStats['metrics']
}

export function PipelineMetricsBar({ metrics }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <CardContent className="py-3 text-center">
          <span className="text-2xl font-bold">
            {(metrics.conversionRate * 100).toFixed(1)}
            %
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">Conversion Rate</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 text-center">
          <span className="text-2xl font-bold">
            $
            {metrics.activePipelineValue.toLocaleString()}
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">Active Pipeline</p>
        </CardContent>
      </Card>
    </div>
  )
}
