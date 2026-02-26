import type { FinanceOption } from '@/shared/db/schema'
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
      const tcp = proposal.data.fundingJSON.data.tcp || 0
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setCashInDeal(proposal.data.fundingJSON.data.cashInDeal ?? tcp)
    }
  }, [proposal.data, cashInDeal])

  const amountFinanced = useMemo(() => {
    if (!proposal.data || cashInDeal === null) {
      return 0
    }

    return proposal.data.fundingJSON.data.tcp - cashInDeal
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
        <CardHeader>
          <CardTitle>
            <h2>Funding Summary</h2>
          </CardTitle>
          <CardDescription>Home improvement, at your own terms</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <Tabs defaultValue="cash" className="space-y-8">
            <TabsList>
              <TabsTrigger value="cash">Cash / cash + finance</TabsTrigger>
              <TabsTrigger value="consolidate">Consolidate</TabsTrigger>
            </TabsList>
            { financeOptions.data && (
              <TabsContent value="cash">
                <div className="space-y-8">
                  <div>
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
