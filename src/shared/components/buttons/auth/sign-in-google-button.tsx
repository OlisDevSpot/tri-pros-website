'use client'

import type { LoginFormSchema } from '@/shared/domains/auth/schemas'
import { FcGoogle } from 'react-icons/fc'

import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { signIn } from '@/shared/domains/auth/client'

interface Props extends React.ComponentProps<'div'> {
  onSubmitCallback?: (data: LoginFormSchema) => Promise<void>
  isPending?: boolean
  callbackURL?: string
}

export function SignInGoogleButton({
  isPending = false,
  // The dashboard page sends signed-in users without dashboard access back to '/'.
  callbackURL = ROOTS.dashboard.root,
}: Props) {
  return (
    // `secondary` is one rung above whatever holds it: the card on the sign-in page, the dialog, the menu panel.
    <Button
      variant="secondary"
      type="submit"
      disabled={isPending}
      className="h-10 w-full border"
      onClick={async () => {
        await signIn.social({
          provider: 'google',
          callbackURL,
          errorCallbackURL: callbackURL,
        })
      }}
    >
      <FcGoogle className="size-5" />
      Sign in with Google
    </Button>
  )
}
