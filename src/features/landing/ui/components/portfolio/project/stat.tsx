interface Props {
  label: string
  value: string
}

export function Stat({ label, value }: Props) {
  return (
    <div className="bg-muted/40 rounded-xl p-5 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className="text-foreground font-semibold text-lg">{value}</p>
    </div>
  )
}
