'use client'

import type { DynamicNavSections, NavItemsGroup } from '@/shared/types/nav'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Fragment, useState } from 'react'
import { BRAND_EASE } from '@/shared/constants/motion'
import { useSession } from '@/shared/domains/auth/client'
import { useAbility } from '@/shared/domains/permissions/client'
import { useMatchMedia } from '@/shared/hooks/use-match-media'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'

import { SignInGoogleButton } from '../buttons/auth/sign-in-google-button'
import { UserButton } from '../buttons/user-button'
import { ThemeToggleButton } from '../theme-toggle-button'
import { AnimatedCollapsibleContent } from '../ui/collapsible'
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
  const reduceMotion = useReducedMotion()

  const ability = useAbility()
  const isInternalUser = ability.can('access', 'Dashboard')

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: reduceMotion ? 0 : 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduceMotion ? 0 : 100 }}
          transition={{ type: 'tween', ease: BRAND_EASE, duration: 0.4 }}
          className={cn(
            'fixed inset-y-0 bg-background/70 backdrop-blur-md w-full',
            isMobile ? 'right-0 w-[70%]' : 'right-0 w-80 border-l',
          )}
        >
          <div className="px-4 py-4 pt-[calc(env(safe-area-inset-top)+1rem)] space-y-4 flex flex-col items-center h-full justify-between">
            <div className="flex flex-col gap-4 items-center w-full">
              {isInternalUser && navItems['tpr-internal']?.items.map((item, index) => (
                <Fragment key={item.name}>
                  {/* The section's top gap lives inside its reveal: a collapsed section left in the gap-4 column would still take a gap, so everything below would pop 16px as it mounts and unmounts. */}
                  <div className="flex w-full flex-col items-center">
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
                      expanded={selectedAgentItemIndex === index}
                      selectedItemIndex={null}
                      animateEntrance={false}
                    />
                    <AnimatedCollapsibleContent open={selectedAgentItemIndex === index}>
                      <div className="space-y-2 pt-4">
                        {'subItems' in item && item.subItems.map(subItem => (
                          <NavItem
                            key={subItem.name}
                            item={subItem}
                            index={0}
                            isActive={false}
                            onClick={(e) => {
                              if ('href' in subItem) {
                                e.preventDefault()
                                onNavigate(subItem.href)
                              }
                            }}
                            selectedItemIndex={null}
                            animateEntrance={false}
                          />
                        ))}
                      </div>
                    </AnimatedCollapsibleContent>
                  </div>
                  <Separator />
                </Fragment>
              ))}
              {!matches.xl && navItems['marketing-links'] && navItems['marketing-links'].items.map((item, index) => (
                <div key={item.name} className="flex w-full flex-col items-center">
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
                    expanded={selectedMarketingItemIndex === index}
                    selectedItemIndex={selectedMarketingItemIndex}
                    animateEntrance={false}
                  />
                  <AnimatedCollapsibleContent open={selectedMarketingItemIndex === index}>
                    <div className="space-y-2 pt-4">
                      {'subItems' in item && item.subItems.map(subItem => (
                        <NavItem
                          key={'href' in subItem ? subItem.href : ''}
                          item={subItem}
                          index={0}
                          isActive={false}
                          onClick={(e) => {
                            if ('href' in subItem) {
                              e.preventDefault()
                              onNavigate(subItem.href)
                            }
                          }}
                          selectedItemIndex={null}
                          animateEntrance={false}
                        />
                      ))}
                    </div>
                  </AnimatedCollapsibleContent>
                </div>
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
