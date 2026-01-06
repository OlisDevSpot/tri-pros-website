import type { Proposal } from '@/shared/db/schema'
import { CalendarIcon, MapPinIcon } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'
import { formatAddress, formatStringAsDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface Props {
  proposal: Proposal
}

const PROPOSAL_STATUS_COLORS: Record<Proposal['status'], string> = {
  draft: 'bg-neutral-700',
  sent: 'bg-yellow-800',
  approved: 'bg-green-800',
  declined: 'bg-red-800',
}

export function ProposalCard({ proposal }: Props) {
  const { address, city, state, zipCode } = proposal

  return (
    <Card className="flex-row">
      <CardHeader className="space-y-2 flex-1">
        <CardTitle>
          <div className="flex items-center gap-3">
            <h2>{proposal.label}</h2>
            <Badge className={cn(
              'h-fjt',
              PROPOSAL_STATUS_COLORS[proposal.status],
            )}
            >
              {proposal.status}
            </Badge>
          </div>
        </CardTitle>
        <CardDescription>
          <div className="space-y-2">
            <span className="flex gap-2">
              <MapPinIcon size={16} className="text-muted-foreground" />
              <p>
                {formatAddress(address, city, state, zipCode)}
              </p>
            </span>
            <span className="flex gap-2">
              <CalendarIcon size={16} className="text-muted-foreground" />
              <p>
                Date sent:
                {' '}
                {formatStringAsDate(proposal.createdAt)}
              </p>
            </span>
            <div className="flex gap-2">
              <Badge className="bg-yellow-800">{proposal.projectType}</Badge>
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="w-fit flex flex-col gap-2">
        <Button asChild>
          <Link href={`${ROOTS.proposalFlow()}/proposal/${proposal.id}`}>
            View Proposal
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`${ROOTS.proposalFlow()}/proposal/${proposal.id}`}>
            Edit Proposal
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
