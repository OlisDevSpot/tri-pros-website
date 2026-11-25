import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext } from 'react-hook-form'
import { useSowCatalog } from '@/features/proposal-flow/hooks/use-sow-catalog'
import { sowPickerMessageId } from '@/features/proposal-flow/lib/sow-picker-message-id'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { cn } from '@/shared/lib/utils'
import { SowScopesPicker } from './sow-scopes-picker'
import { SowTradePicker } from './sow-trade-picker'

interface Props {
  index: number
  disabled: boolean
  messageBaseId: string
  // The messages render only in the open section; a closed one has nothing to point at.
  isOpen: boolean
  className?: string
}

export function SowHeaderPickers({ index, disabled, messageBaseId, isOpen, className }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const { allTrades, scopesOfTrade } = useSowCatalog(index)

  const [ScopeRemovalDialog, confirmScopeRemoval] = useConfirm({
    title: 'Remove cost lines?',
    message: 'Removing this scope will also remove cost lines tied to it. Continue?',
  })

  async function handleScopesChange(values: string[]): Promise<boolean> {
    const oldScopes = form.getValues(`project.data.sow.${index}.scopes`)
    const oldIds = new Set(oldScopes.map(s => s.id))
    const newIds = new Set(values)

    const removedIds: string[] = []
    for (const id of oldIds) {
      if (!newIds.has(id)) {
        removedIds.push(id)
      }
    }

    if (removedIds.length > 0) {
      const costLines = form.getValues(`project.data.sow.${index}.financials.costLines`)
      const orphans = costLines.filter(line => removedIds.includes(line.relatedScopeId))
      if (orphans.length > 0) {
        const confirmed = await confirmScopeRemoval()
        if (!confirmed) {
          return false
        }
        const remaining = costLines.filter(line => !removedIds.includes(line.relatedScopeId))
        form.setValue(`project.data.sow.${index}.financials.costLines`, remaining, { shouldDirty: true })
      }
    }

    const newScopesArray = values
      .map((scopeId) => {
        const scopeOfTrade = scopesOfTrade.data?.find(scope => scope.id === scopeId)
        if (!scopeOfTrade) {
          return null
        }
        return { id: scopeOfTrade.id, label: scopeOfTrade.name }
      })
      .filter((scope): scope is { id: string, label: string } => scope !== null)
    form.setValue(`project.data.sow.${index}.scopes`, newScopesArray, { shouldDirty: true })
    return true
  }

  async function handleTradeChange(val: string) {
    if (!val) {
      return
    }
    const proceeded = await handleScopesChange([])
    if (!proceeded) {
      return
    }
    form.setValue(`project.data.sow.${index}.trade.id`, val, { shouldDirty: true })
    form.setValue(
      `project.data.sow.${index}.trade.label`,
      allTrades.data?.find(trade => trade.id === val)?.name || '',
      { shouldDirty: true },
    )
  }

  return (
    // Inside the section's toggle: clicks here, and those bubbling up from the portaled menus and the confirm dialog,
    // stop before they reach it. relative: Radix Select's hidden native <select> is absolute and would otherwise
    // escape to <main> and make it scroll.
    <div className={cn('relative flex h-6 min-w-0 items-center gap-1.5', className)} onClick={e => e.stopPropagation()}>
      <ScopeRemovalDialog />
      <SowTradePicker
        index={index}
        disabled={disabled}
        messageId={isOpen ? sowPickerMessageId(messageBaseId, index, 'trade') : undefined}
        trades={allTrades.data}
        onTradeChange={handleTradeChange}
      />
      <span aria-hidden className="text-xs text-muted-foreground max-md:hidden">·</span>
      <SowScopesPicker
        index={index}
        disabled={disabled}
        messageId={isOpen ? sowPickerMessageId(messageBaseId, index, 'scopes') : undefined}
        options={scopesOfTrade.data}
        loading={scopesOfTrade.isLoading}
        onScopesChange={handleScopesChange}
      />
    </div>
  )
}
