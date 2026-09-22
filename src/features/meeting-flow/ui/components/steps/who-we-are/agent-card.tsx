import type { PresentationAgent } from '@/features/meeting-flow/types'
import LogoDarkIcon from '@public/company/logo/logo-dark.svg'
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
 * The agent's business card on the desk: headshot, or the brand mark when there is none;
 * name, role and the contact lines the agent's profile has filled in. The card sizes to its
 * content (U10) and sits square: tilted type blurs on low-DPI screens (U13).
 */
export function AgentCard({ agent, role }: AgentCardProps) {
  return (
    <div className="flex w-fit max-w-full overflow-hidden bg-white text-(--presentation-ground) shadow-2xl shadow-black/60">
      <div className="relative w-[clamp(6rem,11cqw,10rem)] shrink-0 bg-(--presentation-ground)">
        {agent.image
          ? <Image alt={agent.name} className="object-cover object-top" draggable={false} fill sizes="10rem" src={agent.image} />
          : <Image alt="" className="object-contain p-[18%]" draggable={false} fill src={LogoDarkIcon} />}
      </div>
      <div className="grid min-w-0 content-between gap-presentation-group p-presentation-group">
        <div className="grid gap-1">
          <p className="font-sans text-presentation-lead leading-tight font-semibold tracking-tight text-balance">{agent.name}</p>
          <p className="text-presentation-label text-(--presentation-ground)/70">
            {role}
            {' · '}
            {companyInfo.name}
          </p>
        </div>
        <dl className="grid gap-presentation-tight text-presentation-body">
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
