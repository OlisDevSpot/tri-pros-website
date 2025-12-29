import type { services } from '@/features/landing/data/company/services'
import { motion, useInView } from 'motion/react'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { useFeatureStore } from '@/shared/hooks/use-feature-store'

export default function ServiceCard({
  service,
  index,
}: {
  service: typeof services[number]
  index: number
}) {
  const { setFeatureInView } = useFeatureStore()
  const ref = useRef(null)
  const isInView = useInView(ref, { margin: '-50% 0px -50% 0px' })

  useEffect(() => {
    if (isInView) {
      setFeatureInView(service.title)
    }
    else {
      setFeatureInView('')
    }
  }, [isInView, service.title, setFeatureInView])

  return (
    <motion.div
      key={service.title}
      initial={{ opacity: 0.25, filter: 'brightness(0.3)' }}
      whileInView={{ opacity: 1, filter: 'brightness(1)' }}
      viewport={{ margin: '-50% 0px -50% 0px' }}
      transition={{ duration: 0.4 }}
      className="group"
      ref={ref}
    >
      {/* Content */}
      <div className={`space-y-6 ${index % 2 === 1 ? 'lg:col-start-2' : ''}`}>
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center">
            <span className="text-3xl">{service.icon}</span>
          </div>
          <div>
            <h3 className=" text-2xl lg:text-3xl font-bold text-foreground">
              {service.title}
            </h3>
            <p className="text-muted-foreground font-semibold">
              {service.subtitle}
            </p>
          </div>
        </div>

        <p className="text-lg text-muted-foreground leading-relaxed">
          {service.description}
        </p>

        {/* Key Features */}
        <div className="space-y-3">
          <h4 className="font-semibold text-foreground">Key Features:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {service.features.map((feature, featureIndex) => (
              <motion.div
                key={feature}
                transition={{
                  duration: 0.4,
                  delay: index * 0.2 + featureIndex * 0.1 + 0.3,
                }}
                className="flex items-start space-x-2"
              >
                <div className="w-2 h-2 bg-secondary rounded-full shrink-0 mt-2" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Project Details */}
        <div className="grid grid-cols-2 gap-6 pt-4">
          <div className="bg-linear-to-br from-primary/5 to-secondary/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-foreground mb-1">
              {service.timeline}
            </div>
            <div className="text-sm text-muted-foreground">
              Typical Timeline
            </div>
          </div>
          <div className="bg-linear-to-br from-primary/5 to-secondary/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-foreground mb-1">
              {service.priceRange}
            </div>
            <div className="text-sm text-muted-foreground">
              Investment Range
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className={cn('flex space-x-4 w-full')}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              asChild
              variant="outline"
              size="lg"
              className="text-lg h-16"
            >
              <Link
                href={service.href}
              >
                Learn More
              </Link>
            </Button>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              asChild
              variant="default"
              size="lg"
              className="text-lg h-16"
            >
              <Link
                href="/contact"
              >
                Get Quote
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
