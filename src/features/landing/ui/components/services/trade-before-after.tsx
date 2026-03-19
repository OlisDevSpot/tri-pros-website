interface TradeBeforeAfterProps {
  before: string[]
  after: string[]
}

export function TradeBeforeAfter({ before, after }: TradeBeforeAfterProps) {
  if (before.length === 0) {
    return null
  }

  return (
    <section className="container py-10">
      <div className="rounded-lg border bg-background overflow-hidden">
        <div className="grid sm:grid-cols-2">
          <div className="p-6 bg-destructive/5">
            <p className="text-xs font-semibold uppercase tracking-widest text-destructive/70 mb-4">
              😓 Right now
            </p>
            <ul className="space-y-2">
              {before.map(item => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-destructive/60 mt-0.5" aria-hidden="true">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-6 bg-primary/5 border-t sm:border-t-0 sm:border-l border-border">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-4">
              ✅ After Tri Pros
            </p>
            <ul className="space-y-2">
              {after.map(item => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="text-primary mt-0.5" aria-hidden="true">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
