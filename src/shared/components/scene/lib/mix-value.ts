import type { EasedValue } from '@/shared/components/scene/lib/damp-value'

export function mixValue<T extends EasedValue>(from: T, to: T, progress: number): T {
  if (typeof from === 'number') {
    return (from + ((to as number) - from) * progress) as T
  }
  const targets = to as readonly number[]
  return from.map((value, index) => value + (targets[index] - value) * progress) as unknown as T
}
