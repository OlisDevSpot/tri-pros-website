'use client'

import { CalendarIcon, FileTextIcon, PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { ROOTS } from '@/shared/config/roots'

export function CreatePicker() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="outline"
        >
          <PlusIcon size={20} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-48 p-2">
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            className="justify-start gap-2"
            onClick={() => {
              setOpen(false)
              router.push(`${ROOTS.dashboard()}?step=create-meeting`)
            }}
          >
            <CalendarIcon size={16} />
            New Meeting
          </Button>
          <Button
            variant="ghost"
            className="justify-start gap-2"
            onClick={() => {
              setOpen(false)
              router.push(`${ROOTS.dashboard()}?step=create-proposal`)
            }}
          >
            <FileTextIcon size={16} />
            New Proposal
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
