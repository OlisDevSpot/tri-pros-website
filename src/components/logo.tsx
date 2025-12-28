'use client'

import LogoDarkBottom from '@public/company/logo/logo-dark-bottom.svg'
import LogoDarkRight from '@public/company/logo/logo-dark-right.svg'
import LogoDarkIcon from '@public/company/logo/logo-dark.svg'
import LogoLightBottom from '@public/company/logo/logo-light-bottom.svg'
import LogoLightRight from '@public/company/logo/logo-light-right.svg'
import LogoLightIcon from '@public/company/logo/logo-light.svg'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface LogoLinkProps {
  variant?: 'icon' | 'right' | 'bottom'
  onClick?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void
}

const logoLight = {
  icon: LogoLightIcon,
  right: LogoLightRight,
  bottom: LogoLightBottom,
}

const logoDark = {
  icon: LogoDarkIcon,
  right: LogoDarkRight,
  bottom: LogoDarkBottom,
}

export function LogoLink({
  variant = 'right',
  onClick,
}: LogoLinkProps) {
  return (
    <Link
      href="/"
      className="relative min-w-fit w-full flex h-full"
      onClick={(e) => {
        onClick?.(e)
      }}
    >
      <Logo variant={variant} />
    </Link>
  )
};

interface LogoProps {
  variant?: 'icon' | 'right' | 'bottom'
  className?: string
}

export function Logo({
  variant = 'right',
  className,
}: LogoProps) {
  return (
    <div className={cn(
      'relative min-w-fit w-full flex h-full',
      className,
    )}
    >
      <Image
        src={logoDark[variant]}
        alt="Logo"
        className="absolute dark:relative not-dark:hidden"
        fill
      />
      <Image
        src={logoLight[variant]}
        alt="Logo"
        className="absolute dark:hidden not-dark:relative"
        fill
      />
    </div>
  )
}
