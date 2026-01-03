'use client'

import { HistoryIcon, PlusIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

export function ProposalSidebar() {
  return (
    <div className="h-full flex flex-col gap-3">
      <Button size="icon" variant="ghost">
        <PlusIcon size={20} />
      </Button>
      <Button size="icon" variant="ghost">
        <HistoryIcon size={20} />
      </Button>
    </div>
  )
}
