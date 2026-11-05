interface ThermalScaleBarProps {
  scale: { min: number, max: number }
  palette: readonly string[]
  unit: string
  ticks: number
}

export function ThermalScaleBar({ scale, palette, unit, ticks }: ThermalScaleBarProps) {
  const count = Math.max(ticks, 2)
  const values = Array.from({ length: count }, (_, index) => scale.max - ((scale.max - scale.min) * index) / (count - 1))
  // CSS gradients run top to bottom, so the hot end leads.
  const gradient = `linear-gradient(to bottom, ${[...palette].reverse().join(', ')})`

  return (
    <div className="flex h-full gap-2" role="img" aria-label={`Temperature scale, ${Math.round(scale.min)} to ${Math.round(scale.max)} ${unit}`}>
      <div className="w-2.5 rounded-full" style={{ backgroundImage: gradient }} />
      <div className="flex flex-col justify-between text-xs text-muted-foreground tabular-nums">
        {values.map(value => (
          <span key={value}>{`${Math.round(value)}${unit}`}</span>
        ))}
      </div>
    </div>
  )
}
