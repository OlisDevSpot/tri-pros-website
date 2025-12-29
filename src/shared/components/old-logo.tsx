'use client'

import Link from 'next/link'
import { companyInfo } from '@/features/landing/data/company'
import { cn } from '@/shared/lib/utils'

interface Props {
  onClick?: () => void
  currentColorOverride?: string
}

export function Logo({
  onClick,
  currentColorOverride,
}: Props) {
  return (
    <Link
      href="/"
      className=""
      onClick={() => {
        onClick?.()
      }}
    >
      <div className="flex items-center space-x-2">
        <div
          className={cn(
            'h-10 gradient-to-br from-primary to-secondary rounded-xs flex items-center justify-center border-foreground border px-2 transition duration-300',
            currentColorOverride,
          )}
        >
          <span
            className={cn(
              'text-foreground font-bold text-xl font-sans transition duration-300',
              currentColorOverride,
            )}
          >
            TPR
          </span>
        </div>
        <div
          className={cn(
            'flex flex-col transition duration-300 ',
            currentColorOverride,
          )}
        >
          <span className="font-bold text-xl font-sans">{companyInfo.name}</span>
          <span className="text-sm -mt-1 font-sans">Reimagine Construction</span>
        </div>
      </div>
    </Link>
  )
};
