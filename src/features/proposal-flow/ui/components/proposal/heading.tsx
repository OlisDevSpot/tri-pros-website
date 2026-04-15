import { CalendarIcon, PencilIcon, UserIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { CustomerProfileModal } from '@/features/customer-pipelines/ui/components'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { Logo } from '@/shared/components/logo'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { formatStringAsDate } from '@/shared/lib/formatters'

export function Heading() {
  const proposal = useCurrentProposal()
  const ability = useAbility()
  const { open: openModal, setModal } = useModalStore()

  if (proposal.isLoading) {
    return <div>Loading...</div>
  }

  if (!proposal.data) {
    return null
  }

  function handleViewProfile(customerId: string | undefined) {
    if (!customerId) {
      return
    }
    setModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId },
    })
    openModal()
  }

  const { sow } = proposal.data.projectJSON.data
  const customerName = proposal.data.customer?.name ?? 'Customer'

  const firstName = customerName.split(' ')[0]
  const firstTrade = sow[0]?.trade.label

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col justify-between items-center gap-6"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <Badge
          variant="secondary"
          className="text-xs font-semibold uppercase tracking-widest"
        >
          Your Proposal Is Ready
        </Badge>
        <h1 className="text-3xl lg:text-5xl font-bold -ml-6">
          👋
          Hi
          {' '}
          {firstName}
          ,
        </h1>
        {firstTrade && (
          <p className="text-muted-foreground max-w-md">
            We put together a complete picture of your
            {firstTrade && (
              <>
                {' '}
                {firstTrade.toLowerCase()}
              </>
            )}
            {' '}
            project
            {sow.length > 1 && ' & additional scopes'}
            . Here&apos;s everything we prepared for you.
          </p>
        )}
      </div>
      <div className="flex flex-col lg:flex-row gap-2 lg:gap-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <CalendarIcon size={20} className="" />
          <p>{formatStringAsDate(proposal.data.createdAt, { hour: undefined, minute: undefined })}</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Logo variant="icon" className="size-5" />
          <p>{companyInfo.name}</p>
        </div>
        {ability.can('read', 'Customer') && proposal.data.customer?.id && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewProfile(proposal.data?.customer?.id)}
            >
              <UserIcon className="size-4" />
              {`View ${customerName}'s Profile`}
            </Button>
          </div>
        )}
        {ability.can('update', 'Proposal') && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href={ROOTS.dashboard.proposals.byId(proposal.data.id)}>
                <PencilIcon className="size-4" />
                Edit Proposal
              </a>
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
