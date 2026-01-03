'use client'

import type { NavItemsGroup, NavType } from '@/shared/types/nav'

import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { FaHubspot } from 'react-icons/fa6'
import { oauth2 } from '@/shared/auth/client'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn, getTypedKeys } from '@/shared/lib/utils'
import { Button } from '../ui/button'

interface MobileNavProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  navItemsGroup: Partial<Record<NavType, NavItemsGroup>>
}

export function PopoverNav({
  isOpen,
  setIsOpen,
  navItemsGroup,
}: MobileNavProps) {
  const isMobile = useIsMobile()

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: isMobile ? 'auto' : '100vh' }}
          exit={{ opacity: 0, height: 0 }}
          className={cn(
            'bg-background/70 backdrop-blur-md',
            isMobile ? 'absolute top-full w-full border-t' : 'fixed h-screen top-0 right-0 w-80 border-l',
          )}
        >
          <div>
            <Button
              onClick={async () => {
                await oauth2.link({
                  providerId: 'hubspot',
                  callbackURL: '/',
                })

                setIsOpen(false)
              }}
              className="flex items-center gap-2"
            >
              <FaHubspot />
              <span className="sr-only">Link Hubspot</span>
            </Button>
          </div>
          <div className="px-4 py-4 space-y-4 flex flex-col items-center">
            {getTypedKeys(navItemsGroup).map(key => (
              <motion.div key={key as string}>
                {navItemsGroup[key] && navItemsGroup[key].sectionName !== 'Public' && <h4>{navItemsGroup[key].sectionName}</h4>}
                {navItemsGroup[key] && navItemsGroup[key].items.map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="w-full"
                  >
                    <Link
                      href={item.href}
                      className="block text-foreground hover:text-secondary transition-colors duration-200 font-medium py-2 w-full text-center"
                      onClick={() => setIsOpen(false)}
                    >
                      {item.name}
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
