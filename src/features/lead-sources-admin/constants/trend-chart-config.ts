import type { ChartConfig } from '@/shared/components/ui/chart'

export const LEAD_SOURCE_TREND_CHART_CONFIG = {
  leads: { label: 'Leads', color: 'var(--foreground)' },
  meetings: { label: 'Meetings', color: 'var(--muted-foreground)' },
  signed: { label: 'Signatures', color: 'var(--chart-1)' },
} satisfies ChartConfig
