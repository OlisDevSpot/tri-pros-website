'use client'

import { AREA_GROUP_LABELS, AREA_GROUP_NAMES, CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { AREA_GROUP_IDS } from '@/features/trade-scenes/constants/yards'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'

// Exterior, Interior, Lot ahead of the group's chips. Interior shows, dimmed, until something inside can be picked. The
// wrapper holds the pill to its own height in the rail's row.
export function AreaGroupSwitch() {
  const { group, setGroup } = useSceneControls()
  return (
    <div data-area-groups className="flex shrink-0 items-center">
      <ChoicePill
        label={CONTROLS_COPY.systems.title}
        value={group}
        options={AREA_GROUP_IDS}
        labels={AREA_GROUP_LABELS}
        names={AREA_GROUP_NAMES}
        disabled={['interior']}
        onChange={(next) => {
          if (next !== 'interior') {
            setGroup(next)
          }
        }}
      />
    </div>
  )
}
