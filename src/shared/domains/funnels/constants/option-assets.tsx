import type { ReactElement } from 'react'
import {
  GalleyDiagram,
  IslandDiagram,
  LShapeDiagram,
  NotSureDiagram,
  OpenDiagram,
  UShapeDiagram,
} from '@/shared/domains/funnels/constants/floor-plan-diagrams'

/**
 * Named diagrams referenceable from a funnel option `asset: { kind:'icon', name }`.
 * Keep names stable — funnel configs reference them by string. Each value is a
 * component taking `{ className }`, matching how card-select-step renders them.
 */
export const OPTION_ICONS: Record<string, (props: { className?: string }) => ReactElement> = {
  'galley': GalleyDiagram,
  'island': IslandDiagram,
  'l-shape': LShapeDiagram,
  'not-sure': NotSureDiagram,
  'open': OpenDiagram,
  'u-shape': UShapeDiagram,
}
