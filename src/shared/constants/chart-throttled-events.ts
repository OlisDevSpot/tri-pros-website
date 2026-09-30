// Recharts throttles touchmove through one scheduler shared by every chart on the page; excluding it here
// lets usePinnedChartTooltip's forced re-select land without another chart's pending call cancelling it.
export const CHART_THROTTLED_EVENTS = ['mousemove', 'pointermove', 'scroll', 'wheel'] as const
