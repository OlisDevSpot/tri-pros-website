'use client'

import type { ProjectFormData } from '@/shared/entities/projects/schemas'
import { useFormContext } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Textarea } from '@/shared/components/ui/textarea'

export function StoryContentFields() {
  const form = useFormContext<ProjectFormData>()

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <div className="flex flex-col gap-4">
          <FormField
            name="backstory"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Backstory</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell the story behind this project..."
                    rows={4}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="challengeDescription"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Challenge</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What challenges did this project present?"
                    rows={4}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="solutionDescription"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Solution</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="How did we solve these challenges?"
                    rows={4}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="resultDescription"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Result</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What was the outcome?"
                    rows={4}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Timeline Phase Descriptions</h3>
        <p className="text-xs text-muted-foreground -mt-4">Optional captions shown under each phase in the project timeline carousel.</p>
        <div className="flex flex-col gap-4">
          <FormField
            name="beforeDescription"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Before</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='e.g. "The original backyard was waiting to unleash its potential"'
                    rows={2}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="duringDescription"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>During</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='e.g. "Our team transforming the space, one step at a time"'
                    rows={2}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="afterDescription"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>After</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='e.g. "The finished result — a backyard built for living"'
                    rows={2}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="mainDescription"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gallery</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='e.g. "Additional angles and details from the project"'
                    rows={2}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </section>
  )
}
