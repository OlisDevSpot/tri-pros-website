'use client'

import type { BrandFormValues } from '@/features/agent-settings/schemas/profile-form'
import type { AgentSettingsProfile } from '@/features/agent-settings/types'
import type { AgentProfile } from '@/shared/entities/users/schemas'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { SaveIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { languageOptions } from '@/features/agent-settings/constants/languages'
import { brandFormSchema } from '@/features/agent-settings/schemas/profile-form'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

interface CustomerBrandSectionProps {
  profile: AgentSettingsProfile
}

export function CustomerBrandSection({ profile }: CustomerBrandSectionProps) {
  const trpc = useTRPC()
  const { invalidateAgentSettings } = useInvalidation()
  const agentProfile = profile.agentProfileJSON as AgentProfile | null

  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      quote: agentProfile?.quote ?? '',
      bio: agentProfile?.bio ?? '',
      yearsOfExperience: agentProfile?.yearsOfExperience ?? undefined,
      tradeSpecialties: agentProfile?.tradeSpecialties ?? [],
      languagesSpoken: agentProfile?.languagesSpoken ?? [],
      certifications: agentProfile?.certifications ?? [],
    },
  })

  const updateMutation = useMutation(
    trpc.agentSettingsRouter.updateProfile.mutationOptions({
      onSuccess: () => {
        invalidateAgentSettings()
        toast.success('Brand profile updated')
      },
      onError: () => {
        toast.error('Failed to update brand profile')
      },
    }),
  )

  function onSubmit(values: BrandFormValues) {
    const existingProfile = (profile.agentProfileJSON as AgentProfile | null) ?? {}
    updateMutation.mutate({
      agentProfileJSON: { ...existingProfile, ...values },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer-Facing Brand</CardTitle>
        <CardDescription>This information appears on proposals sent to customers.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Quote / Tagline</FormLabel>
                  <FormControl>
                    <Input placeholder="Building trust, one home at a time." maxLength={200} {...field} />
                  </FormControl>
                  <FormDescription>Max 200 characters. Appears on your proposal header.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>My Story</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Tell customers about yourself..." rows={5} maxLength={1000} {...field} />
                  </FormControl>
                  <FormDescription>Max 1000 characters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="yearsOfExperience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Years of Experience</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      placeholder="10"
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="languagesSpoken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Languages Spoken</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {languageOptions.map((lang) => {
                        const isSelected = field.value?.includes(lang) ?? false
                        return (
                          <Button
                            key={lang}
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              const current = field.value ?? []
                              field.onChange(
                                isSelected ? current.filter(l => l !== lang) : [...current, lang],
                              )
                            }}
                          >
                            {lang}
                          </Button>
                        )
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="certifications"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Certifications</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Type a certification and press Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const input = e.currentTarget
                          const value = input.value.trim()
                          if (value && !(field.value ?? []).includes(value)) {
                            field.onChange([...(field.value ?? []), value])
                            input.value = ''
                          }
                        }
                      }}
                    />
                  </FormControl>
                  {(field.value ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(field.value ?? []).map(cert => (
                        <Button
                          key={cert}
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => field.onChange((field.value ?? []).filter(c => c !== cert))}
                        >
                          {cert}
                          {' '}
                          &times;
                        </Button>
                      ))}
                    </div>
                  )}
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
