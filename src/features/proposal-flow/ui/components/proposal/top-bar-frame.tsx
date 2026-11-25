'use client'

import type { ReactNode } from 'react'

import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'

import { Logo } from '@/shared/components/logo'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/domains/permissions/client'

interface Props {
  children?: ReactNode
  tabs?: ReactNode
}

// The tabs are the bar's second row, outside the page's scroller, so no scrolled content can show above them.
export function ProposalTopBarFrame({ children, tabs }: Props) {
  const ability = useAbility()
  // A homeowner goes back to the public site's home; ROOTS has no landing root entry.
  const backHref = ability.can('access', 'Dashboard') ? ROOTS.dashboard.proposals.root() : '/'

  return (
    <header className="surface relative z-10 shrink-0 border-b border-border">
      <div className="flex h-14 items-center gap-2.5 pr-3 pl-1.5">
        <Link href={backHref} className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-hover pressed:bg-press" aria-label="Back">
          <ArrowLeftIcon className="size-5" />
        </Link>
        <Logo variant="icon" className="size-7.5 shrink-0" />
        {children}
      </div>
      {tabs && <div className="border-t border-border @min-[1100px]/proposal:hidden">{tabs}</div>}
    </header>
  )
}
