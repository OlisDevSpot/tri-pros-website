'use client'

import { PanelRightIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

import { useCockpitOpen } from './cockpit-open-context'

export function CockpitButton() {
  const { open, setOpen } = useCockpitOpen()
  return (
    <Button
      variant="outline"
      aria-label="Cockpit"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="proposal-cockpit"
      onClick={() => setOpen(true)}
      className="relative h-8.5 gap-1.5 px-2.5 text-sm pointer-coarse:h-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1 pointer-coarse:after:content-[''] @max-[599px]/proposal:w-9 @max-[599px]/proposal:px-0"
    >
      <PanelRightIcon className="size-4" />
      <span className="@max-[599px]/proposal:hidden">Cockpit</span>
    </Button>
  )
}
