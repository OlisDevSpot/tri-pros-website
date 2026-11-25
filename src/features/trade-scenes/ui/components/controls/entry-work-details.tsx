'use client'

import type { WorkDetailsKind } from '@/features/trade-scenes/lib/work-details-kind'
import type { SceneChangeSlot } from '@/features/trade-scenes/types'

import { WorkDetails } from '@/features/trade-scenes/ui/components/controls/work-details'

interface EntryWorkDetailsProps {
  kind: WorkDetailsKind
  slots: readonly SceneChangeSlot[]
}

// A picked piece of work's details, with the efficiency switch its work takes found among the slots: the same on the system
// card and in a spot chip's quick edit.
export function EntryWorkDetails({ kind, slots }: EntryWorkDetailsProps) {
  const upgradeId = kind === 'paint' ? 'upgrade:cool-paint' : 'upgrade:cool-roof'
  return <WorkDetails kind={kind} upgrade={kind === 'vinyl-frame' || kind === 'gutter' ? null : slots.find(slot => slot.id === upgradeId) ?? null} />
}
