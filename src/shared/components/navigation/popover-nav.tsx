'use client'

import type { DynamicNavSections, NavItemsGroup } from '@/shared/types/nav'

import { AnimatePresence, motion } from 'motion/react'
import { Fragment, useState } from 'react'
import { useSession } from '@/shared/auth/client'
import { useMatchMedia } from '@/shared/hooks/use-match-media'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'
import { useAbility } from '@/shared/permissions/hooks'

import { SignInGoogleButton } from '../buttons/auth/sign-in-google-button'
import { UserButton } from '../buttons/user-button'
import { ThemeToggleButton } from '../theme-toggle-button'
import { Separator } from '../ui/separator'
import { NavItem } from './nav-item'

interface MobileNavProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  navItems: Partial<Record<DynamicNavSections, NavItemsGroup>>
  onNavigate: (href: string) => void
  onExitComplete?: () => void
}

export function PopoverNav({
  isOpen,
  setIsOpen: _setIsOpen,
  navItems,
  onNavigate,
  onExitComplete,
}: MobileNavProps) {
  const [selectedMarketingItemIndex, setSelectedMarketingItemIndex] = useState<number | null>(null)
  const [selectedAgentItemIndex, setSelectedAgentItemIndex] = useState<number | null>(null)

  const isMobile = useIsMobile()
  const matches = useMatchMedia()
  const sessionQuery = useSession()

  const ability = useAbility()
  const isInternalUser = ability.can('access', 'Dashboard')

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
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
          <div className="px-4 py-4 pt-[calc(env(safe-area-inset-top)+1rem)] space-y-4 flex flex-col items-center h-full justify-between">
            <div className="flex flex-col gap-4 items-center w-full">
              {isInternalUser && navItems['tpr-internal']?.items.map((item, index) => (
                <Fragment key={item.name}>
                  <NavItem
                    item={item}
                    index={0}
                    isActive={false}
                    onClick={(e) => {
                      if (item.action === 'navigate') {
                        e.preventDefault()
                        onNavigate(item.href)
                      }
                      else {
                        setSelectedAgentItemIndex(prev => prev === index ? null : index)
                      }
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
                            key={subItem.name}
                            item={subItem}
                            index={subItemIndex}
                            isActive={false}
                            onClick={(e) => {
                              if ('href' in subItem) {
                                e.preventDefault()
                                onNavigate(subItem.href)
                              }
                            }}
                            selectedItemIndex={null}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <Separator />
                </Fragment>
              ))}
              {!matches.xl && navItems['marketing-links'] && navItems['marketing-links'].items.map((item, index) => (
                <Fragment key={item.name}>
                  <NavItem
                    item={item}
                    index={0}
                    isActive={false}
                    onClick={(e) => {
                      if (item.action === 'navigate') {
                        e.preventDefault()
                        onNavigate(item.href)
                      }
                      else {
                        setSelectedMarketingItemIndex(prev => prev === index ? null : index)
                      }
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
                            key={'href' in subItem ? subItem.href : ''}
                            item={subItem}
                            index={subItemIndex}
                            isActive={false}
                            onClick={(e) => {
                              if ('href' in subItem) {
                                e.preventDefault()
                                onNavigate(subItem.href)
                              }
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
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                {sessionQuery.data?.user ? <UserButton user={sessionQuery.data?.user} /> : <SignInGoogleButton />}
              </div>
              <ThemeToggleButton />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
