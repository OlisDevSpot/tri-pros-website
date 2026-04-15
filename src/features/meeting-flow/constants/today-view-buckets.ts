export interface TimeBucket {
  id: string
  label: string
  shortLabel: string
  startHour: number
  endHour: number
}

export const TODAY_VIEW_BUCKETS: TimeBucket[] = [
  { id: 'morning', label: '8 – 11 AM', shortLabel: '8-11A', startHour: 8, endHour: 11 },
  { id: 'midday', label: '11 AM – 2 PM', shortLabel: '11-2P', startHour: 11, endHour: 14 },
  { id: 'afternoon', label: '2 – 5 PM', shortLabel: '2-5P', startHour: 14, endHour: 17 },
  { id: 'evening', label: '5 – 8 PM', shortLabel: '5-8P', startHour: 17, endHour: 20 },
] as const
