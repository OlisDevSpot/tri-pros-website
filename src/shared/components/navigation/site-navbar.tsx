'use client'

import type { Variants } from 'motion/react'
import { CalendarPlus2Icon, LogInIcon, LogOutIcon, MenuIcon, PhoneIcon } from 'lucide-react'
import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQueryState } from 'nuqs'
import {
  useCallback,
  useEffect,
  // useMemo,
  useRef,
  useState,
} from 'react'
import { companyInfo } from '@/features/landing/data/company'
import { signOut, useSession } from '@/shared/auth/client'
import { MotionButton } from '@/shared/components/buttons/motion-button'
import { LogoLink } from '@/shared/components/logo'
import { ThemeToggleButton } from '@/shared/components/theme-toggle-button'
import { generateNavItemsGroups, publicNavItems } from '@/shared/constants/nav-items'
import { useAuthModalStore } from '@/shared/hooks/use-auth-modal-store'
import { useHasScrolled } from '@/shared/hooks/use-has-scrolled'
import { useMatchMedia } from '@/shared/hooks/use-match-media'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'
import { SignInModal } from '../dialogs/modals/sign-in-modal'
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
      staggerChildren: 0.4,
      duration: 0.5,
    },
  },
}

export function SiteNavbar() {
  const [authError] = useQueryState('error', { defaultValue: '' })
  const [mounted, setMounted] = useState(false)
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const scrolled = useHasScrolled(10)
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const subitemsContainerRef = useRef<HTMLDivElement | null>(null)
  const matches = useMatchMedia()

  const { data: session, isPending } = useSession()

  const { setModal, open: openAuthModal } = useAuthModalStore()

  const width = useMotionValue(0)
  const left = useMotionValue(0)
  const subitemsContainerHeight = useMotionValue(150)

  const getPopoverNavItems = useCallback(() => {
    const items = generateNavItemsGroups({ navType: session?.user?.role !== 'agent' ? 'public' : 'user' })

    return isMobile ? items : { user: items.user }
  }, [isMobile, session])

  // const hasPopoverItems = useMemo(() => {
  //   return Object.values(getPopoverNavItems()).flatMap(group => group?.items).filter(Boolean).length > 0
  // }, [getPopoverNavItems])

  useEffect(() => {
    if (!subitemsContainerRef.current)
      return

    const containerRect = subitemsContainerRef.current.getBoundingClientRect()
    animate(subitemsContainerHeight, containerRect.height, { type: 'tween', duration: 0.2 })
  }, [selectedItemIndex, subitemsContainerHeight])

  useEffect(() => {
    setModal({
      accessor: 'login-modal',
      Element: <SignInModal />,
    })
  }, [setModal])

  useEffect(() => {
    if (!isPending)
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect, react-hooks/set-state-in-effect
      setMounted(true)
  }, [isPending])

  useEffect(() => {
    if (authError) {
      // eslint-disable-next-line no-alert
      alert(authError.replaceAll('_', ' '))
    }
  }, [authError])

  const isActive = (href: string) => `/${pathname.split('/')[1]}` === href

  function findSelectedItem(index: number): { name: string, href: string, subItems: readonly { name: string, href: string }[] } | undefined {
    const item = publicNavItems.find((_, i) => i === index)

    if (!item || !('subItems' in item))
      return undefined

    return item
  }

  if (!mounted)
    return null

  function closeNavigation() {
    setSelectedItemIndex(null)
    setIsMobileOpen(false)
    animate(width, 0)
  }

  function openLoginModal() {
    closeNavigation()
    openAuthModal()
  }

  return (
    <>
      {/* NAV OVERLAY */}
      <AnimatePresence>
        {(selectedItemIndex !== null || isMobileOpen) && (
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
          'fixed left-0 right-0 z-50 transition-all duration-300 scrollbar-gutter-stable',
          scrolled ? 'bg-background/95 shadow-lg' : 'bg-transparent',
        )}
        style={{
          top: scrolled || !matches.lg || pathname !== '/' ? '0' : '32px',
          height: scrolled ? 'auto' : 'auto',
        }}
      >
        <div
          className="px-4 sm:px-8 lg:px-14 w-full"
        >
          <motion.div
            variants={navContainerVariants}
            initial="initial"
            animate="animate"
            className="flex justify-between items-center h-(--navbar-height) w-full"
          >
            {/* Logo */}
            <motion.div className="w-[180px] h-full shrink-0">
              <LogoLink onClick={() => setIsMobileOpen(false)} />
            </motion.div>

            {/* Desktop Navigation */}
            <div
              onMouseLeave={() => {
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
                {publicNavItems.map((item, index) => (
                  <NavItem
                    key={item.name}
                    item={item}
                    width={width}
                    left={left}
                    index={index}
                    isActive={isActive(item.href)}
                    onTabClick={() => {
                      setSelectedItemIndex(null)
                    }}
                    onMouseEnter={() => {
                      setSelectedItemIndex(index)
                    }}
                    selectedItemIndex={selectedItemIndex}
                  />
                ))}
              </div>
              {/* Additional Content */}
              <AnimatePresence>
                {selectedItemIndex && 'subItems' in publicNavItems[selectedItemIndex] && publicNavItems[selectedItemIndex]?.subItems && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      height: subitemsContainerHeight,
                    }}
                    className="absolute top-[calc(100%+24px)] left-0 right-0 transition-all bg-background/80 backdrop-blur-sm border-foreground/30 shadow-2xl rounded-lg"
                  >
                    {/* Bridge */}
                    <div className="absolute -top-6 h-6 left-0 w-full" />

                    {/* Content */}
                    <div
                      ref={subitemsContainerRef}
                      onClick={() => {
                        closeNavigation()
                      }}
                      className="flex flex-col"
                    >
                      {findSelectedItem(selectedItemIndex)?.subItems?.map((subItem, index) => (
                        <MotionButton
                          key={subItem.name}
                          variant="link"
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="h-12"
                          asChild
                        >
                          <Link
                            href={subItem.href}
                            className="flex items-center justify-start h-20"
                          >
                            {subItem.name}
                          </Link>
                        </MotionButton>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex gap-2 items-center">
              {!isMobile && matches['2xl'] && (
                <div>
                  {isPending
                    ? (
                        <SpinnerLoader2 />
                      )
                    : (
                        <MotionButton
                          size="icon"
                          variant="outline"
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          style={{
                            borderRadius: pathname === '/' ? '40px' : 'var(--radius-md)',
                          }}
                          className={
                            cn(
                              'h-12 w-12 bg-primary text-primary-foreground lg:bg-transparent lg:text-foreground border-foreground/15 shadow-md',
                              session?.user && 'stroke-red-200 bg-rose-400 dark:bg-rose-800 lg:bg-rose-400',
                            )
                          }
                          onClick={!session?.user
                            ? openLoginModal
                            : async () => {
                              await signOut()
                            }}
                        >
                          {session?.user ? <LogOutIcon /> : <LogInIcon />}
                        </MotionButton>
                      ) }
                  <ThemeToggleButton className={
                    cn(
                      'h-12 w-12 border-foreground/15 shadow-md',
                      pathname === '/' ? 'rounded-[40px]' : '',
                    )
                  }
                  />
                </div>
              )}
              <div>
                <MotionButton
                  className={
                    cn(
                      'h-12 shadow-sm shadow-foreground/30 gap-2 py-1 pl-1 pr-1',
                      pathname === '/' ? 'rounded-4xl' : '',
                    )
                  }
                  size="lg"
                  variant="cta"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  asChild
                >
                  <div>
                    <MotionButton
                      variant="outline"
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        borderRadius: pathname === '/' ? '40px' : 'var(--radius-md)',
                      }}
                      className={
                        cn(
                          'h-10 w-fit rounded-full hover:bg-background/20 text-neutral-300 px-1 py-1 gap-3',
                        )
                      }
                      asChild
                    >
                      <div className="flex items-center">
                        <MotionButton
                          variant="ghost"
                          size={matches['2xl'] ? 'default' : 'icon'}
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          style={{
                            borderRadius: pathname === '/' ? '40px' : 'var(--radius-md)',
                          }}
                          className={
                            cn(
                              'h-8 w-8 2xl:w-fit rounded-full hover:bg-background/20 text-neutral-300 p-0',
                            )
                          }
                          asChild
                        >
                          <Link
                            href="/contact"
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
                          </Link>
                        </MotionButton>
                        <MotionButton
                          size="icon"
                          variant="ghost"
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          style={{
                            borderRadius: pathname === '/' ? '40px' : 'var(--radius-md)',
                          }}
                          className={
                            cn(
                              'h-8 w-8 rounded-full hover:bg-background/20 text-neutral-300 p-0',
                            )
                          }
                          asChild
                        >
                          <a href={`tel:+1${companyInfo.contactInfo.find(info => info.accessor === 'phone')?.value}`}>
                            <PhoneIcon />
                          </a>
                        </MotionButton>
                      </div>
                    </MotionButton>
                    {/* Mobile menu button */}
                    <MotionButton
                      size="icon"
                      variant="ghost"
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        borderRadius: pathname === '/' ? '40px' : 'var(--radius-md)',
                      }}
                      className={
                        cn(
                          'rounded-full hover:bg-background/20 flex 2xl:hidden',
                          // hasPopoverItems ? 'flex' : 'hidden',
                        )
                      }
                      onClick={() => {
                        setIsMobileOpen(!isMobileOpen)
                      }}
                      aria-label="Toggle menu"
                      type="button"
                    >
                      <MenuIcon size={24} className="text-neutral-300 h-6 w-6" />
                    </MotionButton>
                  </div>
                </MotionButton>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Mobile Navigation */}
        <PopoverNav
          isOpen={isMobileOpen}
          setIsOpen={setIsMobileOpen}
          navItemsGroup={getPopoverNavItems()}
        />
      </motion.nav>
    </>
  )
}
