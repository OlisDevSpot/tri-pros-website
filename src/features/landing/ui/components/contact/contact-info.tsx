'use client'

import { motion } from 'motion/react'
import { companyInfo } from '@/features/landing/data/company'
import { formatAsPhoneNumber } from '@/lib/formatters'

const offices = [
  {
    name: 'Main Office',
    address: companyInfo.contactInfo.find(info => info.accessor === 'mainOffice')!.value.split('\n')[0],
    city: companyInfo.contactInfo.find(info => info.accessor === 'mainOffice')!.value.split('\n')[1],
    phone: formatAsPhoneNumber(companyInfo.contactInfo.find(info => info.accessor === 'phone')!.value),
    hours: 'Mon-Fri: 8:00 AM - 6:00 PM\nSat: 9:00 AM - 3:00 PM\nSun: Closed',
  },
]

export default function ContactInfo() {
  return (
    <section className="bg-foreground py-16 lg:py-24 text-background w-full">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-12 flex flex-col lg:flex-row gap-12 justify-between w-full"
        >
          {/* Header */}
          <div className="flex-1">
            <h2 className="mb-4">
              Get in Touch
            </h2>
            <p className="text-background/80">
              Multiple ways to reach our expert team. We&apos;re here to help
              bring your construction vision to life.
            </p>
          </div>
          <div className="flex-3">
            {/* Contact Methods */}
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="space-y-6 flex-1">
                {offices.map((office, index) => (
                  <motion.div
                    key={office.name}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 + 0.4 }}
                    className="p-6 rounded-lg bg-background/10 backdrop-blur-sm border border-background/20"
                  >
                    <h4 className=" text-lg font-bold text-background mb-3">
                      {office.name}
                    </h4>
                    <div className="space-y-2 text-background/90">
                      <div className="flex items-start space-x-2">
                        <span className="text-secondary">📍</span>
                        <div>
                          <div>{office.address}</div>
                          <div>{office.city}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-secondary">📞</span>
                        <a
                          href={`tel:${office.phone}`}
                          className="hover:text-secondary transition-colors"
                        >
                          {office.phone}
                        </a>
                      </div>
                      <div className="flex items-start space-x-2">
                        <span className="text-secondary">🕒</span>
                        <div className="whitespace-pre-line text-sm">
                          {office.hours}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-secondary">📧</span>
                          <a
                            href={`mailto:${companyInfo.contactInfo.find(info => info.accessor === 'email')!.value}`}
                            className="hover:text-secondary transition-colors"
                          >
                            {companyInfo.contactInfo.find(info => info.accessor === 'email')!.value}
                          </a>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="bg-secondary/20 rounded-lg p-6 border border-secondary/30 flex-1"
              >
                <h3 className=" text-lg font-bold text-background mb-4">
                  Our Response Commitment
                </h3>
                <div className="space-y-3 text-sm text-background/90">
                  <div className="flex justify-between">
                    <span>Phone Calls:</span>
                    <span className="font-semibold">
                      Answered live during business hours
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Emails:</span>
                    <span className="font-semibold">Within 2 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Consultation Requests:</span>
                    <span className="font-semibold">Within 24 hours</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
