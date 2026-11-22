'use client'

import type { LoginFormSchema } from '@/shared/domains/auth/schemas'
import { FcGoogle } from 'react-icons/fc'

import { Button } from '@/shared/components/ui/button'
import { APP_HOSTS, ROOTS } from '@/shared/config/roots'
import { signIn } from '@/shared/domains/auth/client'

const TUNNEL_HOSTS: readonly string[] = APP_HOSTS.tunnel

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
        // The tunnel has its own redirect URI in Google, so it signs in directly. Relayed
        // through production, the hand-back lands on https://localhost:PORT
        // (ERR_SSL_PROTOCOL_ERROR): the dev server sees its own host, not the tunnel's.
        // better-auth's x-skip-oauth-proxy header is undocumented; if an upgrade drops it,
        // that error comes back.
        const isTunnel = TUNNEL_HOSTS.includes(window.location.host)
        await signIn.social({
          provider: 'google',
          callbackURL,
          errorCallbackURL: callbackURL,
          fetchOptions: isTunnel ? { headers: { 'x-skip-oauth-proxy': '1' } } : undefined,
        })
      }}
    >
      <FcGoogle className="size-5" />
      Sign in with Google
    </Button>
  )
}
