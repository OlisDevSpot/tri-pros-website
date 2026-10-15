'use client'

import type { ReactNode } from 'react'

import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'

import { Logo } from '@/shared/components/logo'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/domains/permissions/client'

export function ProposalTopBarFrame({ children }: { children?: ReactNode }) {
  const ability = useAbility()
  const backHref = ability.can('access', 'Dashboard') ? ROOTS.dashboard.proposals.root() : '/'

  return (
    <header className="surface flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <Link href={backHref} className="flex h-11 shrink-0 items-center gap-2" aria-label="Back">
        <ArrowLeftIcon className="size-5" />
        <Logo variant="icon" className="size-8" />
      </Link>
      {children}
    </header>
  )
}
