import { motion } from 'motion/react'
import { companyInfo } from '@/features/landing/data/company'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
  onHero?: boolean
}

export function CompanySocialButtons({ className, onHero = false }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, delay: 1 }}
      className={cn(
        'inline-flex',
        onHero && 'lg:inline lg:absolute lg:top-1/2 lg:left-6 lg:-translate-y-1/2',
      )}
    >
      <div className={cn(
        'w-fit h-fit flex lg:flex-col gap-4 py-4',
        className,
      )}
      >
        {companyInfo.socials.map(social => (
          <a
            key={social.name}
            href={social.href}
            target="_blank"
            className="rounded-md"
          >
            <social.Icon className={cn('w-6 h-6 transition', social.className)} />
          </a>
        ))}
      </div>
    </motion.div>
  )
}
