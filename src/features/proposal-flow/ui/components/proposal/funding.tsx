import type { FinanceOption } from '@/shared/db/schema'
import { CheckIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useQueryState } from 'nuqs'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useGetFinanceOptions } from '@/shared/dal/client/finance-options/queries/use-get-finance-options'
import { useUpdateProposal } from '@/shared/dal/client/proposals/mutations/use-update-proposal'
import { getLoanValues } from '@/shared/lib/loan-calculations'
import { cn } from '@/shared/lib/utils'

function fmt(n: number) {
  return n.toLocaleString('en-US', { currency: 'USD', maximumFractionDigits: 0, style: 'currency' })
}

type ProposalData = NonNullable<ReturnType<typeof useCurrentProposal>['data']>

function PricingBreakdown({ proposalData }: { proposalData: ProposalData }) {
  const { pricingMode } = proposalData.formMetaJSON
  const sow = proposalData.projectJSON.data.sow
  const { finalTcp, incentives, miscPrice, startingTcp } = proposalData.fundingJSON.data

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden text-sm">
      <div className="px-5 py-4 space-y-2.5">
        {pricingMode === 'breakdown'
          ? (
              <>
                {sow.filter(s => (s.price ?? 0) > 0).map((section, i) => (
                  <div key={section.trade.id || section.title || i} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{section.title || `Section ${i + 1}`}</span>
                    <span>{fmt(section.price!)}</span>
                  </div>
                ))}
                {(miscPrice ?? 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Misc</span>
                    <span>{fmt(miscPrice!)}</span>
                  </div>
                )}
              </>
            )
          : (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Contract Price</span>
                <span>{fmt(startingTcp)}</span>
              </div>
            )}
      </div>

      {pricingMode === 'breakdown' && (
        <div className="border-t border-border/40 px-5 py-3 flex items-center justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{fmt(startingTcp)}</span>
        </div>
      )}

      {incentives.length > 0 && (
        <>
          <div className="border-t border-border/40" />
          <div className="px-5 py-4 space-y-2.5">
            {incentives.map((incentive, i) => {
              if (incentive.type === 'discount') {
                return (
                  <div key={`discount-${incentive.notes ?? i}`} className="flex items-center justify-between">
                    <span className="text-rose-500">{incentive.notes || 'Discount'}</span>
                    <span className="font-medium text-rose-500">
                      -
                      {fmt(incentive.amount)}
                    </span>
                  </div>
                )
              }
              return (
                <div key={`offer-${incentive.offer ?? i}`} className="flex items-center justify-between">
                  <span className="text-violet-500">{incentive.offer || 'Exclusive Offer'}</span>
                  <span className="font-medium text-violet-500 flex items-center gap-1">
                    <CheckIcon className="w-3.5 h-3.5" />
                    Included
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className={cn('border-t border-border/40 bg-muted/30 px-5 py-4 flex items-center justify-between', incentives.length === 0 && pricingMode === 'total' && 'border-t-0')}>
        <span className="font-semibold">Final Contract Price</span>
        <span className="font-semibold text-base">{fmt(finalTcp)}</span>
      </div>
    </div>
  )
}

interface Props {
  onPickFinancingOption?: (option: FinanceOption) => void
}

export function Funding({ onPickFinancingOption }: Props) {
  const proposal = useCurrentProposal()
  const [cashInDeal, setCashInDeal] = useState<number | null>(null)
  const [token] = useQueryState('token', { defaultValue: '' })

  const updateProposal = useUpdateProposal()
  const financeOptions = useGetFinanceOptions()

  useEffect(() => {
    if (proposal.data && cashInDeal === null) {
      const tcp = proposal.data.fundingJSON.data.finalTcp || 0
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setCashInDeal(proposal.data.fundingJSON.data.cashInDeal ?? tcp)
    }
  }, [proposal.data, cashInDeal])

  const amountFinanced = useMemo(() => {
    if (!proposal.data || cashInDeal === null) {
      return 0
    }

    return proposal.data.fundingJSON.data.finalTcp - cashInDeal
  }, [cashInDeal, proposal.data])

  function pickFinancingOption(option: FinanceOption) {
    if (!proposal.data) {
      return
    }

    onPickFinancingOption?.(option)
    updateProposal.mutate({
      token,
      proposalId: proposal.data.id,
      data: {
        financeOptionId: option.id,
      },
    }, {
      onSuccess: () => {
        toast.success('Financing option updated')
      },
    })
  }

  if (proposal.isPending) {
    return (
      <LoadingState
        title="Loading Proposal"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  const proposalData = proposal.data

  if (!proposalData) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Card>
        <CardHeader className="text-center md:text-start">
          <CardTitle>
            <h2>Funding Summary</h2>
          </CardTitle>
          <CardDescription>Home improvement, at your own terms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <PricingBreakdown proposalData={proposalData} />
          <Tabs defaultValue="cash" className="space-y-8">
            <TabsList className="mx-auto md:mx-0">
              <TabsTrigger value="cash">Cash / cash + finance</TabsTrigger>
              <TabsTrigger value="consolidate">Consolidate</TabsTrigger>
            </TabsList>
            { financeOptions.data && (
              <TabsContent value="cash">
                <div className="space-y-8">
                  <div className="text-center md:text-start">
                    <h3 className="text-lg font-semibold">Cash / cash + finance</h3>
                    <p className="text-muted-foreground">
                      Some lenders may request a minimum cash investement.
                    </p>
                  </div>
                  <div className="p-6 border rounded-xl flex flex-col lg:flex-row gap-6">
                    <div className="space-y-4 flex-1">
                      <h3 className="text-lg font-semibold">Upfront Costs</h3>
                      <div className="space-y-2">
                        <Label>Cash down *</Label>
                        <Input
                          type="text"
                          placeholder="Cash Down"
                          value={cashInDeal?.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            maximumFractionDigits: 0,
                          }) || ''}
                          onChange={(e) => {
                            setCashInDeal(Number(e.target.value.replace(/\D/g, '').replace(/\$/g, '')))
                          }}
                          disabled={updateProposal.isPending}
                        />
                        {cashInDeal !== proposalData.fundingJSON.data.cashInDeal && (
                          <Button
                            size="sm"
                            onClick={() => {
                              updateProposal.mutate({
                                token,
                                proposalId: proposalData.id,
                                data: {
                                  fundingJSON: {
                                    ...proposalData.fundingJSON,
                                    data: {
                                      ...proposalData.fundingJSON.data,
                                      cashInDeal: cashInDeal || 0,
                                    },
                                  },
                                },
                              }, {
                                onSuccess: () => {
                                  toast.success('Cash in deal updated')
                                },
                              })
                            }}
                            disabled={updateProposal.isPending}
                          >
                            Save
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4 flex-1">
                      <h3 className="text-lg font-semibold">Financial Options</h3>
                      <div className="space-y-4">
                        {financeOptions.data.map(option => (
                          <button
                            key={`${option.id}-${option.interestRate}`}
                            className={
                              cn(
                                'p-4 border rounded-xl w-full flex items-center justify-between disabled:text-muted-foreground disabled:cursor-not-allowed disabled:opacity/50',
                                option.id === proposalData.financeOptionId && 'bg-primary/20',
                              )
                            }
                            type="button"
                            onClick={() => {
                              pickFinancingOption(option)
                            }}
                            disabled={updateProposal.isPending}
                          >
                            <div className="text-start h-fit space-y-1">
                              <p className="font-semibold">
                                {option.termInMonths / 12}
                                {' '}
                                years
                              </p>
                              <span className="block text-muted-foreground text-sm">
                                {option.termInMonths}
                                {' '}
                                months
                              </span>
                              <span className="block text-muted-foreground text-sm">
                                {Math.round(option.interestRate * 10000) / 100}
                                % APR
                              </span>
                            </div>
                            <div className="flex gap-1 items-center flex-wrap text-end w-fit">
                              <p className="shrink-0">
                                {getLoanValues(amountFinanced, option.interestRate, option.termInMonths).monthlyFormatted}
                              </p>
                              <span className="text-muted-foreground text-xs">/ month</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}
            <TabsContent value="consolidate">
              <div>
                <div>
                  <h3 className="text-lg font-semibold">Consolidate</h3>
                  <p className="text-muted-foreground">
                    Coming soon!
                  </p>
                </div>
                <div>
                  ConsolidationForm
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  )
}
