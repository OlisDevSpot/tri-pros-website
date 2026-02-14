import type { ProposalFormValues } from '@/features/proposal-flow/schemas/form-schema'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Tiptap } from '@/shared/components/tiptap/tiptap'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { MultiSelect, MultiSelectContent, MultiSelectGroup, MultiSelectItem, MultiSelectTrigger, MultiSelectValue } from '@/shared/components/ui/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { scopesData } from '@/shared/db/seeds/data/scopes'
import { tradesData } from '@/shared/db/seeds/data/trades'

export function ProjectFields() {
  const form = useFormContext<ProposalFormValues>()

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: `project.scopes`,
  })

  const currentScopes = useWatch({
    control: form.control,
    name: `project.scopes`,
  })

  function getScopesOfTrade(tradeAccessor: ProposalFormValues['project']['scopes'][0]['trade']) {
    if (!tradeAccessor) {
      return []
    }

    const scopes = scopesData[tradeAccessor] || []
    return scopes
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 flex-wrap w-full">
            <FormField
              name="project.address"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address *</FormLabel>
                  <FormControl>
                    <Input placeholder="123 ABC Street" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="project.city"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City *</FormLabel>
                  <FormControl>
                    <Input placeholder="Tarzana" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="project.state"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State *</FormLabel>
                  <FormControl>
                    <Input placeholder="CA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="project.zipCode"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zip *</FormLabel>
                  <FormControl>
                    <Input placeholder="91335" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <FormField
              name="project.projectType"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Type</FormLabel>
                  <FormControl>
                    <Select defaultValue="general-remodeling">
                      <SelectTrigger {...field} className="w-full">
                        <SelectValue placeholder="Select a project type" />
                      </SelectTrigger>
                      <SelectContent {...field}>
                        <SelectItem value="general-remodeling">
                          General Remodeling
                        </SelectItem>
                        <SelectItem value="energy-efficient">
                          Energy Efficient
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="project.timeAllocated"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time Allocated</FormLabel>
                  <FormControl>
                    <Input placeholder="4-6 weeks" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex flex-col items-start gap-4 min-h-15 flex-wrap">
            <h3>Trades</h3>
            {fields.map((fieldOfArray, index) => (
              <div key={fieldOfArray.id} className="flex flex-col gap-4 items-center border w-full">
                <div className="flex items-end rounded-lg h-full w-full">
                  <FormField
                    control={form.control}
                    name={`project.scopes.${index}.trade`}
                    render={({ field }) => (
                      <FormItem className="max-w-62.5">
                        <FormControl className="w-full">
                          <Select
                            value={field.value}
                            onValueChange={(val) => {
                              field.onChange(val)
                              form.setValue(`project.scopes.${index}.scope`, [])
                            }}
                          >
                            <SelectTrigger
                              {...field}
                              className="w-full bg-transparent dark:bg-transparent border-0"
                            >
                              <SelectValue placeholder="Select a trade" />
                            </SelectTrigger>
                            <SelectContent {...field}>
                              {tradesData.map(trade => (
                                <SelectItem key={trade.accessor} value={trade.accessor}>
                                  {trade.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`project.scopes.${index}.scope`}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <MultiSelect
                          onValuesChange={field.onChange}
                          values={field.value}
                        >
                          <FormControl>
                            <MultiSelectTrigger className="w-full" disabled={currentScopes[index]?.trade === undefined}>
                              <MultiSelectValue placeholder="Select scopes..." />
                            </MultiSelectTrigger>
                          </FormControl>
                          <MultiSelectContent
                            search={{
                              emptyMessage: 'No scopes found',
                              placeholder: 'Search scopes...',
                            }}
                          >
                            <MultiSelectGroup>
                              {getScopesOfTrade(currentScopes[index]?.trade).map(scope => (
                                <MultiSelectItem key={scope.accessor} value={scope.accessor}>
                                  {scope.label}
                                </MultiSelectItem>
                              ))}
                            </MultiSelectGroup>
                          </MultiSelectContent>
                        </MultiSelect>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-none"
                    onClick={() => remove(index)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
                <div className="w-full p-4 pt-0">
                  <FormField
                    name={`project.scopes.${index}.sow`}
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex gap-2 items-center">
                          <FormLabel>Scope of Work</FormLabel>
                          <Button
                            variant="outline"
                            type="button"
                            className="text-xs text-muted-foreground hover:underline"
                            size="sm"
                          >
                            Templates
                          </Button>
                        </div>
                        <FormControl>
                          {/* <Textarea
                            {...field}
                            placeholder="Tri Pros Remodeling will..."
                            className="min-h-[250px]"
                          /> */}
                          <Tiptap
                            onChange={html => field.onChange(html)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => append({ scope: [] })}
            >
              <PlusIcon />
            </Button>
          </div>
          <FormField
            name="project.agreementNotes"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <div className="flex gap-2 items-center">
                  <FormLabel>Agreement Notes</FormLabel>
                  <Button
                    variant="outline"
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    size="sm"
                  >
                    Templates
                  </Button>
                </div>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value || ''}
                    placeholder="Tri Pros Remodeling will..."
                    className="min-h-62.5"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* <FormField
            name="project.startDate"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input placeholder="1/1/2030" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="project.completionDate"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Completion Date</FormLabel>
                <FormControl>
                  <Input placeholder="1/30/2030" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          /> */}
        </div>
      </div>
    </section>
  )
}
