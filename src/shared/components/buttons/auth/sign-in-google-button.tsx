'use client'

import type { LoginFormSchema } from '@/shared/domains/auth/schemas'
import { FaGoogle } from 'react-icons/fa6'

import { Button } from '@/shared/components/ui/button'
import { signIn } from '@/shared/domains/auth/client'

interface Props extends React.ComponentProps<'div'> {
  onSubmitCallback?: (data: LoginFormSchema) => Promise<void>
  isPending?: boolean
  callbackURL?: string
}

export function SignInGoogleButton({
  isPending = false,
  callbackURL = '/',
}: Props) {
  return (
    <div className="w-full max-w-sm lg:max-w-3xl">
      <div className="w-full">
        <Button
          variant="outline"
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 w-full"
          onClick={async () => {
            await signIn.social({
              provider: 'google',
              callbackURL,
              errorCallbackURL: callbackURL,
            })
          }}
        >
          <FaGoogle className="text-lg" />
          Sign In with Google
        </Button>
      </div>
    </div>
  )
}
