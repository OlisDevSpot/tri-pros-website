'use client'

import { LayersIcon, MapIcon, NavigationIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export type HeroView = 'street' | 'aerial' | 'map'

// Order here drives render order in the toggle.
const VIEW_CONFIG: Array<{ key: HeroView, label: string, icon: typeof MapIcon }> = [
  { key: 'street', label: 'Street', icon: NavigationIcon },
  { key: 'aerial', label: 'Aerial', icon: LayersIcon },
  { key: 'map', label: 'Map', icon: MapIcon },
]

interface Props {
  value: HeroView
  onChange: (view: HeroView) => void
  disabled?: boolean
}

export function HeroViewToggle({ value, onChange, disabled }: Props) {
  return (
    <div
      aria-disabled={disabled}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-black/40 p-0.5 backdrop-blur-md',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {VIEW_CONFIG.map(({ key, label, icon: Icon }) => {
        const isActive = value === key
        return (
          <button
            aria-label={`${label} view`}
            aria-pressed={isActive}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all',
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-white/85 hover:bg-white/10 hover:text-white',
            )}
            key={key}
            onClick={() => onChange(key)}
            type="button"
          >
            <Icon className="size-3.5" />
            <span className="hidden md:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
