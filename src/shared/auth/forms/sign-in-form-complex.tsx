'use client'

import type { LoginFormSchema } from '@/shared/auth/schemas/auth-schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { FaHubspot } from 'react-icons/fa6'

import { loginFormSchema } from '@/shared/auth/schemas/auth-schemas'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { PasswordInput } from '@/shared/components/ui/password-input'
import { cn } from '@/shared/lib/utils'
import { oauth2 } from '../client'

interface Props extends React.ComponentProps<'div'> {
  onSubmitCallback: (data: LoginFormSchema) => Promise<void>
  isPending?: boolean
}

export function SignInFormComplex({
  className,
  onSubmitCallback,
  isPending = false,
  ...props
}: Props) {
  const form = useForm<LoginFormSchema>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  return (
    <div className="w-full max-w-sm lg:max-w-3xl">
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <Card className="overflow-hidden p-0 w-full">
          <CardContent className="grid p-0">
            <Form {...form}>
              <form className="p-6 md:p-8" onSubmit={form.handleSubmit(onSubmitCallback)}>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col items-center text-center">
                    <h1 className="text-2xl font-bold">Welcome back</h1>
                    <p className="text-muted-foreground text-balance">
                      Login to your Tri Pros account
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="johndoe@example.com" disabled={isPending} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center">
                          <FormLabel htmlFor="password">Password</FormLabel>
                          <a
                            href="#"
                            className="ml-auto text-sm underline-offset-2 hover:underline"
                          >
                            Forgot your password?
                          </a>
                        </div>
                        <FormControl>
                          <PasswordInput
                            disabled={isPending}
                            {...field}
                            placeholder="********"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isPending}>
                    Login
                  </Button>
                  <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                    <span className="bg-card text-muted-foreground relative z-10 px-2">
                      Or continue with
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full"
                      disabled={isPending}
                      onClick={async () => {
                        await oauth2.link({
                          providerId: 'hubspot',
                          // eslint-disable-next-line node/prefer-global/process
                          callbackURL: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/oauth2/callback/hubspot`,
                        })
                      }}
                    >
                      <FaHubspot size="24" />
                      <span className="">Login with Hubspot</span>
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full"
                      disabled={isPending}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path
                          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="">Login with Google</span>
                    </Button>
                  </div>
                  <div className="text-center text-sm">
                    Don&apos;t have an account?
                    {' '}
                    <Link href="/auth/sign-up" className="underline underline-offset-4">
                      Sign up
                    </Link>
                  </div>
                </div>
              </form>
            </Form>
            <div className="bg-muted relative hidden md:block">
              <img
                src="/modern-house-1.png"
                alt="Image"
                className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
              />
            </div>
          </CardContent>
        </Card>
        <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
          By clicking continue, you agree to our
          {' '}
          <a href="#">Terms of Service</a>
          {' '}
          and
          {' '}
          <a href="#">Privacy Policy</a>
          .
        </div>
      </div>
    </div>
  )
}
