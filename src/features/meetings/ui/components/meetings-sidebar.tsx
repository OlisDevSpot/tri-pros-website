'use client'

import { ArrowLeftIcon, HistoryIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { meetingsDashboardStepParser } from '@/features/meetings/lib/url-parsers'
import { Logo } from '@/shared/components/logo'
import { Button } from '@/shared/components/ui/button'

export function MeetingsSidebar() {
  const [step, setStep] = useQueryState('step', meetingsDashboardStepParser)

  return (
    <div className="h-full flex lg:flex-col gap-3 items-center shrink-0">
      <Link href="/">
        <div className="group relative w-8 h-8 shrink-0">
          <Logo variant="icon" className="group-hover:opacity-20 transition" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <ArrowLeftIcon size={20} />
          </div>
        </div>
      </Link>
      <Button
        data-active={step === 'create-meeting'}
        size="icon"
        variant={step === 'create-meeting' ? 'default' : 'outline'}
        className="data-[active=true]:bg-primary/80 lg:data-[active=true]:h-20"
        onClick={() => setStep('create-meeting')}
      >
        <PlusIcon size={20} />
      </Button>
      <Button
        data-active={step === 'past-meetings'}
        size="icon"
        variant={step === 'past-meetings' ? 'default' : 'outline'}
        className="data-[active=true]:bg-primary/80 lg:data-[active=true]:h-20"
        onClick={() => setStep('past-meetings')}
      >
        <HistoryIcon size={20} />
      </Button>
    </div>
  )
}
