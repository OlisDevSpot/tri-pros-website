import { CalendarIcon, MapPinHouseIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useCurrentProposal } from '@/features/proposals/hooks/use-current-proposal'
import { useHubspotContact } from '@/shared/services/hubspot/hooks/useHubspot'

export function Heading() {
  const proposal = useCurrentProposal()
  const contact = useHubspotContact({ contactId: proposal.data?.hubspotContactVid || '', enabled: !!proposal.data?.hubspotContactVid })

  if (proposal.isLoading || contact.isLoading) {
    return <div>Loading...</div>
  }

  if (!proposal.data || !contact.data || !contact.data.properties) {
    return null
  }

  const { address, city, state, zip } = contact.data.properties

  function formatAddress(address: string, city: string, state: string, zipCode: string) {
    return `${address}, ${city}, ${state}, ${zipCode}`
  }

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
          {`${contact.data.properties.firstname} ${contact.data.properties.lastname}` || 'John Doe'}
        </h2>
      </div>
      <div className="flex flex-col lg:flex-row gap-2 lg:gap-6">
        <div className="flex items-center gap-2">
          <CalendarIcon size={20} className="text-muted-foreground" />
          <p>{proposal.data.createdAt}</p>
        </div>
        <div className="flex items-center gap-2">
          <MapPinHouseIcon size={20} className="text-muted-foreground" />
          <p>{formatAddress(address, city, state, zip)}</p>
        </div>
      </div>
    </motion.div>
  )
}
