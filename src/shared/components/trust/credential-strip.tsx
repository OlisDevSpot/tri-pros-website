import { buildCredentials } from '@/shared/components/trust/lib/build-credentials'
import { cn } from '@/shared/lib/utils'

/**
 * Trust credential row — left-aligned, single-line items separated by air (not
 * borders), each led by a brand-blue diamond (geometric DNA). Nunito 600, one
 * size: nothing orphan-wraps. Facts come from company constants. Spec §7.
 */
export function CredentialStrip({ className }: { className?: string }) {
  const credentials = buildCredentials()
  return (
    <div className={cn('flex flex-wrap items-center border-t pt-4', className)} style={{ columnGap: 'var(--cred-gap)', rowGap: '10px' }}>
      {credentials.map(c => (
        <span key={c.label} className="inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold" style={{ color: 'var(--cred-ink)' }}>
          <span className="size-[7px] shrink-0 rotate-45 rounded-[1px]" style={{ background: 'var(--primary)' }} />
          {c.label}
        </span>
      ))}
    </div>
  )
}
