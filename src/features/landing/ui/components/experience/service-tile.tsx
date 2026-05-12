'use client'

import type { services } from '@/shared/constants/company/services'
import { ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { STAGGER_CHILD } from '@/features/landing/constants/experience-motion'
import { experienceServiceIcons } from '@/features/landing/constants/experience-service-icons'

type Service = (typeof services)[number]

interface ServiceTileProps {
  service: Service
}

export function ServiceTile({ service }: ServiceTileProps) {
  const Icon = experienceServiceIcons[service.slug]

  return (
    <motion.div variants={STAGGER_CHILD}>
      <Link
        href={service.href}
        className="group flex h-full flex-col gap-5 p-8 lg:p-10 bg-background hover:bg-foreground/[0.02] transition-colors duration-300 min-h-[280px] lg:min-h-[320px]"
      >
        <Icon className="size-7 stroke-[1.5] text-primary" />

        <div className="flex-1 space-y-3">
          <h3 className="font-serif text-xl lg:text-2xl leading-tight text-foreground group-hover:text-primary transition-colors duration-300">
            {service.title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
            {service.description}
          </p>
        </div>

        <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-foreground">
          Learn More
          <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </Link>
    </motion.div>
  )
}
