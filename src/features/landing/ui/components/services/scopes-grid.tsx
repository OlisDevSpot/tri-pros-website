import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'

import { ScopeCard } from '@/features/landing/ui/components/services/scope-card'

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
    <section className="container py-16 lg:py-24">
      <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-12">
        What We Can Do
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {primaryScopes.map(scope => (
          <ScopeCard
            key={scope.id}
            name={scope.name}
            unitOfPricing={scope.unitOfPricing}
          />
        ))}
      </div>

      {addons.length > 0 && (
        <div className="mt-12">
          <h3 className="text-xl font-semibold text-foreground mb-6 text-center">
            Available Add-Ons
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {addons.map(addon => (
              <ScopeCard
                key={addon.id}
                name={addon.name}
                unitOfPricing={addon.unitOfPricing}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
