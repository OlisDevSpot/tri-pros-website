'use client'

import type { DynamicNavSections, NavItemsGroup } from '@/shared/types/nav'

import { AnimatePresence, motion } from 'motion/react'
import { Fragment } from 'react'
import { useSession } from '@/shared/auth/client'
import { isInternalUser } from '@/shared/auth/lib/is-internal-user'
import { useMatchMedia } from '@/shared/hooks/use-match-media'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'
import { LinkHubspotButton } from '../buttons/auth/link-hubspot-button'
import { Separator } from '../ui/separator'
import { NavItem } from './nav-item'

interface MobileNavProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  navItems: Partial<Record<DynamicNavSections, NavItemsGroup>>
}

export function PopoverNav({
  isOpen,
  setIsOpen,
  navItems,
}: MobileNavProps) {
  const isMobile = useIsMobile()
  const matches = useMatchMedia()
  const sessionQuery = useSession()

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={{
            type: 'tween',
          }}
          className={cn(
            'fixed h-dvh top-0 bg-background/70 backdrop-blur-md w-full',
            isMobile ? 'right-0 w-[70%]' : 'right-0 w-80 border-l',
          )}
        >
          <div className="px-8 py-8 space-y-4 flex flex-col items-center h-full justify-between">
            <div className="flex flex-col gap-4 items-center">
              {isInternalUser(sessionQuery.data?.user) && navItems['tpr-internal']?.items.map(item => (
                <Fragment key={item.href}>
                  <NavItem
                    item={item}
                    index={0}
                    isActive={false}
                    onMouseEnter={() => {}}
                    selectedItemIndex={null}
                  />
                  <Separator />
                </Fragment>
              ))}
              {!matches.xl && navItems['marketing-links']?.items.map(item => (
                <NavItem
                  key={item.href}
                  item={item}
                  index={0}
                  isActive={false}
                  onClick={() => setIsOpen(false)}
                  onMouseEnter={() => { }}
                  selectedItemIndex={null}
                />
              ))}
            </div>
            <div className="mt-auto">
              <LinkHubspotButton
                onLinkAccount={() => setIsOpen(false)}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
