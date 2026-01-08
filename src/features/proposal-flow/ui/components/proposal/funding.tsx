import { motion } from 'motion/react'
import { useQueryState } from 'nuqs'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { financingOptions } from '@/shared/constants/financing-options'
import { useUpdateProposal } from '@/shared/dal/client/proposals/mutations/use-update-proposal'
import { getLoanValues } from '@/shared/lib/loan-calculations'
import { cn } from '@/shared/lib/utils'

interface Props {
  onPickFinancingOption?: (option: typeof financingOptions[keyof typeof financingOptions][number]) => void
}

export function Funding({ onPickFinancingOption }: Props) {
  const proposal = useCurrentProposal()
  const [cashInDeal, setCashInDeal] = useState<number | null>(null)
  const [token] = useQueryState('token', { defaultValue: '' })

  const updateProposal = useUpdateProposal()

  useEffect(() => {
    if (proposal.data && cashInDeal === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks-extra/no-direct-set-state-in-use-effect
      setCashInDeal(proposal.data.cashInDeal)
    }
  }, [proposal.data, cashInDeal])

  const amountFinanced = useMemo(() => {
    if (!proposal.data || cashInDeal === null) {
      return 0
    }

    return proposal.data?.tcp - cashInDeal
  }, [cashInDeal, proposal.data])

  function pickFinancingOption(option: typeof financingOptions[keyof typeof financingOptions][number]) {
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

  if (!proposal.data) {
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
                      {cashInDeal !== proposal.data.cashInDeal && (
                        <Button
                          size="sm"
                          onClick={() => {
                            updateProposal.mutate({
                              token,
                              proposalId: proposal.data.id,
                              data: {
                                cashInDeal: cashInDeal || 0,
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
                      {financingOptions['360Finance'].map(option => (
                        <button
                          key={`${financingOptions['360Finance']}-${option.rate}`}
                          className={
                            cn(
                              'p-4 border rounded-xl w-full flex items-center justify-between disabled:text-muted-foreground disabled:cursor-not-allowed disabled:opacity/50',
                              option.id === proposal.data.financeOptionId && 'bg-primary/20',
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
                              {option.term / 12}
                              {' '}
                              years
                            </p>
                            <span className="block text-muted-foreground text-sm">
                              {option.term}
                              {' '}
                              months
                            </span>
                            <span className="block text-muted-foreground text-sm">
                              {option.rate * 100}
                              % APR
                            </span>
                          </div>
                          <div className="flex gap-1 items-center flex-wrap text-end w-fit">
                            <p className="shrink-0">
                              {getLoanValues(amountFinanced, option.rate, option.term).monthlyFormatted}
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
            <TabsContent value="consolidate">
              <div>
                <div>
                  <h3 className="text-lg font-semibold">Consolidate</h3>
                  <p className="text-muted-foreground">
                    Some lenders may request a minimum monthly investment.
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
