'use client'

import type { Variants } from 'motion/react'
import { CalendarPlus2Icon, LogInIcon, LogOutIcon, MenuIcon, PhoneIcon } from 'lucide-react'
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  // useMemo,
  useRef,
  useState,
} from 'react'
import { MotionButton } from '@/shared/components/buttons/motion-button'
import { MotionLink } from '@/shared/components/buttons/motion-link'
import { LogoLink } from '@/shared/components/logo'
import { ThemeToggleButton } from '@/shared/components/theme-toggle-button'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'
import { BRAND_EASE } from '@/shared/constants/motion'
import { generateNavItemsGroups, marketingNavItems } from '@/shared/constants/nav-items'
import { signOut, useSession } from '@/shared/domains/auth/client'
import { useAbility } from '@/shared/domains/permissions/client'
import { useHasScrolled } from '@/shared/hooks/use-has-scrolled'
import { useMatchMedia } from '@/shared/hooks/use-match-media'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { openSignIn } from '@/shared/lib/open-sign-in'
import { toDialString } from '@/shared/lib/phone'
import { cn } from '@/shared/lib/utils'
import { SpinnerLoader2 } from '../loaders/spinner-loader-2'
import { NavItem } from './nav-item'
import { PopoverNav } from './popover-nav'

const navContainerVariants: Variants = {
  initial: {
    y: -100,
  },
  animate: {
    y: 0,
    transition: {
      type: 'tween',
      ease: BRAND_EASE,
      staggerChildren: 0.4,
      duration: 0.4,
    },
  },
}

export function SiteNavbar() {
  const { data: session, isPending } = useSession()
  const ability = useAbility()
  const [authError] = useQueryState('error', { defaultValue: '' })
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  const router = useRouter()
  const scrolled = useHasScrolled(10)
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const matches = useMatchMedia()
  const reduceMotion = useReducedMotion()

  const pendingNavRef = useRef<string | null>(null)
  const pressPointerRef = useRef<string>('')
  const width = useMotionValue(0)
  const left = useMotionValue(0)
  const subitemsContainerHeight = useMotionValue(0)
  const subitemsContainerRef = useRef<HTMLDivElement | null>(null)
  const prevSelectedItemIndexRef = useRef<number | null>(null)
  const shownPanelRef = useRef<{ node: HTMLDivElement | null, openedAt: number }>({ node: null, openedAt: 0 })

  const getPopoverNavItems = useCallback(() => {
    const items = generateNavItemsGroups({ ability })

    return items
  }, [ability])

  // const hasPopoverItems = useMemo(() => {
  //   return Object.values(getPopoverNavItems()).flatMap(group => group?.items).filter(Boolean).length > 0
  // }, [getPopoverNavItems])

  // Measured before paint, so the panel opens at its final height instead of growing into it.
  useLayoutEffect(() => {
    const prevIndex = prevSelectedItemIndexRef.current
    prevSelectedItemIndexRef.current = selectedItemIndex
    if (prevIndex === null)
      width.jump(0)

    const content = subitemsContainerRef.current
    if (!content || selectedItemIndex === null || marketingNavItems[selectedItemIndex].action !== 'readonly')
      return

    const height = content.offsetHeight
    const panelWasShowing = content === shownPanelRef.current.node
    if (!panelWasShowing || reduceMotion) {
      if (!panelWasShowing)
        shownPanelRef.current = { node: content, openedAt: performance.now() }
      subitemsContainerHeight.jump(height)
      if (!panelWasShowing)
        return
    }
    else {
      animate(subitemsContainerHeight, height, { duration: 0.18, ease: BRAND_EASE })
    }
    // A reopen mid-exit, or a switch right after opening, is already covered by the panel's own fade; a second one would stack.
    if (prevIndex !== null && performance.now() - shownPanelRef.current.openedAt > 150) {
      content.style.opacity = '0'
      animate(content, { opacity: [0, 1] }, { duration: 0.18, ease: BRAND_EASE })
    }
  }, [selectedItemIndex, subitemsContainerHeight, width, reduceMotion])

  useEffect(() => {
    if (authError) {
      // eslint-disable-next-line no-alert
      alert(authError.replaceAll('_', ' '))
    }
  }, [authError])

  const isActive = (href: string) => `/${pathname.split('/')[1]}` === href

  function handlePopoverNavigate(href: string) {
    pendingNavRef.current = href
    setIsPopoverOpen(false)
  }

  function handlePopoverExitComplete() {
    if (pendingNavRef.current) {
      router.push(pendingNavRef.current)
      pendingNavRef.current = null
    }
  }

  function closeNavigation() {
    setSelectedItemIndex(null)
    setIsPopoverOpen(false)
    animate(width, 0, { duration: 0.18, ease: BRAND_EASE })
  }

  function openLoginModal() {
    closeNavigation()
    openSignIn()
  }

  return (
    <>
      {/* NAV OVERLAY */}
      <AnimatePresence>
        {(selectedItemIndex !== null || isPopoverOpen) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-49 bg-background/50"
            onClick={() => {
              closeNavigation()
            }}
          />
        )}
      </AnimatePresence>

      {/* NAV */}
      <motion.nav
        className={cn(
          'fixed left-0 right-0 z-50 transition-all duration-300',
          scrolled ? 'bg-background/95 shadow-lg' : 'bg-transparent',
        )}
        style={{
          top: scrolled || !matches.lg || pathname !== '/' ? '0' : '32px',
          height: scrolled ? 'auto' : 'auto',
        }}
      >
        <div
          className="px-4 sm:px-8 lg:px-14 w-full pt-[env(safe-area-inset-top)]"
        >
          <motion.div
            variants={navContainerVariants}
            initial={reduceMotion ? false : 'initial'}
            animate="animate"
            className="flex justify-between items-center h-(--navbar-height) w-full"
          >
            {/* Logo */}
            <motion.div className="w-45 h-full shrink-0">
              <LogoLink onClick={() => setIsPopoverOpen(false)} />
            </motion.div>

            {/* Desktop Navigation */}
            <div
              onMouseLeave={() => {
                closeNavigation()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape')
                  closeNavigation()
              }}
              className="relative hidden xl:block"
            >
              {/* Navigation Items */}
              <div
                id="nav-items-container"
                className="relative flex items-center"
              >
                <motion.div
                  style={{
                    width,
                    left,
                  }}
                  className="absolute h-0.5 bg-foreground bottom-0"
                />
                {marketingNavItems.map((item, index) => (
                  <NavItem
                    key={item.name}
                    item={item}
                    width={width}
                    left={left}
                    index={index}
                    isActive={isActive(item.action === 'navigate' ? item.href : '')}
                    expanded={selectedItemIndex === index}
                    onPointerDown={(e) => {
                      pressPointerRef.current = e.pointerType
                    }}
                    // A tap also fires compat mouse events and then a click, so only a real mouse opens on hover and any other press toggles.
                    onPointerEnter={(e) => {
                      if (e.pointerType === 'mouse')
                        setSelectedItemIndex(index)
                    }}
                    onClick={(e) => {
                      const pointer = e.detail === 0 ? '' : pressPointerRef.current
                      pressPointerRef.current = ''
                      if (item.action === 'readonly' && (pointer === 'mouse' || selectedItemIndex !== index))
                        setSelectedItemIndex(index)
                      else
                        closeNavigation()
                    }}
                    selectedItemIndex={selectedItemIndex}
                  />
                ))}
              </div>
              {/* Additional Content */}
              <AnimatePresence>
                {selectedItemIndex !== null && marketingNavItems[selectedItemIndex].action === 'readonly' && (
                  <motion.div
                    initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                    transition={{ type: 'tween', ease: BRAND_EASE, duration: 0.18 }}
                    className="absolute top-[calc(100%+24px)] left-0 right-0 bg-background/80 backdrop-blur-sm border-foreground/30 shadow-2xl rounded-lg"
                  >
                    {/* Bridge */}
                    <div className="absolute -top-6 h-6 left-0 w-full" />

                    {/* The clip lives here, not on the panel, or it would clip the bridge above and break the hover path into the panel. */}
                    <motion.div
                      style={{
                        height: subitemsContainerHeight,
                      }}
                      className="overflow-hidden rounded-lg"
                    >
                      {/* Content */}
                      <div
                        ref={subitemsContainerRef}
                        onClick={() => {
                          closeNavigation()
                        }}
                        className="flex flex-col"
                      >
                        {marketingNavItems[selectedItemIndex].subItems?.map(subItem => (
                          <Button
                            key={subItem.name}
                            variant="link"
                            className="h-12 focus-visible:ring-inset"
                            asChild
                          >
                            <Link
                              href={subItem.href}
                              className="flex items-center justify-start h-20"
                            >
                              {subItem.name}
                            </Link>
                          </Button>
                        ))}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex gap-2 items-center">
              {!isMobile && matches['2xl'] && (
                <div className="flex gap-2 items-center">
                  {isPending
                    ? (
                        <SpinnerLoader2 />
                      )
                    : (
                        <MotionButton
                          size="icon"
                          variant="outline"
                          initial={{ opacity: 0, y: reduceMotion ? 0 : -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: 'tween', ease: BRAND_EASE, duration: 0.4 }}
                          style={{
                            borderRadius: pathname === '/' ? '40px' : 'var(--radius-md)',
                          }}
                          className={
                            cn(
                              'h-12 w-12 bg-primary text-primary-foreground lg:bg-transparent lg:text-foreground border-foreground/15 shadow-md hover:bg-hover',
                              session?.user && 'stroke-red-200 bg-rose-400 dark:bg-rose-800 lg:bg-rose-400',
                            )
                          }
                          onClick={!session?.user
                            ? openLoginModal
                            : () => {
                                void signOut({ fetchOptions: { onSuccess: () => window.location.assign('/') } })
                              }}
                        >
                          {session?.user ? <LogOutIcon /> : <LogInIcon />}
                        </MotionButton>
                      ) }
                  <ThemeToggleButton className={
                    cn(
                      // The navbar floats over the hero photo, so its outline buttons stay see-through.
                      'h-12 w-12 bg-transparent border-foreground/15 shadow-md hover:bg-hover',
                      pathname === '/' ? 'rounded-[40px]' : '',
                    )
                  }
                  />
                </div>
              )}
              <div>
                {/* Motion sits on the slotted child, not on Button: asChild hands the element a new ref every render,
                    and motion replays `initial` on each re-attach, so the pill would fade in again on every scroll. */}
                <Button
                  className={
                    cn(
                      'h-12 shadow-sm shadow-foreground/30 gap-2 py-1 pl-1 pr-1',
                      pathname === '/' ? 'rounded-4xl' : '',
                    )
                  }
                  size="lg"
                  variant="cta"
                  asChild
                >
                  <motion.div
                    initial={{ opacity: 0, y: reduceMotion ? 0 : -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'tween', ease: BRAND_EASE, duration: 0.4 }}
                  >
                    <Button
                      variant="outline"
                      className={
                        cn(
                          // A capsule drawn inside the CTA pill takes no fill of its own, or the blue pill turns grey.
                          'h-10 w-fit rounded-full bg-transparent border-border/70 hover:bg-primary-foreground/15 text-primary-foreground px-1 py-1 gap-3',
                        )
                      }
                      asChild
                    >
                      <motion.div
                        style={{
                          borderRadius: pathname === '/' ? '40px' : 'var(--radius-md)',
                        }}
                        className="flex items-center"
                      >
                        <Button
                          variant="ghost"
                          size={matches['2xl'] ? 'default' : 'icon'}
                          className={
                            cn(
                              'h-8 w-8 2xl:w-fit rounded-full hover:bg-primary-foreground/15 text-primary-foreground p-0',
                            )
                          }
                          asChild
                        >
                          <MotionLink
                            href={ROOTS.landing.contact()}
                            style={{
                              borderRadius: pathname === '/' ? '40px' : 'var(--radius-md)',
                            }}
                            className="flex items-center gap-2 px-2"
                          >
                            {matches['2xl']
                              ? (
                                  <span>
                                    Schedule Consultation
                                  </span>
                                )
                              : (
                                  <CalendarPlus2Icon />
                                )}
                          </MotionLink>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={
                            cn(
                              'h-8 w-8 rounded-full hover:bg-primary-foreground/15 text-primary-foreground p-0',
                            )
                          }
                          asChild
                        >
                          <motion.a
                            href={`tel:${toDialString(companyInfo.contactInfo.find(info => info.accessor === 'phone')?.value)}`}
                            style={{
                              borderRadius: pathname === '/' ? '40px' : 'var(--radius-md)',
                            }}
                          >
                            <PhoneIcon />
                          </motion.a>
                        </Button>
                      </motion.div>
                    </Button>

                    {/* Popover menu button */}
                    <MotionButton
                      size="icon"
                      variant="ghost"
                      style={{
                        borderRadius: pathname === '/' ? '40px' : 'var(--radius-md)',
                      }}
                      className={
                        cn(
                          'rounded-full hover:bg-primary-foreground/15 flex',
                          // hasPopoverItems ? 'flex' : 'hidden',
                        )
                      }
                      onClick={() => {
                        setIsPopoverOpen(!isPopoverOpen)
                      }}
                      aria-label="Toggle menu"
                      type="button"
                    >
                      <MenuIcon size={24} className="text-primary-foreground h-6 w-6" />
                    </MotionButton>
                  </motion.div>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Mobile Navigation */}
        <PopoverNav
          isOpen={isPopoverOpen}
          setIsOpen={setIsPopoverOpen}
          navItems={getPopoverNavItems()}
          onNavigate={handlePopoverNavigate}
          onExitComplete={handlePopoverExitComplete}
        />
      </motion.nav>
    </>
  )
}
