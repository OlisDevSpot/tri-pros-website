interface Props {
  step: number
  title: string
  children: React.ReactNode
}

export function StepSection({ step, title, children }: Props) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-xl border p-4">
      <h3 className="text-sm font-medium">
        <span className="mr-2 text-muted-foreground tabular-nums">{step}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}
