export interface CalendarEvent {
  id: string
  startAt: string
  endAt?: string
  title: string
}

export type CalendarViewType = 'today' | 'week' | 'month'
