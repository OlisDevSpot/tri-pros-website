'use client'

import { useState } from 'react'
import { MEETING_PROGRAMS } from '@/features/meetings/constants/programs'
import { ProgramCard } from '@/features/meetings/ui/components/program-card'
import { Button } from '@/shared/components/ui/button'

interface ProgramQuickPickProps {
  onSelect: (id: string) => void
}

export function ProgramQuickPick({ onSelect }: ProgramQuickPickProps) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Button size="sm" onClick={() => setOpen(true)}>
          Select Program →
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Choose Program
            </p>
            <h2 className="mt-1 text-xl font-bold">Select the right program for this customer</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            ✕
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {MEETING_PROGRAMS.map(program => (
            <ProgramCard
              key={program.accessor}
              program={program}
              onSelect={() => {
                onSelect(program.accessor)
                setOpen(false)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
