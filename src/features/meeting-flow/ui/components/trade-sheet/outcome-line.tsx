interface OutcomeLineProps {
  text?: string
}

/** The playbook's outcome line. Trades without one render nothing; no line is invented. */
export function OutcomeLine({ text }: OutcomeLineProps) {
  if (!text) {
    return null
  }
  return <p className="border-l-2 border-primary pl-3 text-base leading-relaxed text-balance">{text}</p>
}
