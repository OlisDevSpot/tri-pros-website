export function ReportSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the report" className="flex flex-col gap-(--gutter)">
      <div className="h-20 rounded-xl border border-border bg-card shadow-sm motion-safe:animate-pulse" />
      <div className="grid gap-(--gutter) lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="h-64 rounded-xl border border-border bg-card shadow-sm motion-safe:animate-pulse" />
        <div className="h-64 rounded-xl border border-border bg-card shadow-sm motion-safe:animate-pulse" />
      </div>
      <div className="h-72 rounded-xl border border-border bg-card shadow-sm motion-safe:animate-pulse" />
    </div>
  )
}
