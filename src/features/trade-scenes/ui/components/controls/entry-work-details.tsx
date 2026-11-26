'use client'

import type { WorkDetailsKind } from '@/features/trade-scenes/lib/work-details-kind'
import type { SceneChangeSlot } from '@/features/trade-scenes/types'

import { DETAILS_SWITCH } from '@/features/trade-scenes/constants/work-details-switches'
import { WorkDetails } from '@/features/trade-scenes/ui/components/controls/work-details'

interface EntryWorkDetailsProps {
  kind: WorkDetailsKind
  slots: readonly SceneChangeSlot[]
}

// A picked piece of work's details, with the switch its work takes found among the slots: the same on the system card and in
// a spot chip's quick edit.
export function EntryWorkDetails({ kind, slots }: EntryWorkDetailsProps) {
  const id = DETAILS_SWITCH[kind]
  return <WorkDetails kind={kind} upgrade={id === null ? null : slots.find(slot => slot.id === id) ?? null} />
}
