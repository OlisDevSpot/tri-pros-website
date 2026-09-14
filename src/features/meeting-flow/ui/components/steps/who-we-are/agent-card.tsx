import type { PresentationAgent } from '@/features/meeting-flow/types'
import { HardHatIcon, MailIcon, PhoneIcon } from 'lucide-react'
import Image from 'next/image'
import { ContactLine } from '@/features/meeting-flow/ui/components/steps/who-we-are/contact-line'
import { companyInfo } from '@/shared/constants/company'
import { formatPhone } from '@/shared/lib/phone'

interface AgentCardProps {
  agent: PresentationAgent
  /** The agent's role for this homeowner, e.g. "Your point of contact". */
  role: string
}

/**
 * The agent's business card laid on the desk: photo, name, role, and the contact
 * lines the agent's profile has filled in. Unset lines are left off the card.
 */
export function AgentCard({ agent, role }: AgentCardProps) {
  return (
    <div
      className="flex max-h-full w-full max-w-[80cqw] -rotate-1 overflow-hidden bg-white text-(--presentation-ground) shadow-2xl shadow-black/60 lg:max-w-[48cqw]"
      style={{ aspectRatio: '7 / 4' }}
    >
      {agent.image && (
        <div className="relative aspect-[3/4] h-full shrink-0">
          <Image alt={agent.name} className="object-cover object-top" draggable={false} fill sizes="(min-width: 1024px) 16vw, 30vw" src={agent.image} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-[1.5cqh] p-[3cqw] lg:p-[1.8cqw]">
        <div className="grid gap-[0.4cqh]">
          <p className="font-sans text-[4.4cqw] leading-tight font-semibold tracking-tight text-balance lg:text-[2.4cqw]">{agent.name}</p>
          <p className="text-[max(2.2cqw,0.75rem)] text-(--presentation-ground)/65 lg:text-[max(1.2cqw,0.75rem)]">
            {role}
            {' · '}
            {companyInfo.name}
          </p>
        </div>
        <dl className="grid gap-[0.8cqh] text-[max(2.3cqw,0.8125rem)] lg:text-[max(1.25cqw,0.8125rem)]">
          {agent.phone && <ContactLine icon={PhoneIcon} label="Phone" value={formatPhone(agent.phone)} />}
          <ContactLine icon={MailIcon} label="Email" value={agent.email} />
          {agent.yearsOfExperience !== null && (
            <ContactLine icon={HardHatIcon} label="Experience" value={`${agent.yearsOfExperience} years in construction`} />
          )}
        </dl>
      </div>
    </div>
  )
}
