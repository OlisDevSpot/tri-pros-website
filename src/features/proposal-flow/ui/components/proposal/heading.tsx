import { CalendarIcon, MapPinHouseIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { formatAddress, formatStringAsDate } from '@/shared/lib/formatters'

export function Heading() {
  const proposal = useCurrentProposal()

  if (proposal.isLoading) {
    return <div>Loading...</div>
  }

  if (!proposal.data) {
    return null
  }

  const { address, city, state, zipCode } = proposal.data

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col justify-between items-start lg:items-center gap-2"
    >
      <div>
        <h2 className="text-2xl lg:text-4xl">
          Proposal for
          {' '}
          {`${proposal.data.firstName} ${proposal.data.lastName}` || 'John Doe'}
        </h2>
      </div>
      <div className="flex flex-col lg:flex-row gap-2 lg:gap-6">
        <div className="flex items-center gap-2">
          <CalendarIcon size={20} className="text-muted-foreground" />
          <p>{formatStringAsDate(proposal.data.createdAt, { hour: undefined, minute: undefined })}</p>
        </div>
        <div className="flex items-center gap-2">
          <MapPinHouseIcon size={20} className="text-muted-foreground" />
          <p>{formatAddress(address, city, state, zipCode)}</p>
        </div>
      </div>
    </motion.div>
  )
}
