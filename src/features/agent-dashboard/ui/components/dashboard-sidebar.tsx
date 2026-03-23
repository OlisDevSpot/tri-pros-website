'use client'

import { ArrowLeftIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useQueryState } from 'nuqs'

import { dashboardSidebarItems } from '@/features/agent-dashboard/constants/sidebar-items'
import { dashboardStepParser } from '@/features/agent-dashboard/lib/url-parsers'
import { Logo } from '@/shared/components/logo'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'

export function DashboardSidebar() {
  const [step, setStep] = useQueryState('step', dashboardStepParser)

  return (
    <div className="h-full flex justify-between lg:justify-start lg:flex-col gap-2 lg:gap-4 items-center shrink-0">
      <div className="lg:flex lg:flex-col lg:gap-1 lg:w-full">
        <Link href="/" className="shrink-0">
          <div className="group relative w-8 h-8 lg:hidden">
            <Logo variant="icon" className="group-hover:opacity-20 transition" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <ArrowLeftIcon size={20} />
            </div>
          </div>
          <div className="group relative hidden lg:block w-full">
            <Image
              src="/company/logo/logo-light-right.svg"
              alt="Tri Pros Remodeling"
              width={140}
              height={40}
              className="dark:hidden group-hover:opacity-20 transition"
            />
            <Image
              src="/company/logo/logo-dark-right.svg"
              alt="Tri Pros Remodeling"
              width={140}
              height={40}
              className="hidden dark:block group-hover:opacity-20 transition"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <ArrowLeftIcon size={20} />
            </div>
          </div>
        </Link>
        <Separator className="hidden lg:block" />
      </div>
      <div className="flex lg:flex-col gap-2 items-center">
        {dashboardSidebarItems.map((item) => {
          const isActive = step === item.step

          return (
            <Button
              key={item.step}
              data-active={isActive}
              variant={isActive ? 'default' : 'outline'}
              className="h-9 min-w-9 px-2 gap-1.5 data-[active=true]:bg-primary/80 lg:w-full lg:justify-start lg:gap-2 lg:px-3"
              disabled={!item.enabled}
              onClick={() => setStep(item.step)}
            >
              <item.icon size={18} className="shrink-0" />
              <span className="hidden lg:inline text-xs font-medium">{item.label}</span>
              <AnimatePresence>
                {isActive && (
                  <motion.span
                    className="lg:hidden text-xs font-medium whitespace-nowrap overflow-hidden"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
