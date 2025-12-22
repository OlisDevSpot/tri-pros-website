'use client'

import { motion } from 'motion/react'
import Link from 'next/link'
import { companyInfo } from '@/features/landing/data/company'
import { footerData } from '@/features/landing/data/footer'
import { Logo } from './logo'

export default function Footer() {
  return (
    <footer className="bg-muted text-foreground sticky bottom-0 w-full z-[-100]">
      <div className="container pt-16 pb-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6 "
            >
              {/* Logo */}
              <motion.div className="w-[200px]">
                <Logo />
              </motion.div>

              {/* Company Description */}
              <p className="text-foreground leading-relaxed max-w-md">
                Crafting architectural masterpieces for over
                {' '}
                {new Date().getFullYear() - companyInfo.yearFounded}
                {' '}
                years. We
                specialize in luxury construction that stands the test of time,
                delivering exceptional quality and white-glove service to
                discerning clients.
              </p>

              {/* Certifications */}
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">
                  Certifications & Awards
                </h4>
                <div className="flex flex-wrap gap-3 text-sm text-foreground">
                  <span>Licensed & Bonded</span>
                  <span>•</span>
                  <span>A+ BBB Rating</span>
                  <span>•</span>
                  <span>NARI Member</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Navigation Links */}
          {footerData.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <h3 className=" font-bold text-lg text-foreground mb-4">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map(link => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-foreground hover:brightness-80 transition-all duration-200 text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Contact Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 pt-8 border-t border-primary-foreground/20"
        >
          <h3 className=" font-bold text-lg text-foreground mb-6">
            Contact Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              ...companyInfo.contactInfo,
              {
                label: 'License',
                value: companyInfo.licenses[0].licenseNumber,
                icon: '📜',
              },
            ].map(info => (
              <div
                key={info.label}
                className="flex items-start space-x-3"
              >
                <span className="text-2xl">{info.icon}</span>
                <div>
                  <p className="font-semibold text-foreground text-sm whitespace-break-spaces">
                    {info.label}
                  </p>
                  <p className="text-foreground text-sm">{info.value}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Newsletter Signup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 pt-8 border-t border-primary-foreground/20"
        >
          <div className="max-w-md">
            <h3 className=" font-bold text-lg text-foreground mb-4">
              Stay Updated
            </h3>
            <p className="text-foreground text-sm mb-4">
              Get the latest construction tips, project showcases, and company
              news.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-primary-foreground/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className="text-foreground/70 text-sm">
              ©
              {' '}
              {new Date().getFullYear()}
              {' '}
              {companyInfo.name}
              . All rights
              rights reserved.
            </div>
            <div className="flex space-x-6 text-sm">
              <Link
                href="/privacy"
                className="text-foreground/70 hover:text-secondary transition-colors duration-200"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-foreground/70 hover:text-secondary transition-colors duration-200"
              >
                Terms of Service
              </Link>
              <Link
                href="/sitemap"
                className="text-foreground/70 hover:text-secondary transition-colors duration-200"
              >
                Sitemap
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
