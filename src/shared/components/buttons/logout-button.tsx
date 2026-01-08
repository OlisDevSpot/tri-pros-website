'use client'

import { LogOutIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/shared/auth/client'
import { ROOTS } from '@/shared/config/roots'
import { Button } from '../ui/button'

interface Props {
  asMenuItem?: boolean
}

export function LogoutButton({ asMenuItem = false }: Props) {
  const router = useRouter()

  async function handleLogout() {
    await signOut()
    router.push(`${ROOTS.generateUrl('/', ({ absolute: true }))}`)
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
