'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { motion, useInView } from 'motion/react'

import { useRef } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'

const COMPARISON_ROWS = [
  {
    label: 'CA Contractor\'s License',
    triPros: true,
    other: false,
    otherNote: null,
  },
  {
    label: 'Licensed & Bonded',
    triPros: true,
    other: false,
    otherNote: null,
  },
  {
    label: 'General Liability ($2M)',
    triPros: true,
    other: false,
    otherNote: 'No \u2014 you\'re liable',
  },
  {
    label: 'Manufacturer Warranty',
    triPros: true,
    triProsNote: 'Valid (certified installer)',
    other: false,
    otherNote: 'Voided',
  },
  {
    label: 'Workmanship Warranty',
    triPros: true,
    triProsNote: 'Written guarantee',
    other: false,
    otherNote: 'Verbal, if any',
  },
  {
    label: 'Permits & Inspections',
    triPros: true,
    triProsNote: 'Pulled and passed',
    other: false,
    otherNote: 'Skipped',
  },
  {
    label: 'Contractor Experience',
    triPros: true,
    triProsNote: '15+ years',
    other: false,
    otherNote: '3 years or less',
  },
  {
    label: 'When something goes wrong',
    triPros: true,
    triProsNote: 'We come back',
    other: false,
    otherNote: 'They disappear',
  },
] as const

export function ComparisonTable() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section ref={ref} className="container py-16 lg:py-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
          Why the Right Contractor Matters
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="overflow-x-auto rounded-xl border border-border"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-50" />
              <TableHead className="min-w-45 text-center font-semibold">
                Tri Pros Remodeling
              </TableHead>
              <TableHead className="min-w-45 text-center font-semibold">
                Unlicensed Contractor
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {COMPARISON_ROWS.map(row => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="size-5 text-green-600 shrink-0" />
                    {row.triProsNote && (
                      <span className="text-sm text-muted-foreground">
                        {row.triProsNote}
                      </span>
                    )}
                    {!row.triProsNote && (
                      <span className="text-sm text-green-700">Yes</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <XCircle className="size-5 text-red-500 shrink-0" />
                    {row.otherNote && (
                      <span className="text-sm text-muted-foreground">
                        {row.otherNote}
                      </span>
                    )}
                    {!row.otherNote && (
                      <span className="text-sm text-red-600">No</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>
    </section>
  )
}
