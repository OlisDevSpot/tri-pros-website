import type { LucideIcon } from 'lucide-react'
import type { ControlsSection, FactsTab, HomeSystemId, HomeView } from '@/features/trade-scenes/types'

import { CalendarIcon, FlameIcon, HouseIcon, LandPlotIcon, LayersIcon, MapPinIcon, PanelTopIcon, PanelTopOpenIcon, SlidersHorizontalIcon, SparkleIcon, SparklesIcon, SquareIcon, ThermometerIcon, UsersIcon } from 'lucide-react'

export const HOME_VIEW_ICONS = { 'complete': PanelTopIcon, 'partly-open': PanelTopOpenIcon } as const satisfies Record<HomeView, LucideIcon>

export const THERMAL_ICON = FlameIcon

export const CONTROLS_SECTION_ICONS = { facts: HouseIcon, systems: LayersIcon, modify: SlidersHorizontalIcon, benefits: SparklesIcon } as const satisfies Record<ControlsSection, LucideIcon>

export const FACTS_TAB_ICONS = { main: HouseIcon, household: UsersIcon, area: MapPinIcon, lot: LandPlotIcon } as const satisfies Record<FactsTab, LucideIcon>

export const HOME_SYSTEM_ICONS = { 'roof': HouseIcon, 'attic': LayersIcon, 'windows': SquareIcon, 'walls': SparkleIcon, 'heating-cooling': ThermometerIcon, 'foundation': LayersIcon } as const satisfies Record<HomeSystemId, LucideIcon>

export const YEAR_BUILT_ICON = CalendarIcon
