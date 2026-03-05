'use client'

import { useQuery } from '@tanstack/react-query'
import { AwardIcon, BadgeCheckIcon, ShieldCheckIcon, UserSearchIcon, WrenchIcon, XIcon } from 'lucide-react'
import { motion, useInView } from 'motion/react'
import Link from 'next/link'
import { parseAsString, useQueryState } from 'nuqs'
import { useRef } from 'react'
import { companyInfo, testimonials } from '@/features/landing/data/company'
import { getCurrentMonth, getDaysLeftInMonth } from '@/features/meetings/constants/buy-triggers'
import { MEETING_PROGRAMS } from '@/features/meetings/constants/programs'
import { BuyTriggerBar } from '@/features/meetings/ui/components/buy-trigger-bar'
import { ProgramCard } from '@/features/meetings/ui/components/program-card'
import { SpinnerLoader2 } from '@/shared/components/loaders/spinner-loader-2'
import { Logo } from '@/shared/components/logo'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Separator } from '@/shared/components/ui/separator'
import { pageToContact } from '@/shared/services/notion/lib/contacts/adapter'
import { useTRPC } from '@/trpc/helpers'

const month = getCurrentMonth()
const daysLeft = getDaysLeftInMonth()
const yearsOld = new Date().getFullYear() - companyInfo.yearFounded

const companyStats = [
  { label: 'Projects Completed', value: `${companyInfo.numProjects}+` },
  { label: 'Years in Business', value: `${yearsOld}` },
  { label: 'Client Satisfaction', value: `${companyInfo.clientSatisfaction * 100}%` },
  { label: 'Combined Experience', value: `${companyInfo.combinedYearsExperience}yrs` },
]

const credentials = [
  {
    bg: 'bg-sky-950/60 border-sky-800/30',
    desc: `B2, General Building & Construction — #${companyInfo.licenses[0]?.licenseNumber ?? '1076760'}`,
    Icon: ShieldCheckIcon,
    label: 'CA Licensed Contractor',
    text: 'text-sky-300',
    value: 'State Licensed',
  },
  {
    bg: 'bg-emerald-950/60 border-emerald-800/30',
    desc: 'General liability + workers compensation',
    Icon: BadgeCheckIcon,
    label: 'Fully Insured',
    text: 'text-emerald-300',
    value: '$2M Coverage',
  },
  {
    bg: 'bg-amber-950/60 border-amber-800/30',
    desc: '22 years of continuous BBB membership',
    Icon: AwardIcon,
    label: 'BBB Accredited',
    text: 'text-amber-300',
    value: 'A+ Rating',
  },
  {
    bg: 'bg-violet-950/60 border-violet-800/30',
    desc: 'Every project backed by a written warranty',
    Icon: WrenchIcon,
    label: 'Workmanship Warranty',
    text: 'text-violet-300',
    value: '3–5 Year Coverage',
  },
]

const strParser = parseAsString.withDefault('')

export function MeetingSelectionView() {
  const statsRef = useRef(null)
  const isStatsInView = useInView(statsRef, { margin: '-60px', once: true })

  const credRef = useRef(null)
  const isCredInView = useInView(credRef, { margin: '-60px', once: true })

  const testimonialsRef = useRef(null)
  const isTestimonialsInView = useInView(testimonialsRef, { margin: '-60px', once: true })

  const programsRef = useRef(null)
  const isProgramsInView = useInView(programsRef, { margin: '-60px', once: true })

  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Contact search state ───────────────────────────────────────────
  const [q, setQ] = useQueryState('q', strParser)
  const [contactId, setContactId] = useQueryState('contactId', strParser)

  const trpc = useTRPC()
  const contactSearchQuery = useQuery(
    trpc.notionRouter.contacts.getByQuery.queryOptions(
      { filterProperty: 'name', query: q },
      { enabled: false },
    ),
  )

  function handleSearch() {
    void contactSearchQuery.refetch()
  }

  function handleClear() {
    void setQ('')
    void setContactId('')
    searchInputRef.current?.focus()
  }

  const selectedContactName = contactSearchQuery.data?.allPages
    ?.find(p => p.id === contactId)
    ? pageToContact(contactSearchQuery.data.allPages.find(p => p.id === contactId)!).name
    : null

  return (
    <div className="flex flex-col">

      {/* ── Sticky header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/30 bg-background/80 px-4 py-3 backdrop-blur-md md:px-8">
        <Link
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          href="/"
        >
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">Home</span>
        </Link>
        <div className="relative h-7 w-24">
          <Logo variant="right" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          In-Home Meeting
        </span>
      </header>

      {/* ── Urgency strip ──────────────────────────────────────────── */}
      <BuyTriggerBar
        trigger={{
          message: `${month} Special ends in ${daysLeft} days — limited install slots remaining`,
          type: 'urgency',
        }}
      />

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — Company Presentation
      ══════════════════════════════════════════════════════════════ */}

      {/* Hero intro */}
      <section className="px-4 pb-10 pt-14 text-center md:pb-14 md:pt-20 md:px-8">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl"
          initial={{ opacity: 0, y: 28 }}
          transition={{ duration: 0.55 }}
        >
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Southern California Home Improvement
          </p>
          <h1 className="font-serif text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
            Tri Pros Remodeling
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            Licensed, insured, and warranted — trusted by over
            {' '}
            <strong className="text-foreground">
              {`${companyInfo.numProjects}+ Southern California families`}
            </strong>
            {' '}
            to deliver exceptional results.
          </p>
        </motion.div>
      </section>

      {/* Stats bar */}
      <section ref={statsRef} className="px-4 pb-14 md:px-8">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3 lg:grid-cols-4">
          {companyStats.map((stat, i) => (
            <motion.div
              animate={isStatsInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.88 }}
              className="rounded-2xl border border-border/30 bg-card/50 px-4 py-6 text-center shadow-sm"
              initial={{ opacity: 0, scale: 0.88 }}
              key={stat.label}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            >
              <div className="text-3xl font-black text-foreground lg:text-4xl">
                {stat.value}
              </div>
              <div className="mt-1.5 text-xs font-medium text-muted-foreground">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Credentials grid */}
      <section ref={credRef} className="px-4 pb-14 md:px-8">
        <div className="mx-auto max-w-4xl">
          <motion.p
            animate={isCredInView ? { opacity: 1 } : { opacity: 0 }}
            className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            Our Credentials
          </motion.p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {credentials.map((cred, i) => (
              <motion.div
                animate={isCredInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                className={`flex items-start gap-4 rounded-xl border p-5 ${cred.bg}`}
                initial={{ opacity: 0, y: 20 }}
                key={cred.label}
                transition={{ delay: i * 0.09, duration: 0.4 }}
              >
                <div className={`mt-0.5 shrink-0 ${cred.text}`}>
                  <cred.Icon className="size-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {cred.label}
                  </p>
                  <p className={`mt-0.5 text-xl font-black ${cred.text}`}>
                    {cred.value}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {cred.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section ref={testimonialsRef} className="px-4 pb-20 md:px-8">
        <div className="mx-auto max-w-5xl">
          <motion.div
            animate={isTestimonialsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            className="mb-10 text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              What Our Customers Say
            </p>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">
              Trusted by Southern California Homeowners
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div
                animate={isTestimonialsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                className="flex flex-col rounded-2xl border border-border/50 bg-card/60 p-6 shadow-sm"
                initial={{ opacity: 0, y: 30 }}
                key={t.name}
                transition={{ delay: i * 0.12, duration: 0.5 }}
              >
                {/* Stars */}
                <span aria-label="5 stars" className="text-lg text-yellow-400">
                  ★★★★★
                </span>

                {/* Quote */}
                <p className="mt-4 grow text-sm italic leading-relaxed text-muted-foreground">
                  {`"${t.text}"`}
                </p>

                {/* Author */}
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                    {t.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.project}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — Program Selection
      ══════════════════════════════════════════════════════════════ */}

      <div className="px-4 md:px-8">
        <div className="mx-auto max-w-5xl">
          <Separator />
        </div>
      </div>

      <section ref={programsRef} className="px-4 pb-24 pt-16 md:px-8">
        <div className="mx-auto max-w-5xl">
          <motion.div
            animate={isProgramsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            className="mb-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Step 2
            </p>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">
              Choose Your Program
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Based on what you shared with us today, select the program that fits your situation best.
            </p>
          </motion.div>

          {/* ── Contact Search ──────────────────────────────────────── */}
          <motion.div
            animate={isProgramsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            className="mb-8 rounded-xl border border-border/40 bg-card/40 p-5"
            initial={{ opacity: 0, y: 16 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <div className="mb-3 flex items-center gap-2">
              <UserSearchIcon className="size-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                Find Customer
              </p>
              {selectedContactName && (
                <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  {selectedContactName}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                ref={searchInputRef}
                className="h-9 max-w-56 text-sm"
                placeholder="Search by name…"
                type="text"
                value={q}
                onChange={e => void setQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              <Button size="sm" type="button" onClick={handleSearch}>
                Search
              </Button>
              {contactId && (
                <Button
                  className="gap-1.5"
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                >
                  <XIcon className="size-3.5" />
                  Clear
                </Button>
              )}
              {contactSearchQuery.isLoading && (
                <SpinnerLoader2 size={16} />
              )}
            </div>

            {/* Search results */}
            {contactSearchQuery.data?.allPages && contactSearchQuery.data.allPages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {contactSearchQuery.data.allPages.map(page => (
                  <Badge
                    className="cursor-pointer text-sm"
                    key={page.id}
                    variant={contactId === page.id ? 'default' : 'outline'}
                    onClick={() => void setContactId(page.id)}
                  >
                    {pageToContact(page).name}
                  </Badge>
                ))}
              </div>
            )}

            {!contactId && (
              <p className="mt-2 text-xs text-muted-foreground">
                Search for the customer to personalize the program presentation.
              </p>
            )}
          </motion.div>

          {/* ── Program cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {MEETING_PROGRAMS.map((program, i) => (
              <motion.div
                animate={isProgramsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
                initial={{ opacity: 0, y: 28 }}
                key={program.id}
                transition={{ delay: i * 0.12, duration: 0.45 }}
              >
                <ProgramCard contactId={contactId || undefined} program={program} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
