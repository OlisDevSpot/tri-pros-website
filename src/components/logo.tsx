'use client'

import LogoDarkRight from '@public/logo-dark-right.svg'
import LogoLightRight from '@public/logo-light-right.svg'
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
      className="relative w-full h-full flex"
      onClick={() => {
        onClick?.()
      }}
    >
      <Image
        src={LogoDarkRight}
        alt="Logo"
        className="absolute dark:relative !dark:hidden object-cover"
        fill
      />
      <Image
        src={LogoLightRight}
        alt="Logo"
        className="absolute dark:hidden !dark:relative object-cover"
        fill
      />
    </Link>
  )
};
