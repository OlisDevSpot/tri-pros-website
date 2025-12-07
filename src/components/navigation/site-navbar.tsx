'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { navigationItems } from '@/data/nav-items'
import { useIsMobile } from '@/hooks/use-mobile'
import { useIsScrolled } from '@/hooks/useIsScrolled'
import { cn } from '@/lib/utils'
import { MobileNav } from './mobile-nav'

export function SiteNavbar() {
  const [isOpen, setIsOpen] = useState(false)
  const scrolled = useIsScrolled(10)
  const isMobile = useIsMobile()
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href

  return (
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
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <Logo onClick={() => setIsOpen(false)} />
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navigationItems.map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    'relative hover:text-neutral-300 transition-colors duration-200 font-medium',
                    scrolled ? 'text-foreground' : 'text-foreground',
                    isActive(item.href) ? 'text-primary-light' : '',
                  )}
                >
                  {item.name}
                  <motion.div
                    className="absolute -bottom-1 left-0 h-0.5 bg-secondary"
                    initial={{ width: 0 }}
                    whileHover={{ width: '100%' }}
                    transition={{ duration: 0.2 }}
                  />
                </Link>
              </motion.div>
            ))}
          </div>

          {/* CTA Button */}
          <div className="flex gap-2">
            <div>
              <ThemeToggle />
            </div>
            <div className="hidden md:block">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button size="lg" variant="cta" asChild>
                  <Link
                    href="/contact"
                  >
                    Schedule Consultation
                  </Link>
                </Button>
              </motion.div>
            </div>

            {/* Mobile menu button */}
            <button
              className="lg:hidden ml-1"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
              type="button"
            >
              <motion.div
                animate={isOpen ? 'open' : 'closed'}
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
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        navigationItems={navigationItems}
      />
    </motion.nav>
  )
}
