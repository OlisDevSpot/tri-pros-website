'use client'

import { DOCK_SIZES } from '@/features/trade-scenes/constants/scene-dock'
import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { dockHeightFor, dockLayoutFor } from '@/features/trade-scenes/lib/dock-layout-for'
import { DockHomeView } from '@/features/trade-scenes/ui/components/dock/dock-home-view'
import { DockThermal } from '@/features/trade-scenes/ui/components/dock/dock-thermal'
import { DockWeather } from '@/features/trade-scenes/ui/components/dock/dock-weather'

const { dock } = SCENE_LAYOUT

// Only what changes the scene; the shortcut keys have their own button in the stage's corner.
export function SceneDock() {
  const { shape, stage, zoomed } = useSceneVisibleArea()
  const fold = dockLayoutFor({ shape, stage, zoomed })
  // A folded strip is a short column that reads as one without its dividers.
  const divider = fold === 'none' && <span aria-hidden style={DOCK_SIZES.divider} className="w-13 bg-border" />

  return (
    <div
      data-dock-strip
      data-fold={fold}
      // Centred in the region `dockRegionFor` gives it. Safari grows an out-of-flow grid sized `h-fit` a step on every
      // relayout, so the strip takes its known height.
      style={{ top: 0, bottom: 0, height: dockHeightFor(fold), right: dock.gap, width: dock.width, padding: dock.padding, borderWidth: dock.border, gap: dock.spacing }}
      className="absolute my-auto grid content-start justify-items-center rounded-[14px] border bg-card shadow-lg"
    >
      <DockHomeView />
      <DockThermal />
      {divider}
      <DockWeather folded={fold !== 'none'} />
    </div>
  )
}
