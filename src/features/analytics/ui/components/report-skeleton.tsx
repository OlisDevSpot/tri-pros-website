export function ReportSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the report" className="flex flex-col gap-(--gutter)">
      <div className="h-20 rounded-xl border border-border bg-card shadow-sm motion-safe:animate-pulse" />
      <div className="h-64 rounded-xl border border-border bg-card shadow-sm motion-safe:animate-pulse" />
      <div className="h-72 rounded-xl border border-border bg-card shadow-sm motion-safe:animate-pulse" />
    </div>
  )
}
