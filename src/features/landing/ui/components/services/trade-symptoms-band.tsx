interface TradeSymptomsBandProps {
  symptoms: string[]
}

export function TradeSymptomsBand({ symptoms }: TradeSymptomsBandProps) {
  if (symptoms.length === 0) {
    return null
  }

  return (
    <section className="bg-amber-50 border-y border-amber-200 py-6">
      <div className="container">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700 mb-4">
          😓 Sound familiar?
        </p>
        <div className="flex flex-wrap gap-2">
          {symptoms.map(symptom => (
            <span
              key={symptom}
              className="px-3 py-1.5 rounded-full bg-white border border-amber-200 text-xs font-semibold text-amber-900"
            >
              {symptom}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
