import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'

import { Check, Plus } from 'lucide-react'

import { Badge } from '@/shared/components/ui/badge'

const UNIT_LABELS: Record<string, string> = {
  'bsq': 'per bsq',
  'linear ft': 'per linear ft',
  'space': 'per space',
  'sqft': 'per sqft',
  'unit': 'per unit',
}

interface ScopesGridProps {
  scopes: ScopeOrAddon[]
}

export function ScopesGrid({ scopes }: ScopesGridProps) {
  if (scopes.length === 0) {
    return null
  }

  const primaryScopes = scopes.filter(s => s.entryType === 'Scope')
  const addons = scopes.filter(s => s.entryType === 'Addon')

  return (
    <section className="bg-muted/40 py-16 lg:py-24">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Services Included
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Every project is scoped to your home. Here's what we can cover.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
          {primaryScopes.map(scope => (
            <div
              key={scope.id}
              className="flex items-center justify-between gap-3 bg-background rounded-lg px-4 py-3 border"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Check className="size-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground truncate">{scope.name}</span>
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs text-muted-foreground">
                {UNIT_LABELS[scope.unitOfPricing] ?? `per ${scope.unitOfPricing}`}
              </Badge>
            </div>
          ))}
        </div>

        {addons.length > 0 && (
          <div className="mt-10">
            <h3 className="text-lg font-semibold text-foreground text-center mb-6 flex items-center justify-center gap-2">
              <Plus className="size-4" />
              Available Add-Ons
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {addons.map(addon => (
                <div
                  key={addon.id}
                  className="flex items-center justify-between gap-3 bg-background/60 rounded-lg px-4 py-3 border border-dashed"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Plus className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate">{addon.name}</span>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                    {UNIT_LABELS[addon.unitOfPricing] ?? `per ${addon.unitOfPricing}`}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
