'use client'

import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { useQueryState } from 'nuqs'

import { dashboardSidebarItems } from '@/features/agent-dashboard/constants/sidebar-items'
import { dashboardStepParser } from '@/features/agent-dashboard/lib/url-parsers'
import { Logo } from '@/shared/components/logo'
import { Button } from '@/shared/components/ui/button'

export function DashboardSidebar() {
  const [step, setStep] = useQueryState('step', dashboardStepParser)

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
      {dashboardSidebarItems.map(item => (
        <Button
          key={item.step}
          data-active={step === item.step}
          size="icon"
          variant={step === item.step ? 'default' : 'outline'}
          className="data-[active=true]:bg-primary/80 lg:data-[active=true]:h-20"
          disabled={!item.enabled}
          onClick={() => setStep(item.step)}
        >
          <item.icon size={20} />
        </Button>
      ))}
    </div>
  )
}
