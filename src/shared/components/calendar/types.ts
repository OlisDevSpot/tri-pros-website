export interface CalendarEvent {
  id: string
  startAt: string
  endAt?: string
  title: string
}

export type CalendarViewType = 'today' | 'week' | 'month'

export interface CalendarConfig {
  defaultView?: CalendarViewType
  hiddenDays?: number[]
  weekStartsOn?: 0 | 1
}

export interface CalendarBoardProps<T extends CalendarEvent> {
  events: T[]
  config?: CalendarConfig
  renderCard: (event: T) => React.ReactNode
  renderCompact: (event: T) => React.ReactNode
  onEventClick?: (event: T) => void
  renderTodayView?: (events: T[], currentDate: Date) => React.ReactNode
  onDateRangeChange?: (range: { from: Date, to: Date }) => void
  activeView?: CalendarViewType
  onViewChange?: (view: CalendarViewType) => void
  showSaturday?: boolean
  onToggleSaturday?: () => void
  className?: string
}
