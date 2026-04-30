'use client'

import { LogOutIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/shared/domains/auth/client'
import { Button } from '../ui/button'

interface Props {
  asMenuItem?: boolean
}

export function LogoutButton({ asMenuItem = false }: Props) {
  const router = useRouter()

  async function handleLogout() {
    await signOut()
    router.push('/')
  }

  return (
    <>
      { asMenuItem
        ? (
            <div onClick={handleLogout} className="flex items-center gap-2 w-full h-full p-2">
              <LogOutIcon />
              Logout
            </div>
          )
        : (
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="w-full transition hover:bg-destructive/80 dark:hover:bg-destructive/80"
            >
              <LogOutIcon />
              Log-out
            </Button>
          )}
    </>
  )
}
