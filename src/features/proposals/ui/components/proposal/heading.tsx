import { CalendarIcon, MapPinHouseIcon } from 'lucide-react'
import { motion } from 'motion/react'

export function Heading() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col justify-between items-start lg:items-center gap-2"
    >
      <div>
        <h2 className="text-2xl lg:text-4xl">
          Proposal for
          {' {{ho.firstName}} {{ho.lastName}} '}
        </h2>
      </div>
      <div className="flex flex-col lg:flex-row gap-2 lg:gap-6">
        <div className="flex items-center gap-2">
          <CalendarIcon size={20} className="text-muted-foreground" />
          <p>{`{{proposal.dateSent}}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <MapPinHouseIcon size={20} className="text-muted-foreground" />
          <p>{`{{project.fullAddress}}`}</p>
        </div>
      </div>
    </motion.div>
  )
}
