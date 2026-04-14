'use client'

import type { IdentityFormValues } from '@/features/agent-settings/schemas/profile-form'
import type { AgentSettingsProfile } from '@/features/agent-settings/types'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { SaveIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { identityFormSchema } from '@/features/agent-settings/schemas/profile-form'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

interface IdentityContactSectionProps {
  profile: AgentSettingsProfile
}

export function IdentityContactSection({ profile }: IdentityContactSectionProps) {
  const trpc = useTRPC()
  const { invalidateAgentSettings } = useInvalidation()

  const form = useForm<IdentityFormValues>({
    resolver: zodResolver(identityFormSchema),
    defaultValues: {
      phone: profile.phone ?? '',
      birthdate: profile.birthdate ?? '',
      startDate: profile.startDate ?? '',
      funFact: profile.funFact ?? '',
    },
  })

  const updateMutation = useMutation(
    trpc.agentSettingsRouter.updateProfile.mutationOptions({
      onSuccess: () => {
        invalidateAgentSettings()
        toast.success('Profile updated')
      },
      onError: () => {
        toast.error('Failed to update profile')
      },
    }),
  )

  function onSubmit(values: IdentityFormValues) {
    updateMutation.mutate({
      phone: values.phone || null,
      birthdate: values.birthdate || null,
      startDate: values.startDate || null,
      funFact: values.funFact || null,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identity & Contact</CardTitle>
        <CardDescription>Personal information and contact details.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="(555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="birthdate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Birthdate</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date at Tri Pros</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="funFact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fun Fact / Hobby</FormLabel>
                  <FormControl>
                    <Input placeholder="I restore vintage motorcycles on weekends" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="sm" disabled={updateMutation.isPending}>
              <SaveIcon className="size-4" />
              Save
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
