'use client'

import type { DynamicNavSections, NavItemsGroup } from '@/shared/types/nav'

import { AnimatePresence, motion } from 'motion/react'
import { Fragment, useState } from 'react'
import { useSession } from '@/shared/auth/client'
import { isInternalUser } from '@/shared/auth/lib/is-internal-user'
import { useMatchMedia } from '@/shared/hooks/use-match-media'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'

import { LinkHubspotButton } from '../buttons/auth/link-hubspot-button'
import { SignInGoogleButton } from '../buttons/auth/sign-in-google-button'
import { UserButton } from '../buttons/user-button'
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
  const [selectedMarketingItemIndex, setSelectedMarketingItemIndex] = useState<number | null>(null)
  const [selectedAgentItemIndex, setSelectedAgentItemIndex] = useState<number | null>(null)

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
          <div className="px-4 py-4 space-y-4 flex flex-col items-center h-full justify-between">
            <div className="flex flex-col gap-4 items-center w-full">
              {isInternalUser(sessionQuery.data?.user) && navItems['tpr-internal']?.items.map((item, index) => (
                <Fragment key={item.href}>
                  <NavItem
                    item={item}
                    index={0}
                    isActive={false}
                    onClick={() => {
                      setSelectedAgentItemIndex(prev => prev === index ? null : index)
                    }}
                    selectedItemIndex={null}
                  />
                  <AnimatePresence>
                    {selectedAgentItemIndex === index && navItems['tpr-internal'] && 'subItems' in navItems['tpr-internal'].items?.[selectedAgentItemIndex] && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-2"
                        key={selectedAgentItemIndex}
                      >
                        {navItems['tpr-internal']?.items?.[selectedAgentItemIndex]?.subItems?.map((subItem, subItemIndex) => (
                          <NavItem
                            key={subItem.href}
                            item={subItem}
                            index={subItemIndex}
                            isActive={false}
                            selectedItemIndex={selectedAgentItemIndex}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <Separator />
                </Fragment>
              ))}
              {!matches.xl && navItems['marketing-links'] && navItems['marketing-links'].items.map((item, index) => (
                <Fragment key={item.href}>
                  <NavItem
                    item={item}
                    index={0}
                    isActive={false}
                    onClick={() => {
                      setSelectedMarketingItemIndex(prev => prev === index ? null : index)
                    }}
                    selectedItemIndex={selectedMarketingItemIndex}
                  />
                  <AnimatePresence>
                    {selectedMarketingItemIndex === index && navItems['marketing-links'] && 'subItems' in navItems['marketing-links'].items?.[selectedMarketingItemIndex] && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-2"
                        key={selectedMarketingItemIndex}
                      >
                        {navItems['marketing-links']?.items?.[selectedMarketingItemIndex]?.subItems?.map((subItem, subItemIndex) => (
                          <NavItem
                            key={subItem.href}
                            item={subItem}
                            index={subItemIndex}
                            isActive={false}
                            onClick={() => {
                              setSelectedMarketingItemIndex(subItemIndex)
                            }}
                            selectedItemIndex={null}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Fragment>
              ))}
            </div>
            <div className="mt-auto space-y-2 gap-4 w-full">
              <div className="w-full px-3">
                {isInternalUser(sessionQuery.data?.user) && (
                  <LinkHubspotButton
                    onLinkAccount={() => setIsOpen(false)}
                  />
                )}
              </div>
            </div>
            {sessionQuery.data?.user ? <UserButton user={sessionQuery.data?.user} /> : <SignInGoogleButton />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
