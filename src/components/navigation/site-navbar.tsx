'use client'

import { ChevronUpIcon, PhoneCallIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button, MotionButton } from '@/components/ui/button'
import { navigationItems } from '@/data/nav-items'
import { companyInfo } from '@/features/landing/data/company'
import { useIsMobile } from '@/hooks/use-mobile'
import { useIsScrolled } from '@/hooks/useIsScrolled'
import { cn } from '@/lib/utils'
import { MobileNav } from './mobile-nav'

interface Props {
  item: {
    name: string
    href: string
    subItems?: { name: string, href: string }[]
  }
  index: number
  isActive: boolean
  onMouseEnter: () => void
  selectedItemIndex: number | null
}

export function NavigationItem({
  item,
  index,
  isActive,
  onMouseEnter,
  selectedItemIndex,
}: Props) {
  const scrolled = useIsScrolled(10)

  return (
    <motion.div
      key={item.name}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="px-8 py-4"
      onMouseEnter={onMouseEnter}
    >
      <Link
        href={item.href}
        className={cn(
          'relative hover:text-neutral-300 transition-colors duration-200 font-medium',
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
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(3)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const scrolled = useIsScrolled(10)
  const isMobile = useIsMobile()
  const pathname = usePathname()

  const isActive = (href: string) => `/${pathname.split('/')[1]}` === href

  function findSelectedItem(index: number) {
    return navigationItems.find((item, i) => i === index)
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
              setSelectedItemIndex(null)
              setIsMobileOpen(false)
            }}
          />
        )}
      </AnimatePresence>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={cn(
          'fixed left-0 right-0 z-50 transition-all duration-300',
          scrolled ? 'bg-background/95 shadow-lg' : 'bg-transparent',
        )}
        style={{
          top: scrolled || isMobile || pathname !== '/' ? '0' : '32px',
          height: scrolled ? 'auto' : 'auto',
        }}
      >
        <div className="px-4 sm:px-14 w-full">
          <div className="flex justify-between items-center h-(--navbar-height) w-full">
            {/* Logo */}
            <motion.div className="w-[200px] h-full">
              <Logo onClick={() => setIsMobileOpen(false)} />
            </motion.div>

            {/* Desktop Navigation */}
            <div
              onMouseLeave={() => setSelectedItemIndex(null)}
              className="relative hidden lg:block"
            >
              {/* Navigation Items */}
              <div className="flex items-center">
                {navigationItems.map((item, index) => (
                  <NavigationItem
                    key={item.name}
                    item={item}
                    index={index}
                    isActive={isActive(item.href)}
                    onMouseEnter={() => {
                      if (item.subItems && item.subItems.length > 0) {
                        setSelectedItemIndex(index)
                      }
                      else {
                        setSelectedItemIndex(null)
                      }
                    }}
                    selectedItemIndex={selectedItemIndex}
                  />
                ))}
              </div>
              {/* Additional Content */}
              <AnimatePresence>
                {selectedItemIndex !== null && (
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
                    <div className="flex flex-col">
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
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    className="h-12"
                    size="lg"
                    variant="cta"
                    asChild
                  >
                    <Link
                      href="/contact"
                    >
                      Schedule Consultation
                    </Link>
                  </Button>
                </motion.div>
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
          </div>
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
