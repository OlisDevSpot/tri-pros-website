'use client'

import Image from 'next/image'

import { SignInGoogleButton } from '@/shared/components/buttons/auth/sign-in-google-button'

export function DashboardSignIn() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <Image
          src="/company/logo/logo-light.svg"
          alt="Tri Pros Remodeling"
          width={48}
          height={48}
          className="dark:hidden"
        />
        <Image
          src="/company/logo/logo-dark.svg"
          alt="Tri Pros Remodeling"
          width={48}
          height={48}
          className="hidden dark:block"
        />
        <h1 className="text-2xl font-semibold tracking-tight">Agent Dashboard</h1>
        <p className="text-sm text-muted-foreground">Sign in to access the dashboard</p>
      </div>
      <SignInGoogleButton callbackURL="/dashboard" />
    </div>
  )
}
