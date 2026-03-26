'use client'

import { BrainIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

interface PersonaProfileTriggerProps {
  onClick: () => void
  hasData: boolean
}

export function PersonaProfileTrigger({ hasData, onClick }: PersonaProfileTriggerProps) {
  return (
    <div className="fixed bottom-[calc(var(--prevNextHeight,3.5rem)+1rem)] right-4 z-40 md:bottom-6">
      <Button
        aria-label="Open persona profile"
        className="relative h-10 gap-2 rounded-full pl-3 pr-4 shadow-lg"
        size="sm"
        variant={hasData ? 'default' : 'secondary'}
        onClick={onClick}
      >
        <BrainIcon className="size-4 shrink-0" />
        <span className="text-xs font-medium">Persona</span>
      </Button>
    </div>
  )
}
