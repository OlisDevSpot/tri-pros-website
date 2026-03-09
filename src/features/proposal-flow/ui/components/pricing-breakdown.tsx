import type { InsertProposalSchema } from '@/shared/db/schema'
import { CheckIcon } from 'lucide-react'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

export function PricingBreakdown({ proposalData }: { proposalData: InsertProposalSchema }) {
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
                  <div key={`${section.title || i}}`} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{section.title || `Section ${i + 1}`}</span>
                    <span>{formatAsDollars(section.price!)}</span>
                  </div>
                ))}
                {(miscPrice ?? 0) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Misc</span>
                    <span>{formatAsDollars(miscPrice!)}</span>
                  </div>
                )}
              </>
            )
          : (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Contract Price</span>
                <span>{formatAsDollars(startingTcp)}</span>
              </div>
            )}
      </div>

      {pricingMode === 'breakdown' && (
        <div className="border-t border-border/40 px-5 py-3 flex items-center justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatAsDollars(startingTcp)}</span>
        </div>
      )}

      {incentives.length > 0 && (
        <>
          <div className="border-t border-border/40" />
          <div className="px-5 py-4 space-y-2.5 text-emerald-700 dark:text-emerald-400">
            {incentives.map((incentive, i) => {
              if (incentive.type === 'discount') {
                return (
                  <div key={`discount-${incentive.notes ?? i}`} className="flex items-center justify-between">
                    <span>{incentive.notes || 'Discount'}</span>
                    <span className="font-medium">
                      -
                      {formatAsDollars(incentive.amount)}
                    </span>
                  </div>
                )
              }
              return (
                <div key={`offer-${incentive.offer ?? i}`} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="">{incentive.offer || 'Exclusive Offer'}</span>
                    {incentive.notes && (
                      <span className="mx-2 flex items-center gap-2">
                        {' '}
                        -
                        <p className="text-muted-foreground text-xs">{incentive.notes}</p>
                      </span>
                    )}
                  </div>
                  <span className="font-medium flex items-center gap-1">
                    <CheckIcon className="w-3.5 h-3.5" />
                    Included
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className={cn(
        'border-t border-border/40 bg-muted/30 px-5 py-4 flex items-center justify-between',
        incentives.length === 0 && pricingMode === 'total' && 'border-t-0',
      )}
      >
        <span className="font-semibold">Final Contract Price</span>
        <span className="font-semibold text-base">{formatAsDollars(finalTcp)}</span>
      </div>
    </div>
  )
}
