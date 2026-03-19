import type { LucideIcon } from 'lucide-react'

export interface StatBarItemConfig<T> {
  key: string
  label: string
  icon: LucideIcon
  color?: string
  getValue: (data: T[]) => number
  renderValue?: (value: number) => string
}

export interface StatBarProps<T> {
  items: StatBarItemConfig<T>[]
  data: T[]
  className?: string
}
