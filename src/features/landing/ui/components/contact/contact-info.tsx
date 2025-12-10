'use client'

import { motion } from 'motion/react'
import { companyInfo } from '@/features/landing/data/company'
import { formatAsPhoneNumber } from '@/lib/formatters'

const contactMethods = [
  {
    type: 'Main Office',
    value: formatAsPhoneNumber(companyInfo.contactInfo.find(info => info.accessor === 'phone')!.value),
    description: 'Mon-Fri: 8:00 AM - 6:00 PM',
    icon: '📞',
    href: 'tel:+15551234567',
  },
  {
    type: 'Emergency Line',
    value: formatAsPhoneNumber(companyInfo.teamInfo.owners.find(owner => owner.name === 'Oliver Porat')!.phone),
    description: '24/7 Emergency Support',
    icon: '🚨',
    href: 'tel:+15559990000',
  },
  {
    type: 'Email',
    value: 'info@triprosremodeling.com',
    description: 'Response within 2 hours',
    icon: '📧',
    href: 'mailto:info@triprosremodeling.com',
  },
]

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
    <section className="bg-foreground py-16 lg:py-24 text-background">
      <div className="container max-w-2xl!">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-12"
        >
          {/* Header */}
          <div>
            <h2 className=" text-2xl lg:text-3xl font-bold mb-4">
              Get in Touch
            </h2>
            <p className="text-background/80">
              Multiple ways to reach our expert team. We&apos;re here to help
              bring your construction vision to life.
            </p>
          </div>

          {/* Contact Methods */}
          <div className="space-y-6">
            <h3 className=" text-xl font-bold text-background">
              Contact Methods
            </h3>
            {contactMethods.map((method, index) => (
              <motion.a
                key={method.type}
                href={method.href}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="flex items-start space-x-4 p-4 rounded-lg bg-card/10 backdrop-blur-sm hover:bg-card/20 transition-colors duration-200"
              >
                <div className="text-2xl">{method.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold">
                    {method.type}
                  </div>
                  <div className="text-lg">{method.value}</div>
                  <div className="text-sm text-background/70">
                    {method.description}
                  </div>
                </div>
              </motion.a>
            ))}
          </div>

          {/* Office Locations */}
          <div className="space-y-6">
            <h3 className=" text-xl font-bold text-foreground">
              Office Locations
            </h3>
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
                </div>
              </motion.div>
            ))}
          </div>

          {/* Response Times */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="bg-secondary/20 rounded-lg p-6 border border-secondary/30"
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
              <div className="flex justify-between">
                <span>Emergency Calls:</span>
                <span className="font-semibold">Immediate response 24/7</span>
              </div>
            </div>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="text-center"
          >
            <h3 className=" text-lg font-bold text-background mb-4">
              Why Choose Tri Pros Remodeling?
            </h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-background">98%</div>
                <div className="text-sm text-background/80">
                  Client Satisfaction
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-background">25+</div>
                <div className="text-sm text-background/80">
                  Years Experience
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-background">A+</div>
                <div className="text-sm text-background/80">
                  BBB Rating
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-background">500+</div>
                <div className="text-sm text-background/80">
                  Projects Completed
                </div>
              </div>
            </div>
          </motion.div>

          {/* Emergency Notice */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-center"
          >
            <div className="flex items-center justify-center space-x-2 mb-2">
              <span className="text-2xl">🚨</span>
              <span className="font-bold text-destructive">Emergency Support</span>
            </div>
            <p className="text-sm text-background">
              For construction emergencies, call our 24/7 hotline:
              <a
                href="tel:+15559990000"
                className="font-bold text-destructive ml-1"
              >
                (555) 999-0000
              </a>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
