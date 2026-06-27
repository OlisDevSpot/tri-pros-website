'use client'

/*
 * SCRATCH EVAL — Kibo UI component evaluation lab (not production).
 *
 * Renders five Kibo UI components (gantt, kanban, calendar, list, dropzone) with
 * realistic Tri Pros CRM data, in the real app theme, so we can judge fit
 * before wiring any of them into the dashboard for real.
 *
 * Registry: @kibo-ui → https://www.kibo-ui.com/r/{name}.json  (see docs/design-system/shadcn-registries.md)
 * Sample data is LOCAL ONLY — no tRPC, no writes. Inline constants are intentional
 * for a scratch surface (same precedent as the funnel test/ page).
 */

import type { DragEndEvent } from '@dnd-kit/core'
import type { Feature as CalendarFeature } from '@/shared/components/kibo-ui/calendar'
import type { GanttFeature } from '@/shared/components/kibo-ui/gantt'
import { motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  CalendarBody,
  CalendarDate,
  CalendarDatePagination,
  CalendarDatePicker,
  CalendarHeader,
  CalendarItem,
  CalendarMonthPicker,
  CalendarProvider,
  CalendarYearPicker,
} from '@/shared/components/kibo-ui/calendar'
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from '@/shared/components/kibo-ui/dropzone'
import {
  GanttFeatureItem,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttHeader,
  GanttMarker,
  GanttProvider,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttToday,
} from '@/shared/components/kibo-ui/gantt'
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from '@/shared/components/kibo-ui/kanban'
import {
  ListGroup,
  ListHeader,
  ListItem,
  ListItems,
  ListProvider,
} from '@/shared/components/kibo-ui/list'
import { ROOTS } from '@/shared/config/roots'

// @dnd-kit generates incrementing aria ids that diverge between SSR and client,
// causing a hydration mismatch. Rendering the DnD demos only after mount avoids it.
function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

function DemoSkeleton({ height = 'h-64' }: { height?: string }) {
  return <div className={`${height} animate-pulse rounded-md border border-border bg-card/40`} />
}

// ── Shared status palette (explicit per-item colors; not theme tokens) ──────────
const STATUS = {
  planned: { id: 'planned', name: 'Planned', color: '#8a7c6a' },
  active: { id: 'active', name: 'In Progress', color: '#03afed' },
  done: { id: 'done', name: 'Complete', color: '#16a34a' },
  risk: { id: 'risk', name: 'At Risk', color: '#e0982f' },
} as const

// ── 1. GANTT — project timeline (a NEW capability we don't have) ────────────────
const GANTT_PHASES: GanttFeature[] = [
  { id: 'ph1', name: 'Demolition', startAt: new Date(2026, 5, 2), endAt: new Date(2026, 5, 6), status: STATUS.done },
  { id: 'ph2', name: 'Rough Plumbing + Electrical', startAt: new Date(2026, 5, 8), endAt: new Date(2026, 5, 18), status: STATUS.active },
  { id: 'ph3', name: 'Drywall + Paint', startAt: new Date(2026, 5, 19), endAt: new Date(2026, 5, 26), status: STATUS.planned },
  { id: 'ph4', name: 'Cabinetry Install', startAt: new Date(2026, 5, 29), endAt: new Date(2026, 6, 8), status: STATUS.planned },
  { id: 'ph5', name: 'Countertops + Backsplash', startAt: new Date(2026, 6, 9), endAt: new Date(2026, 6, 15), status: STATUS.risk },
  { id: 'ph6', name: 'Final Finish + Walkthrough', startAt: new Date(2026, 6, 16), endAt: new Date(2026, 6, 28), status: STATUS.planned },
]

function GanttDemo() {
  const [phases, setPhases] = useState<GanttFeature[]>(GANTT_PHASES)
  const mounted = useMounted()
  const onMove = (id: string, startAt: Date, endAt: Date | null) =>
    setPhases(prev => prev.map(p => (p.id === id ? { ...p, startAt, endAt: endAt ?? p.endAt } : p)))

  if (!mounted)
    return <DemoSkeleton height="h-[460px]" />

  return (
    <GanttProvider range="daily" zoom={120} className="h-[460px] rounded-md border border-border">
      <GanttSidebar>
        <GanttSidebarGroup name="Encino Kitchen Remodel">
          {phases.map(p => (
            <GanttSidebarItem key={p.id} feature={p} />
          ))}
        </GanttSidebarGroup>
      </GanttSidebar>
      <GanttTimeline>
        <GanttHeader />
        <GanttFeatureList>
          <GanttFeatureListGroup>
            {phases.map(p => (
              <GanttFeatureItem key={p.id} {...p} onMove={onMove}>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: p.status.color }}
                />
                <p className="flex-1 truncate text-xs font-medium">{p.name}</p>
              </GanttFeatureItem>
            ))}
          </GanttFeatureListGroup>
        </GanttFeatureList>
        <GanttToday />
        <GanttMarker id="insp" date={new Date(2026, 5, 27)} label="City Inspection" />
      </GanttTimeline>
    </GanttProvider>
  )
}

// ── 2. KANBAN — customer pipeline (overlaps our existing kanban) ────────────────
// Index signatures satisfy Kibo's `& Record<string, unknown>` generic constraint
// (an interface without one is not assignable to Record<string, unknown>).
interface PipelineCol {
  id: string
  name: string
  [key: string]: unknown
}
interface Lead {
  id: string
  name: string
  column: string
  city: string
  value: string
  [key: string]: unknown
}

const PIPELINE_COLS: PipelineCol[] = [
  { id: 'new', name: 'New Lead' },
  { id: 'contacted', name: 'Contacted' },
  { id: 'meeting', name: 'Meeting Set' },
  { id: 'proposal', name: 'Proposal Sent' },
  { id: 'won', name: 'Won' },
]
const PIPELINE_LEADS: Lead[] = [
  { id: 'c1', name: 'Ramirez — Full Kitchen', column: 'new', city: 'Encino', value: '$48k' },
  { id: 'c2', name: 'Chen — Master Bath', column: 'new', city: 'Pasadena', value: '$32k' },
  { id: 'c3', name: 'Okafor — ADU Build', column: 'contacted', city: 'Glendale', value: '$165k' },
  { id: 'c4', name: 'Patel — Garage Conversion', column: 'meeting', city: 'Burbank', value: '$74k' },
  { id: 'c5', name: 'Williams — Home Addition', column: 'proposal', city: 'Sherman Oaks', value: '$210k' },
  { id: 'c6', name: 'Nguyen — Kitchen + Bath', column: 'won', city: 'Tarzana', value: '$96k' },
]

function KanbanDemo() {
  const [leads, setLeads] = useState<Lead[]>(PIPELINE_LEADS)
  const mounted = useMounted()
  if (!mounted)
    return <DemoSkeleton height="h-72" />
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card/40 p-4">
      <KanbanProvider<Lead, PipelineCol>
        columns={PIPELINE_COLS}
        data={leads}
        onDataChange={setLeads}
        className="min-w-[820px]"
      >
        {col => (
          <KanbanBoard id={col.id} key={col.id}>
            <KanbanHeader className="flex items-center justify-between">
              <span className="font-medium text-sm">{col.name}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                {leads.filter(l => l.column === col.id).length}
              </span>
            </KanbanHeader>
            <KanbanCards<Lead> id={col.id}>
              {lead => (
                <KanbanCard<Lead> key={lead.id} {...lead}>
                  <p className="font-medium text-sm leading-snug">{lead.name}</p>
                  <div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
                    <span>{lead.city}</span>
                    <span className="font-semibold text-primary">{lead.value}</span>
                  </div>
                </KanbanCard>
              )}
            </KanbanCards>
          </KanbanBoard>
        )}
      </KanbanProvider>
    </div>
  )
}

// ── 3. CALENDAR — meeting + install schedule (placed by endAt) ──────────────────
const SCHEDULE: CalendarFeature[] = [
  { id: 'm1', name: 'In-home consult — Ramirez', startAt: new Date(2026, 5, 4), endAt: new Date(2026, 5, 4), status: STATUS.active },
  { id: 'm2', name: 'Install start — Patel ADU', startAt: new Date(2026, 5, 9), endAt: new Date(2026, 5, 9), status: STATUS.planned },
  { id: 'm3', name: 'Proposal review — Williams', startAt: new Date(2026, 5, 12), endAt: new Date(2026, 5, 12), status: STATUS.risk },
  { id: 'm4', name: 'Final walkthrough — Nguyen', startAt: new Date(2026, 5, 18), endAt: new Date(2026, 5, 18), status: STATUS.done },
  { id: 'm5', name: 'City inspection — Encino', startAt: new Date(2026, 5, 27), endAt: new Date(2026, 5, 27), status: STATUS.active },
  { id: 'm6', name: 'Signing — Chen Bath', startAt: new Date(2026, 5, 27), endAt: new Date(2026, 5, 27), status: STATUS.planned },
]

function CalendarDemo() {
  return (
    <div className="rounded-md border border-border bg-card/40 p-4">
      <CalendarProvider locale="en-US" startDay={0}>
        <CalendarDate>
          <CalendarDatePicker>
            <CalendarMonthPicker />
            <CalendarYearPicker start={2025} end={2027} />
          </CalendarDatePicker>
          <CalendarDatePagination />
        </CalendarDate>
        <CalendarHeader />
        <CalendarBody features={SCHEDULE}>
          {({ feature }) => <CalendarItem key={feature.id} feature={feature} />}
        </CalendarBody>
      </CalendarProvider>
    </div>
  )
}

// ── 4. LIST — leads by stage (you own the move logic) ───────────────────────────
function ListDemo() {
  const [leads, setLeads] = useState<Lead[]>(PIPELINE_LEADS.slice(0, 5))
  const mounted = useMounted()
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over)
      return
    setLeads(prev => prev.map(l => (l.id === active.id ? { ...l, column: over.id as string } : l)))
  }
  if (!mounted)
    return <DemoSkeleton height="h-64" />
  return (
    <div className="rounded-md border border-border bg-card/40 p-2">
      <ListProvider onDragEnd={onDragEnd} className="gap-2">
        {PIPELINE_COLS.slice(0, 3).map(col => (
          <ListGroup id={col.id} key={col.id}>
            <ListHeader name={col.name} color={STATUS.active.color} />
            <ListItems>
              {leads
                .filter(l => l.column === col.id)
                .map((lead, index) => (
                  <ListItem key={lead.id} id={lead.id} name={lead.name} index={index} parent={col.id}>
                    <div className="flex w-full items-center justify-between">
                      <span className="text-sm">{lead.name}</span>
                      <span className="text-muted-foreground text-xs">{lead.value}</span>
                    </div>
                  </ListItem>
                ))}
            </ListItems>
          </ListGroup>
        ))}
      </ListProvider>
    </div>
  )
}

// ── 5. DROPZONE — project photo / document upload ───────────────────────────────
function DropzoneDemo() {
  const [files, setFiles] = useState<File[] | undefined>(undefined)
  return (
    <div className="rounded-md border border-border bg-card/40 p-4">
      <Dropzone
        accept={{ 'image/*': [], 'application/pdf': [] }}
        maxFiles={8}
        maxSize={10 * 1024 * 1024}
        src={files}
        onDrop={accepted => setFiles(accepted)}
        onError={err => console.error(err.message)}
        className="min-h-[180px]"
      >
        <DropzoneEmptyState />
        <DropzoneContent />
      </Dropzone>
      {files?.length
        ? (
            <p className="mt-3 text-muted-foreground text-xs">
              {files.length}
              {' '}
              file(s) staged — in production these route to the proposal / project media store.
            </p>
          )
        : null}
    </div>
  )
}

// ── Lab section shell ───────────────────────────────────────────────────────────
interface LabSectionProps {
  index: number
  name: string
  useCase: string
  install: string
  dnd: string
  watch: string
  children: React.ReactNode
}

function LabSection({ index, name, useCase, install, dnd, watch, children }: LabSectionProps) {
  const reduce = useReducedMotion()
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1], delay: index * 0.06 }}
      className="scroll-mt-24"
    >
      <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span
          className="text-3xl font-black tabular-nums text-primary/30"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {String(index).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <h2
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {name}
          </h2>
          <p className="text-muted-foreground text-sm">{useCase}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <code
          className="rounded bg-muted px-2 py-1 text-muted-foreground"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {install}
        </code>
        <span className="rounded-full border border-border px-2 py-1 text-muted-foreground">
          DnD:
          {' '}
          {dnd}
        </span>
      </div>

      {children}

      <p className="mt-3 border-l-2 border-primary/40 pl-3 text-muted-foreground text-xs italic">
        Watch for:
        {' '}
        {watch}
      </p>
    </motion.section>
  )
}

export default function KiboEvalPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p
              className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              Kibo UI · Lab
            </p>
            <h1
              className="text-lg font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              Component Evaluation
            </h1>
          </div>
          <Link
            href={ROOTS.dashboard.root}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="mb-12 max-w-2xl text-muted-foreground leading-relaxed">
          Five Kibo UI components rendered in the real app theme with live Tri Pros CRM data.
          Everything is interactive (drag the gantt bars, move pipeline cards, drop files) but
          local-only — no writes. Goal: decide which of these earn a place in the dashboard.
        </p>

        <div className="space-y-16">
          <LabSection
            index={1}
            name="Gantt — Project Timeline"
            useCase="A capability we don't have today: visualize a remodel's phases on a draggable, resizable timeline."
            install="shadcn add @kibo-ui/gantt"
            dnd="built-in (drag bars + resize handles via onMove)"
            watch="Does the phase bar drag/resize feel precise? Sidebar/timeline row alignment? Fit for project-management."
          >
            <GanttDemo />
          </LabSection>

          <LabSection
            index={2}
            name="Kanban — Customer Pipeline"
            useCase="Overlaps our existing pipeline kanban — is Kibo's worth swapping in, or do we keep ours?"
            install="shadcn add @kibo-ui/kanban"
            dnd="built-in (auto-reorder, onDataChange returns new array)"
            watch="Card drag smoothness vs. our motion/react kanban. Does onDataChange pair cleanly with tRPC mutations?"
          >
            <KanbanDemo />
          </LabSection>

          <LabSection
            index={3}
            name="Calendar — Meeting & Install Schedule"
            useCase="Month grid for the schedule-management feature. Events are placed by their end date, color-coded by status."
            install="shadcn add @kibo-ui/calendar"
            dnd="none (navigation only; month/year are global jotai atoms)"
            watch="Density when a day has 3+ events (+N more). Month nav UX. No per-event click handler out of the box."
          >
            <CalendarDemo />
          </LabSection>

          <LabSection
            index={4}
            name="List — Leads by Stage"
            useCase="A lighter vertical alternative to kanban — drag leads between stacked stages."
            install="shadcn add @kibo-ui/list"
            dnd="manual (you implement the move from the raw drag event)"
            watch="Is this a better mobile pipeline view than horizontal kanban? Move logic is on us."
          >
            <ListDemo />
          </LabSection>

          <LabSection
            index={5}
            name="Dropzone — Project Media Upload"
            useCase="Accessible file upload for proposal photos / project documents."
            install="shadcn add @kibo-ui/dropzone"
            dnd="file drop (controlled — you store accepted files and feed back via src)"
            watch="Does it pair with our S3/media pipeline? Rejection handling via onError. Multi-file preview quality."
          >
            <DropzoneDemo />
          </LabSection>
        </div>

        <footer className="mt-20 border-t border-border pt-6 text-muted-foreground text-xs">
          Catalog of all available registries:
          {' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>docs/design-system/shadcn-registries.md</code>
        </footer>
      </div>
    </main>
  )
}
