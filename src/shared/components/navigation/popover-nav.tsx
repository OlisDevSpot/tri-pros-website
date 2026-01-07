'use client'

import type { NavItemsGroup, NavType } from '@/shared/types/nav'

import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { FaHubspot } from 'react-icons/fa6'
import { oauth2, unlinkAccount, useSession } from '@/shared/auth/client'
import { useGetAccounts } from '@/shared/auth/hooks/queries/use-get-accounts'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn, getTypedKeys } from '@/shared/lib/utils'
import { SpinnerLoader2 } from '../loaders/spinner-loader-2'
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
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const session = useSession()

  const accounts = useGetAccounts({ enabled: !!session?.data?.user })

  const hubspotAccountLinked = accounts.data?.find(account => account.providerId === 'hubspot')

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
          <div className="px-8 py-8 space-y-4 flex flex-col items-center h-full">
            {getTypedKeys(navItemsGroup).map(key => (
              <motion.div key={key as string}>
                {navItemsGroup[key] && navItemsGroup[key].items.map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="w-full h-full"
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
            <div className="mt-auto">
              <Button
                onClick={hubspotAccountLinked
                  ? async () => {
                    await unlinkAccount({ providerId: 'hubspot' }, {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: ['accounts'] })
                      },
                    })
                  }
                  : async () => {
                    await oauth2.link({
                      providerId: 'hubspot',
                      callbackURL: '/',
                    }, {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: ['accounts'] })
                      },
                    })

                    setIsOpen(false)
                  }}
                className={cn(
                  'flex items-center gap-2',
                  hubspotAccountLinked && 'text-destructive-foreground bg-destructive hover:bg-destructive/80 hover:text-destructive-foreground/80',
                )}
                disabled={accounts.isLoading}
              >
                <FaHubspot />
                {accounts.isLoading
                  ? <SpinnerLoader2 />
                  : (
                      <span>
                        {hubspotAccountLinked ? 'Unlink' : 'Link'}
                        {' '}
                        Hubspot
                      </span>
                    )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
