'use client'

import LogoDarkRight from '@public/company/logo/logo-dark-right.svg'
import LogoLightRight from '@public/company/logo/logo-light-right.svg'
import Image from 'next/image'
import Link from 'next/link'

interface Props {
  onClick?: () => void
}

export function Logo({
  onClick,
}: Props) {
  return (
    <Link
      href="/"
      className="relative w-full min-h-[50px] h-full flex -ml-3"
      onClick={() => {
        onClick?.()
      }}
    >
      <Image
        src={LogoDarkRight}
        alt="Logo"
        className="absolute dark:relative not-dark:hidden object-cover"
        fill
      />
      <Image
        src={LogoLightRight}
        alt="Logo"
        className="absolute dark:hidden not-dark:relative object-cover"
        fill
      />
    </Link>
  )
};
