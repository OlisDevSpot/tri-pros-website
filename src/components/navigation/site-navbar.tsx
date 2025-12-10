'use client'

import type { MotionValue, Variants } from 'motion/react'
import { ChevronUpIcon, PhoneCallIcon } from 'lucide-react'
import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button, MotionButton } from '@/components/ui/button'
import { navigationItems } from '@/data/nav-items'
import { companyInfo } from '@/features/landing/data/company'
import { useIsMobile } from '@/hooks/use-mobile'
import { useIsScrolled } from '@/hooks/useIsScrolled'
import { cn } from '@/lib/utils'
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
    subItems?: { name: string, href: string }[]
  }
  index: number
  isActive: boolean
  onTabClick?: () => void
  onMouseEnter: () => void
  selectedItemIndex: number | null
  widthValue?: MotionValue<number>
  offsetValue?: MotionValue<number>
}

export function NavigationItem({
  item,
  index,
  isActive,
  onTabClick,
  onMouseEnter,
  selectedItemIndex,
  widthValue,
  offsetValue,
}: Props) {
  const scrolled = useIsScrolled(10)
  const buttonRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (offsetValue && widthValue && buttonRef.current && selectedItemIndex === index) {
      const clientRect = buttonRef.current.getBoundingClientRect()
      const containerLeft = document.getElementById('nav-items-container')?.getBoundingClientRect()!.left as number
      // setWidth(clientRect.width)
      // setOffset(clientRect.x - containerLeft)

      animate(widthValue, clientRect.width)
      animate(offsetValue, clientRect.x - containerLeft)
    }
  }, [selectedItemIndex, index, offsetValue, widthValue])

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
          'relative inline-block px-8 py-4 hover:text-neutral-300 transition-colors duration-200 font-medium',
          scrolled ? 'text-foreground' : 'text-foreground',
          isActive ? 'text-primary hover:text-primary' : '',
        )}
      >
        <div className="flex gap-2 items-center w-fit">
          {item.name}
          {item.subItems && item.subItems.length > 0 && (
            <ChevronUpIcon
              className={cn('size-4 transition-transform -mr-2', selectedItemIndex === index ? 'rotate-180' : '')}
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
  const scrolled = useIsScrolled(10)
  const isMobile = useIsMobile()
  const pathname = usePathname()

  const widthValue = useMotionValue(0)
  const offsetValue = useMotionValue(0)

  const isActive = (href: string) => `/${pathname.split('/')[1]}` === href

  function findSelectedItem(index: number) {
    return navigationItems.find((item, i) => i === index)
  }

  function closeNavigation() {
    setSelectedItemIndex(null)
    setIsMobileOpen(false)
    animate(widthValue, 0)
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
            <motion.div className="w-[200px] h-full">
              <Logo onClick={() => setIsMobileOpen(false)} />
            </motion.div>

            {/* Desktop Navigation */}
            <div
              onMouseLeave={() => {
                closeNavigation()
              }}
              className="relative hidden lg:block"
            >
              {/* Navigation Items */}
              <div
                id="nav-items-container"
                className="relative flex items-center"
              >
                <motion.div
                  style={{
                    width: widthValue ?? 0,
                    left: offsetValue ?? 0,
                  }}
                  className="absolute h-0.5 bg-foreground bottom-0"
                />
                {navigationItems.map((item, index) => (
                  <NavigationItem
                    key={item.name}
                    item={item}
                    widthValue={widthValue}
                    offsetValue={offsetValue}
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
                {selectedItemIndex && navigationItems[selectedItemIndex]?.subItems && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      height: 'auto',
                    }}
                    className="absolute top-[calc(100%+24px)] left-0 right-0 transition-all bg-background/80 backdrop-blur-sm border-foreground/30 shadow-2xl rounded-lg"
                  >
                    {/* Bridge */}
                    <div className="absolute -top-6 h-6 left-0 w-full" />

                    {/* Content */}
                    <div
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

            {/* CTA Button */}
            <div className="flex gap-2 items-center">
              <div className="w-12 h-full">
                <ThemeToggle />
              </div>
              <div>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-12 w-12 bg-primary text-primary-foreground lg:bg-transparent lg:text-foreground"
                  asChild
                >
                  <a href={`tel:+1${companyInfo.contactInfo.find(info => info.accessor === 'phone')?.value}`}>
                    <PhoneCallIcon />
                  </a>
                </Button>
              </div>
              <div className="hidden md:block">
                <MotionButton
                  className="h-12"
                  size="lg"
                  variant="cta"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  asChild
                >
                  <Link
                    href="/contact"
                  >
                    Schedule Consultation
                  </Link>
                </MotionButton>
              </div>

              {/* Mobile menu button */}
              <Button
                size="icon"
                variant="outline"
                className="lg:hidden h-12 w-12"
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
              </Button>
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
