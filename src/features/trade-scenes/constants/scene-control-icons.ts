import type { LucideIcon } from 'lucide-react'
import type { ControlsSection, FactsTab, HomeSystemId, HomeView, SystemActionId } from '@/features/trade-scenes/types'
import type { Weather } from '@/shared/modules/construction/core/types'

import { CalendarIcon, CloudRainIcon, CloudSunIcon, FenceIcon, FlameIcon, HouseIcon, LandPlotIcon, LayersIcon, LocateIcon, MapPinIcon, MoonIcon, PanelTopIcon, PanelTopOpenIcon, ScanSearchIcon, SlidersHorizontalIcon, SparkleIcon, SparklesIcon, SquareDashedIcon, SquareIcon, SunIcon, ThermometerIcon, TreesIcon, UsersIcon } from 'lucide-react'

export const HOME_VIEW_ICONS = { 'complete': PanelTopIcon, 'partly-open': PanelTopOpenIcon } as const satisfies Record<HomeView, LucideIcon>

export const THERMAL_ICON = FlameIcon

export const CONTROLS_SECTION_ICONS = { facts: HouseIcon, systems: LayersIcon, modify: SlidersHorizontalIcon, benefits: SparklesIcon } as const satisfies Record<ControlsSection, LucideIcon>

export const FACTS_TAB_ICONS = { main: HouseIcon, household: UsersIcon, area: MapPinIcon, lot: LandPlotIcon } as const satisfies Record<FactsTab, LucideIcon>

export const HOME_SYSTEM_ICONS = { 'roof': HouseIcon, 'attic': LayersIcon, 'windows': SquareIcon, 'walls': SparkleIcon, 'heating-cooling': ThermometerIcon, 'foundation': LayersIcon } as const satisfies Record<HomeSystemId, LucideIcon>

export const YEAR_BUILT_ICON = CalendarIcon

export const YARD_ICON = TreesIcon

export const SYSTEM_ACTION_ICONS = { 'focus': LocateIcon, 'look-inside': ScanSearchIcon, 'draw-region': SquareDashedIcon, 'draw-fence': FenceIcon } as const satisfies Record<SystemActionId, LucideIcon>

export const WEATHER_SUMMARY_ICONS = { normal: CloudSunIcon, summer: SunIcon, winter: MoonIcon, rain: CloudRainIcon } as const satisfies Record<Weather, LucideIcon>
