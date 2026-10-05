export const calendarViewTypes = ['today', 'week', 'month'] as const
export type CalendarViewType = (typeof calendarViewTypes)[number]
