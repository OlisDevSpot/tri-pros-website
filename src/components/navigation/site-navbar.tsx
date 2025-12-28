/* eslint-disable node/prefer-global/process */
'use client'

import type { MotionValue, Variants } from 'motion/react'
import { ArrowRightIcon, ChevronUpIcon, NotebookIcon, PhoneIcon } from 'lucide-react'
import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '@/components/logo'
import { ThemeToggleButton } from '@/components/theme-toggle-button'
import { MotionButton } from '@/components/ui/button'
import { companyInfo } from '@/features/landing/data/company'
import { useHasScrolled } from '@/hooks/use-has-scrolled'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { navigationItems } from '@/shared/constants/nav-items'
import { MobileNav } from './mobile-nav'

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

interface Props {
  item: {
    name: string
    href: string
    subItems?: readonly { name: string, href: string }[]
  }
  index: number
  isActive: boolean
  onTabClick?: () => void
  onMouseEnter: () => void
  selectedItemIndex: number | null
  width?: MotionValue<number>
  left?: MotionValue<number>
}

export function NavigationItem({
  item,
  index,
  isActive,
  onTabClick,
  onMouseEnter,
  selectedItemIndex,
  width,
  left,
}: Props) {
  const scrolled = useHasScrolled(10)
  const buttonRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!left || !width || !buttonRef.current || selectedItemIndex !== index)
      return

    const clientRect = buttonRef.current.getBoundingClientRect()
    const containerLeft = document.getElementById('nav-items-container')?.getBoundingClientRect()!.left as number

    animate(width, clientRect.width)
    animate(left, clientRect.x - containerLeft)
  }, [selectedItemIndex, index, left, width])

  return (
    <motion.div
      ref={buttonRef}
      key={item.name}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onMouseEnter={onMouseEnter}
      onClick={() => {
        onTabClick?.()
      }}
    >
      <Link
        href={item.href}
        className={cn(
          'relative inline-block px-8 py-4 hover:text-foreground/70 transition-colors duration-200 font-medium',
          scrolled ? 'text-foreground' : 'text-foreground',
          isActive ? 'text-primary hover:text-primary' : '',
        )}
      >
        <div className="flex gap-2 items-center w-fit">
          {item.name}
          {item.subItems && item.subItems.length > 0 && (
            <ChevronUpIcon
              className={cn(
                'size-4 transition-transform -mr-2',
                selectedItemIndex === index || isActive ? 'rotate-180' : '',
              )}
            />
          )}
        </div>
      </Link>
    </motion.div>
  )
}

export function SiteNavbar() {
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const scrolled = useHasScrolled(10)
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const subitemsContainerRef = useRef<HTMLDivElement | null>(null)

  const width = useMotionValue(0)
  const left = useMotionValue(0)
  const subitemsContainerHeight = useMotionValue(150)

  useEffect(() => {
    if (!subitemsContainerRef.current)
      return

    const containerRect = subitemsContainerRef.current.getBoundingClientRect()
    animate(subitemsContainerHeight, containerRect.height, { type: 'tween', duration: 0.2 })
  }, [selectedItemIndex, subitemsContainerHeight])

  const isActive = (href: string) => `/${pathname.split('/')[1]}` === href

  function findSelectedItem(index: number): { name: string, href: string, subItems: readonly { name: string, href: string }[] } | undefined {
    const item = navigationItems.find((_, i) => i === index)

    if (!item || !('subItems' in item))
      return undefined

    return item
  }

  function closeNavigation() {
    setSelectedItemIndex(null)
    setIsMobileOpen(false)
    animate(width, 0)
  }

  return (
    <>
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
      <motion.nav
        className={cn(
          'fixed left-0 right-0 z-50 transition-all duration-300',
          scrolled ? 'bg-background/95 shadow-lg' : 'bg-transparent',
        )}
        style={{
          top: scrolled || isMobile || pathname !== '/' ? '0' : '32px',
          height: scrolled ? 'auto' : 'auto',
        }}
      >
        <div
          className="px-4 sm:px-14 w-full"
        >
          <motion.div
            variants={navContainerVariants}
            initial="initial"
            animate="animate"
            className="flex justify-between items-center h-(--navbar-height) w-full"
          >
            {/* Logo */}
            <motion.div className="w-[180px] h-full shrink-0">
              <Logo onClick={() => setIsMobileOpen(false)} />
            </motion.div>

            {/* Desktop Navigation */}
            <div
              onMouseLeave={() => {
                closeNavigation()
              }}
              className="relative hidden 2xl:block"
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
                {navigationItems.map((item, index) => (
                  <NavigationItem
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
                {selectedItemIndex && 'subItems' in navigationItems[selectedItemIndex] && navigationItems[selectedItemIndex]?.subItems && (
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
              {process.env.NODE_ENV === 'development' && (
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
                    )
                  }
                  asChild
                >
                  <Link href="/proposal">
                    <NotebookIcon />
                  </Link>
                </MotionButton>
              )}
              <ThemeToggleButton className={
                cn(
                  'h-12 w-12 border-foreground/15 shadow-md',
                  pathname === '/' ? 'rounded-[40px]' : '',
                )
              }
              />
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
                  )
                }
                asChild
              >
                <a href={`tel:+1${companyInfo.contactInfo.find(info => info.accessor === 'phone')?.value}`}>
                  <PhoneIcon />
                </a>
              </MotionButton>
              <div className="hidden md:block">
                <MotionButton
                  className={
                    cn(
                      'h-12 shadow-sm shadow-foreground/30',
                      pathname === '/' ? 'rounded-4xl' : '',
                    )
                  }
                  size="lg"
                  variant="cta"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  asChild
                >
                  <Link
                    href="/contact"
                    className="flex items-center gap-2 px-2"
                  >
                    Schedule Consultation
                    <ArrowRightIcon />
                  </Link>
                </MotionButton>
              </div>

              {/* Mobile menu button */}
              <MotionButton
                size="icon"
                variant="outline"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className={
                  cn(
                    '2xl:hidden h-12 w-12',
                  )
                }
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                aria-label="Toggle menu"
                type="button"
              >
                <motion.div
                  animate={isMobileOpen ? 'open' : 'closed'}
                  className="w-6 h-6 flex flex-col justify-center items-center"
                >
                  <motion.span
                    variants={{
                      closed: { rotate: 0, y: 0 },
                      open: { rotate: 45, y: 5 },
                    }}
                    className="w-6 h-0.5 bg-foreground block transition-all duration-300"
                  />
                  <motion.span
                    variants={{
                      closed: { opacity: 1 },
                      open: { opacity: 0 },
                    }}
                    className="w-6 h-0.5 bg-foreground block mt-1 transition-all duration-300"
                  />
                  <motion.span
                    variants={{
                      closed: { rotate: 0, y: 0 },
                      open: { rotate: -45, y: -5 },
                    }}
                    className="w-6 h-0.5 bg-foreground block mt-1 transition-all duration-300"
                  />
                </motion.div>
              </MotionButton>
            </div>
          </motion.div>
        </div>

        {/* Mobile Navigation */}
        <MobileNav
          isOpen={isMobileOpen}
          setIsOpen={setIsMobileOpen}
          navigationItems={navigationItems}
        />
      </motion.nav>
    </>
  )
}
