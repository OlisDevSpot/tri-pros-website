'use client'

import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { generateProposalSteps } from '@/features/proposal-flow/constants/proposal-steps'
import { useSession } from '@/shared/auth/client'
import { Logo } from '@/shared/components/logo'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { ROOTS } from '@/shared/config/roots'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { checkUserRole } from '@/shared/permissions/lib/check-user-role'
import { ProposalNavbarFrame } from './navbar-frame'

export function ProposalPageNavbar() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const pathnameChunks = usePathname().split('/')
  const currentStepIndex = pathnameChunks.findIndex(p => p === 'proposal')
  const sessionQuery = useSession()

  if (currentStepIndex < 0) {
    return null
  }

  const userRole = checkUserRole(sessionQuery.data?.user.email || '')

  return (
    <ProposalNavbarFrame>
      <Link
        className="h-full w-fit lex items-center justify-center transition px-8"
        href={sessionQuery.data?.user ? `${ROOTS.proposalFlow()}` : '/'}
      >
        <div className="flex items-center h-full gap-2">
          <ArrowLeftIcon size={20} />
          <div className="w-10 h-10 shrink-0">
            <Logo variant="icon" />
          </div>
        </div>
      </Link>
      {!isMobile
        ? (
            generateProposalSteps(userRole).map(step => (
              <div
                key={step.accessor}
                className="flex-1 last-of-type:bg-primary h-full"
              >
                <Link
                  className="h-full w-full flex items-center justify-center hover:bg-foreground/40 transition"
                  href={`#${step.accessor}`}
                >
                  {step.title}
                </Link>
              </div>
            ))
          )
        : (
            <div className="h-full w-full flex items-center justify-center px-4">
              <Select
                defaultValue="project-overview"
                onValueChange={(val) => {
                  router.push(`#${val}`)
                }}
              >
                <SelectTrigger className="w-full bg-card dark:bg-card outline-none border-none dark:border-none dark:outline-none">
                  <SelectValue placeholder="Select a project type" />
                </SelectTrigger>
                <SelectContent>
                  {generateProposalSteps(userRole).map(step => (
                    <SelectItem
                      key={step.accessor}
                      value={step.accessor}
                      className="h-14 flex items-center"
                    >
                      {step.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
    </ProposalNavbarFrame>
  )
}
