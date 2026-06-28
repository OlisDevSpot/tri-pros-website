import type { FunnelSpec } from '@/shared/domains/funnels/types'
import { cardOptions, icon, img, text } from '@/shared/domains/funnels/lib/card-options'
import { ADDRESS_STEP } from '@/shared/domains/funnels/lib/steps/address-step'
import { CONFIRMATION_STEP } from '@/shared/domains/funnels/lib/steps/confirmation-step'
import { HOME_TYPE_STEP } from '@/shared/domains/funnels/lib/steps/home-type-step'
import { PII_STEP } from '@/shared/domains/funnels/lib/steps/pii-step'
import { TIMELINE_STEP } from '@/shared/domains/funnels/lib/steps/timeline-step'
import { ZIP_STEP } from '@/shared/domains/funnels/lib/steps/zip-step'

export const kitchensFunnel: FunnelSpec = {
  slug: 'kitchens',
  offer: 'showcase',
  title: 'Kitchen Showcase',
  hero: {
    headline: 'Get a AAA-grade kitchen remodel — at a Showcase price.',
    subhead: 'See if your home qualifies to be featured in our showcase.',
    scarcityLine: 'We\'re selecting 5 kitchens in your area.',
    ctaLabel: 'See if you qualify',
    media: { kind: 'image', src: '/portfolio-photos/modern-kitchen-1.jpeg', alt: 'Modern remodeled kitchen' },
    highlightWords: ['AAA-grade', 'Showcase'],
  },
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'kitchen' },
  landing: {
    blocks: [
      {
        kind: 'problem',
        content: {
          headline: 'Most kitchen remodels go sideways. Here\'s why.',
          body: 'A kitchen is the hardest room in the house to get right — plumbing, gas, electrical, cabinetry, and tight tolerances all have to land at once. One weak link and you\'re living in a months-long jobsite.',
          points: [
            { title: 'Cut-rate "deal" crews', body: 'Low bids hide unpermitted work, no insurance, and no recourse when something goes wrong.', image: '/funnels/common/reason-cut-rate-crews.webp', alt: 'Cut-rate deal crews' },
            { title: 'No one accountable', body: 'Independent subs blame each other and you become the project manager of your own remodel.', image: '/funnels/common/reason-no-accountability.webp', alt: 'No one accountable' },
            { title: 'Surprise change-orders', body: 'A cheap bid becomes an expensive invoice the moment demo opens the walls.', image: '/funnels/common/reason-surprise-change-orders.webp', alt: 'Surprise change orders' },
            { title: 'Endless timelines', body: 'Without real scheduling, six weeks becomes six months — and your kitchen stays unusable.', image: '/funnels/common/reason-endless-timelines.webp', alt: 'Endless timelines' },
          ],
          standardLine: 'What to demand: a licensed, bonded, insured GC you can verify, one accountable team, a fixed written scope, and a real schedule. That\'s the bar — and for us it\'s the floor.',
        },
      },
      { kind: 'cta', content: { label: 'Learn how we do it' } },
      {
        kind: 'value',
        content: {
          headline: 'Your kitchen, redesigned for how you actually live.',
          roiStat: { value: '95 – 185%', label: 'resale ROI — the highest of any room' },
          beforeAfter: [
            { before: '/funnels/kitchens/before-1.webp', after: '/funnels/kitchens/after-1.webp' },
            { before: '/funnels/kitchens/before-2.webp', after: '/funnels/kitchens/after-2.webp' },
          ],
          items: [
            { before: 'Cabinets that don\'t close right', after: 'Soft-close cabinetry, built to last' },
            { before: 'Counter space that was never enough', after: 'Quartz counters with room to actually cook' },
            { before: 'A layout that fights you', after: 'An optimized layout designed around your life' },
            { before: 'A kitchen that feels decades behind', after: 'A space that finally matches how you live' },
          ],
        },
      },
      { kind: 'portfolio', content: { title: 'Recent kitchens in your area' } },
      { kind: 'reviews', content: { rating: 4.9, count: 200, label: 'What homeowners say' } },
      {
        kind: 'process',
        content: {
          title: 'How your Showcase kitchen comes together',
          steps: [
            { title: 'Discovery & Design', duration: 'Wk 1–2', image: '/process/design-stage.jpeg', body: 'We map your goals, measure, and design a kitchen around how you actually cook and live.' },
            { title: 'Pre-Construction & Permits', duration: 'Wk 3–4', image: '/process/pre-construction-stage.jpeg', body: 'We lock the scope, pull permits, and order materials so the build runs without surprises.' },
            { title: 'Construction', image: '/process/construction-stage.jpeg', body: 'One accountable crew, daily quality checks, and photo documentation — not a rotating cast of subs.' },
            { title: 'Completion & Handover', image: '/process/handover-stage.jpeg', body: 'Final walkthrough, punch list, and a kitchen done right — backed by our workmanship guarantee.' },
          ],
        },
      },
      {
        kind: 'callout',
        content: {
          headline: 'Fixed, low monthly payments.',
          body: 'Fixed, low monthly payments put a Showcase kitchen within reach without draining your savings. We\'ll walk you through the options you qualify for during your consultation — no obligation.',
          points: ['Fixed low monthly payments', 'No-obligation consultation', 'Clear, written numbers up front'],
          image: { src: '/portfolio-photos/modern-kitchen-1.jpeg', alt: 'Remodeled Showcase kitchen' },
        },
      },
      {
        kind: 'faq',
        content: {
          title: 'Kitchen remodel questions, answered',
          items: [
            { q: 'How much does a kitchen remodel cost?', a: 'It depends on size, scope, and finishes — which is exactly why we give you a fixed written scope and clear numbers up front instead of a low guess that balloons later. Most Showcase kitchens land in a range we\'ll walk you through on your consultation.' },
            { q: 'How long does it take?', a: 'A typical Showcase kitchen runs about 3–10 weeks of active construction after design and permits, depending on complexity and scope. You get a real schedule — not a vague "couple of months."' },
            { q: 'Do I need permits?', a: 'Most kitchen remodels that touch plumbing, gas, or electrical do. As a licensed general contractor we pull and manage them for you. Unpermitted work becomes your problem when you sell.' },
            { q: 'Can I use my kitchen during the remodel?', a: 'There\'s a window where it\'s offline. We sequence the work to keep that window as short as possible and tell you exactly when, up front.' },
            { q: 'Is financing available?', a: 'Yes — with fixed, low monthly payments so you can start now and pay over time. We\'ll cover the options you qualify for during your consultation.' },
            { q: 'Are you licensed and insured?', a: 'Fully. We\'re a licensed, bonded general contractor (CSLB #1076760) insured up to $1M general liability — and you can verify our license on the CSLB website.' },
          ],
        },
      },
      {
        kind: 'guarantee',
        content: {
          headline: 'Showcase-grade work, guaranteed',
          body: 'Every Showcase project is backed by our workmanship guarantee.',
          scarcityLine: 'We\'re selecting 5 kitchens in your area this month.',
        },
      },
      { kind: 'licensing', content: {} },
    ],
  },
  enrichment: [
    { stepId: 'homeType', label: 'Home type' },
    { stepId: 'layout', label: 'Kitchen layout' },
    { stepId: 'scope', label: 'Scope' },
    { stepId: 'age', label: 'Project age' },
    { stepId: 'timeline', label: 'Timeline' },
  ],
  // Linear funnel: no `flow` — the engine advances through `steps` in order.
  // Q1 (ownership) is the hero-embedded entry question: a low-friction binary
  // that qualifies the lead before asking anything trade-specific
  // (see ui/funnel-hero.tsx, entryQuestion). It's followed by ZIP → home type →
  // PII (lead creation), then the trade-specific enrichment questions begin with
  // kitchen-layout.
  steps: [
    {
      id: 'ownership',
      kind: 'card-select',
      content: {
        title: 'Do you own or rent your home?',
        subtitle: 'Showcase projects are available to homeowners.',
        options: cardOptions('kitchens', 'ownership', [
          text('own', 'I own'),
          text('rent', 'I rent'),
        ]),
      },
    },
    { ...ZIP_STEP, content: { ...ZIP_STEP.content, subtitle: 'Showcase kitchens are selected by neighborhood.' } },
    HOME_TYPE_STEP,
    PII_STEP,
    {
      id: 'layout',
      kind: 'card-select',
      content: {
        title: 'Which best describes your kitchen?',
        options: cardOptions('kitchens', 'layout', [
          img('l-shape', 'L-shaped'),
          img('u-shape', 'U-shaped'),
          img('galley', 'Galley'),
          img('island', 'Has an island'),
          icon('open', 'Open-concept'),
          icon('not-sure', 'Not sure'),
        ]),
      },
    },
    {
      id: 'scope',
      kind: 'card-select',
      content: {
        title: 'What are you picturing?',
        options: cardOptions('kitchens', 'scope', [
          img('full-gut', 'Full gut remodel'),
          img('cabinets-counters', 'Cabinets + counters'),
          img('refresh', 'Cosmetic refresh'),
          img('not-sure', 'Not sure yet'),
        ]),
      },
    },
    {
      id: 'age',
      kind: 'card-select',
      content: {
        title: 'How old is your kitchen?',
        options: cardOptions('kitchens', 'age', [
          img('0-5', '0–5 years'),
          img('5-15', '5–15 years'),
          img('15-plus', '15+ years'),
          img('original', 'Original / never renovated'),
        ]),
      },
    },
    TIMELINE_STEP,
    ADDRESS_STEP,
    CONFIRMATION_STEP,
  ],
}
