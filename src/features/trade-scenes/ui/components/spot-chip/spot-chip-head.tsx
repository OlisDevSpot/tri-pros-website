'use client'

import type { HomeSystemId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { PanelRightOpenIcon, PencilIcon, XIcon } from 'lucide-react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { HOME_SYSTEM_LABELS, QUICK_EDIT_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneTapClaim } from '@/features/trade-scenes/hooks/use-scene-tap-claim'
import { useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'

interface SpotChipHeadProps {
  system: HomeSystemId
  editing: boolean
}

// The name picks the system as its rail chip does and claims its tap, as every press on the chip surface does. The pencil turns the chip into quick edit and the cross turns it back.
export function SpotChipHead({ system, editing }: SpotChipHeadProps) {
  const { pickFromChip } = useSceneControls()
  const { claimTap } = useSceneTapClaim()
  const store = useSceneInputsApi<TradeSceneInputs>()
  const label = HOME_SYSTEM_LABELS[system]
  const open = () => {
    claimTap()
    pickFromChip(system)
  }
  const setEditing = (next: HomeSystemId | null) => {
    const { tappedSpot } = store.getState()
    if (tappedSpot) {
      store.setState({ tappedSpot: { ...tappedSpot, editing: next } })
    }
  }
  return (
    <div className={CONTROLS_CLASSES.spotChipHead}>
      <button
        type="button"
        data-spot-chip={system}
        aria-label={QUICK_EDIT_COPY.openCard(label)}
        onClick={open}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full pr-2.5 pl-3.5 text-base font-bold whitespace-nowrap text-foreground outline-none hover:bg-hover pressed:bg-press focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {label}
        <PanelRightOpenIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
      <button
        type="button"
        data-spot-edit={system}
        aria-label={editing ? QUICK_EDIT_COPY.done : QUICK_EDIT_COPY.edit(label)}
        onClick={() => setEditing(editing ? null : system)}
        className="ml-auto inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-hover hover:text-foreground pressed:bg-press focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {editing ? <XIcon aria-hidden className="size-4" /> : <PencilIcon aria-hidden className="size-4" />}
      </button>
    </div>
  )
}
