'use client'

import { BadgeCheckIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/shared/components/ui/button'

interface Props {
  asMenuItem?: boolean
}

export function AccountButton({ asMenuItem = false }: Props) {
  const router = useRouter()

  function handleClick() {
    router.push('/profile')
  }

  return (
    <>
      { asMenuItem
        ? (
            <div onClick={handleClick} className="flex items-center gap-2 w-full h-full p-2">
              <BadgeCheckIcon />
              Account
            </div>
          )
        : (
            <Button variant="destructive" onClick={handleClick}>
              <BadgeCheckIcon />
              Account
            </Button>
          )}
    </>
  )
}
