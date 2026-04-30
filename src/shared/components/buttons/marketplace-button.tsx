'use client'

import { SparkleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '../ui/button'

interface Props {
  asMenuItem?: boolean
  alternateText?: string
}

export function MarketplaceButton({ asMenuItem = false, alternateText }: Props) {
  const router = useRouter()

  function handleClick() {
    router.push('/')
  }

  return (
    <>
      { asMenuItem
        ? (
            <div onClick={handleClick} className="flex items-center gap-2 w-full h-full p-2">
              <SparkleIcon />
              {alternateText || 'Marketplace'}
            </div>
          )
        : (
            <Button variant="destructive" onClick={handleClick}>
              <SparkleIcon />
              Marketplace
            </Button>
          )}
    </>
  )
}
