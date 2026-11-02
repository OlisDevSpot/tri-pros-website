import { SCENE_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { SCENE_STAGE_CLASS } from '@/features/trade-scenes/constants/scene-stage'
import { BlueprintPaper } from '@/features/trade-scenes/ui/components/blueprint/blueprint-paper'

export function TradeScenePendingView() {
  return (
    <div data-stage data-load-phase="paper" aria-busy="true" className={SCENE_STAGE_CLASS}>
      <BlueprintPaper />
      <p role="status" className="sr-only">{SCENE_COPY.loading}</p>
    </div>
  )
}
