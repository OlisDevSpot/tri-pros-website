import { UNKNOWN_CHOICE } from '@/features/trade-scenes/constants/scene-controls'

type UnknownChoice = typeof UNKNOWN_CHOICE

export interface ProfileChoices<T extends string> {
  options: readonly (T | UnknownChoice)[]
  labels: Record<T | UnknownChoice, string>
}

export function withUnknown<T extends string>(options: readonly T[], labels: Record<T, string>, unknownLabel: string): ProfileChoices<T> {
  return { options: [...options, UNKNOWN_CHOICE], labels: { ...labels, [UNKNOWN_CHOICE]: unknownLabel } as Record<T | UnknownChoice, string> }
}

export function toChoice<T extends string>(value: T | null): T | UnknownChoice {
  return value ?? UNKNOWN_CHOICE
}

export function fromChoice<T extends string>(choice: T | UnknownChoice): T | null {
  return choice === UNKNOWN_CHOICE ? null : choice as Exclude<T | UnknownChoice, UnknownChoice>
}
