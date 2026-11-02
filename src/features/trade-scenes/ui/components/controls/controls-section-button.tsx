'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ControlsSection } from '@/features/trade-scenes/types'

import { useReducedMotion } from 'motion/react'
import { Toolbar } from 'radix-ui'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_EASE_CSS } from '@/features/trade-scenes/constants/scene-layout'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { cn } from '@/shared/lib/utils'

interface ControlsSectionButtonProps {
  section: ControlsSection
  icon: LucideIcon
  // The window the open section shows in.
  windowId: string
  // The accessible name, where it says more than the section's name (a missing count).
  label?: string
  // The scene key that opens it, where it has one.
  keyShortcut?: string
  // Marks pinned over the icon.
  children?: ReactNode
}

// Only the open section shows its name. The name opens on a 0fr to 1fr column, so the group widens on the same curve
// with nothing measured and no size held in state, driven by the button's own aria-expanded. Its fade waits for the column
// to open, and goes at once on the shut.
export function ControlsSectionButton({ section, icon: Icon, windowId, label, keyShortcut, children }: ControlsSectionButtonProps) {
  const { open, openSection } = useSceneControls()
  const { shape } = useSceneVisibleArea()
  const reduceMotion = useReducedMotion()
  const expanded = open === section
  const portrait = shape === 'portrait'
  const name = CONTROLS_COPY.sections[section]

  return (
    <Toolbar.Button
      data-section-button={section}
      aria-expanded={expanded}
      aria-controls={windowId}
      aria-label={label ?? name}
      aria-keyshortcuts={keyShortcut}
      onClick={() => openSection(section)}
      style={{ transition: reduceMotion ? 'none' : `background-color 200ms ${CONTROLS_EASE_CSS}, color 200ms ${CONTROLS_EASE_CSS}` }}
      className={cn(
        CONTROLS_CLASSES.barItem.base,
        'group text-sm font-bold whitespace-nowrap not-aria-expanded:hover:bg-hover not-aria-expanded:hover:text-foreground not-aria-expanded:pressed:bg-press',
        portrait ? CONTROLS_CLASSES.barItem.portrait : CONTROLS_CLASSES.barItem.wide,
        section === 'modify'
          ? 'aria-expanded:bg-primary aria-expanded:text-primary-foreground'
          : 'aria-expanded:bg-muted aria-expanded:text-foreground aria-expanded:inset-ring aria-expanded:inset-ring-border-strong',
      )}
    >
      <Icon aria-hidden />
      <span
        data-section-name
        style={reduceMotion
          ? { transition: 'none' }
          : { transitionProperty: 'grid-template-columns, opacity, margin-left', transitionDuration: '300ms, 180ms, 300ms', transitionTimingFunction: CONTROLS_EASE_CSS }}
        className={cn(
          'inline-grid grid-cols-[0fr] opacity-0 group-aria-expanded:grid-cols-[1fr] group-aria-expanded:opacity-100 group-aria-expanded:[transition-delay:0ms,80ms,0ms]',
          portrait ? 'group-aria-expanded:ml-1.5' : 'group-aria-expanded:ml-2',
        )}
      >
        <span className="min-w-0 overflow-hidden">{name}</span>
      </span>
      {children}
    </Toolbar.Button>
  )
}
