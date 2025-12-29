'use client'

import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Logo } from '@/shared/components/logo'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { proposalSteps } from '@/features/proposals/constants/proposal-steps'
import { useIsMobile } from '@/shared/hooks/use-mobile'

export function ProposalPageNavbar() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const pathnameChunks = usePathname().split('/')
  const currentStepIndex = pathnameChunks.findIndex(p => p === 'proposal')

  if (pathnameChunks[currentStepIndex] !== 'proposal') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-14 bg-foreground/20 shrink-0"
      >
        <div className="h-full w-full flex justify-between overflow-hidden">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex justify-center items-center w-fit bg-foreground/40 hover:bg-foreground/40"
          >
            <Link
              className="h-full w-full flex items-center justify-center transition px-8"
              href="/"
            >
              <div className="flex items-center gap-2">
                <ArrowLeftIcon size={20} />
                <div className="w-10 h-10 shrink-0">
                  <Logo variant="icon" />
                </div>
              </div>
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex justify-center items-center w-fit bg-foreground/40 hover:bg-foreground/40"
          >
            <Link
              className="h-full w-full flex items-center justify-center transition"
              href="/proposal-flow/proposal"
            >
              <div className="flex items-center gap-2 h-full w-full px-8 ">
                PROPOSAL
                <ArrowRightIcon size={20} />
              </div>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-14 bg-foreground/20 shrink-0"
    >
      <div className="h-full w-full flex justify-between overflow-hidden">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex justify-center items-center w-fit bg-foreground/40 hover:bg-foreground/40"
        >
          <Link
            className="h-full w-full flex items-center justify-center transition px-8"
            href="/proposal-flow/form"
          >
            <div className="flex items-center gap-2">
              <ArrowLeftIcon size={20} />
              <div className="w-10 h-10 shrink-0">
                <Logo variant="icon" />
              </div>
            </div>
          </Link>
        </motion.div>
        {!isMobile
          ? (
              proposalSteps.map(step => (
                <div
                  key={step.accessor}
                  className="flex-1 last-of-type:bg-primary"
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
                    {proposalSteps.map(step => (
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
      </div>
    </motion.div>
  )
}
