import type { FunnelSpec } from '@/shared/domains/funnels/types'
import { ADDRESS_STEP } from '@/shared/domains/funnels/ui/steps/address-step'
import { CONFIRMATION_STEP } from '@/shared/domains/funnels/ui/steps/confirmation-step'
import { HOME_TYPE_STEP } from '@/shared/domains/funnels/ui/steps/home-type-step'
import { PII_STEP } from '@/shared/domains/funnels/ui/steps/pii-form-step'
import { ZIP_STEP } from '@/shared/domains/funnels/ui/steps/zip-step'

export const bathroomsFunnel: FunnelSpec = {
  slug: 'bathrooms',
  offer: 'showcase',
  title: 'Bathroom Showcase',
  hero: {
    headline: 'The spa bathroom you\'ll actually use — at a Showcase price.',
    subhead: 'See if your home qualifies to be featured in our bathroom showcase.',
    scarcityLine: 'We\'re selecting 5 bathrooms in your area.',
    ctaLabel: 'See if you qualify',
    media: { kind: 'image', src: '/portfolio-photos/modern-bathroom-1.jpeg', alt: 'Modern remodeled bathroom' },
    highlightWords: ['spa', 'Showcase'],
  },
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'bathroom' },
  enrichment: [
    { stepId: 'whichBathroom', label: 'Which bathroom' },
    { stepId: 'homeType', label: 'Home type' },
    { stepId: 'age', label: 'Bathroom age' },
    { stepId: 'scope', label: 'Scope' },
    { stepId: 'accessibility', label: 'Accessibility' },
    { stepId: 'timeline', label: 'Timeline' },
  ],
  landing: {
    blocks: [
      {
        kind: 'problem',
        content: {
          headline: 'Most bathroom remodels hide their worst problems behind the tile.',
          body: 'A bathroom is a waterproofing problem first and a design project second. Get the membrane, slope, or plumbing wrong and the damage grows inside the walls for years — long after the "deal" crew has cashed your check.',
          points: [
            { title: 'Hidden water damage', body: 'Bad waterproofing and rushed tile work trap moisture — rot, mold, and a rebuild you pay for twice.', image: '/funnels/common/reason-cut-rate-crews.webp', alt: 'Hidden water damage from cut-rate work' },
            { title: 'No one accountable', body: 'Independent subs blame each other and you become the project manager of your own remodel.', image: '/funnels/common/reason-no-accountability.webp', alt: 'No one accountable' },
            { title: 'Surprise change-orders', body: 'A cheap bid becomes an expensive invoice the moment demo opens the wall behind the shower.', image: '/funnels/common/reason-surprise-change-orders.webp', alt: 'Surprise change orders' },
            { title: 'Endless timelines', body: 'Without real scheduling, two weeks becomes two months — and your only shower stays offline.', image: '/funnels/common/reason-endless-timelines.webp', alt: 'Endless timelines' },
          ],
          standardLine: 'What to demand: a licensed, bonded, insured GC you can verify, one accountable team, proper waterproofing, a fixed written scope, and a real schedule. That\'s the bar — and for us it\'s the floor.',
        },
      },
      { kind: 'cta', content: { label: 'Learn how we do it' } },
      {
        kind: 'value',
        content: {
          headline: 'A bathroom that feels like a retreat — and protects your home.',
          roiStat: { value: '60–70%', label: 'typical resale ROI on a bath remodel' },
          beforeAfter: [
            { before: '/funnels/bathrooms/before-1.webp', after: '/funnels/bathrooms/after-1.webp' },
            { before: '/funnels/bathrooms/before-2.webp', after: '/funnels/bathrooms/after-2.webp' },
          ],
          items: [
            { before: 'A cramped tub you never use', after: 'A walk-in spa shower built around your routine' },
            { before: 'Dated tile and failing grout', after: 'Properly waterproofed, easy-clean surfaces' },
            { before: 'A slippery, awkward step-over', after: 'Curbless, safe access that ages with you' },
            { before: 'A bathroom decades behind', after: 'A calm, modern space you look forward to' },
          ],
        },
      },
      { kind: 'portfolio', content: { title: 'Recent bathrooms in your area' } },
      { kind: 'reviews', content: { rating: 4.9, count: 200, label: 'What homeowners say' } },
      {
        kind: 'process',
        content: {
          title: 'How your Showcase bathroom comes together',
          steps: [
            { title: 'Discovery & Design', duration: 'Wk 1–2', image: '/process/design-stage.jpeg', body: 'We map how you use the space, measure, and design a bathroom around your routine and your home\'s plumbing.' },
            { title: 'Pre-Construction & Permits', duration: 'Wk 2–3', image: '/process/pre-construction-stage.jpeg', body: 'We lock the scope, pull permits, and order materials so the build runs without surprises.' },
            { title: 'Construction', image: '/process/construction-stage.jpeg', body: 'One accountable crew, proper waterproofing, daily quality checks, and photo documentation — not a rotating cast of subs.' },
            { title: 'Completion & Handover', image: '/process/handover-stage.jpeg', body: 'Final walkthrough, punch list, and a bathroom done right — backed by our workmanship guarantee.' },
          ],
        },
      },
      {
        kind: 'callout',
        content: {
          headline: 'Fixed, low monthly payments.',
          body: 'Fixed, low monthly payments put a Showcase bathroom within reach without draining your savings. We\'ll walk you through the options you qualify for during your consultation — no obligation.',
          points: ['Fixed low monthly payments', 'No-obligation consultation', 'Clear, written numbers up front'],
          image: { src: '/portfolio-photos/modern-bathroom-1.jpeg', alt: 'Remodeled Showcase bathroom' },
        },
      },
      {
        kind: 'faq',
        content: {
          title: 'Bathroom remodel questions, answered',
          items: [
            { q: 'How much does a bathroom remodel cost?', a: 'It depends on size, scope, and finishes — which is why we give you a fixed written scope and clear numbers up front instead of a low guess that balloons later. We\'ll walk you through the range on your consultation.' },
            { q: 'How long does it take?', a: 'A typical Showcase bathroom runs about 2–5 weeks of active construction after design and permits, depending on scope. You get a real schedule — not a vague "couple of weeks."' },
            { q: 'Do I need permits?', a: 'Most bathroom remodels that touch plumbing or electrical do. As a licensed general contractor we pull and manage them for you. Unpermitted work becomes your problem when you sell.' },
            { q: 'Can you convert my tub to a walk-in shower?', a: 'Yes — tub-to-shower and curbless walk-in conversions are among our most requested projects, with proper waterproofing and safe, code-compliant access.' },
            { q: 'Is financing available?', a: 'Yes — with fixed, low monthly payments so you can start now and pay over time. We\'ll cover the options you qualify for during your consultation.' },
            { q: 'Are you licensed and insured?', a: 'Fully. We\'re a licensed, bonded general contractor (CSLB #1076760) insured up to $1M general liability — and you can verify our license on the CSLB website.' },
          ],
        },
      },
      {
        kind: 'guarantee',
        content: {
          headline: 'Showcase-grade work, guaranteed',
          body: 'Every Showcase project is backed by our workmanship guarantee — including the waterproofing behind the walls.',
          scarcityLine: 'We\'re selecting 5 bathrooms in your area this month.',
        },
      },
      { kind: 'licensing', content: {} },
    ],
  },
  steps: [
    {
      id: 'whichBathroom',
      kind: 'card-select',
      optionIds: ['primary', 'guest', 'powder', 'multiple'],
      content: {
        title: 'Which bathroom are you remodeling?',
        options: {
          primary: { label: 'Primary / ensuite', asset: { kind: 'image', src: '/funnels/bathrooms/whichBathroom/primary.webp', alt: 'Primary ensuite bathroom' } },
          guest: { label: 'Guest / hall bath', asset: { kind: 'image', src: '/funnels/bathrooms/whichBathroom/guest.webp', alt: 'Guest or hall bathroom' } },
          powder: { label: 'Powder room', asset: { kind: 'image', src: '/funnels/bathrooms/whichBathroom/powder.webp', alt: 'Powder room' } },
          multiple: { label: 'Multiple bathrooms', asset: { kind: 'image', src: '/funnels/bathrooms/whichBathroom/multiple.webp', alt: 'Multiple bathrooms' } },
        },
      },
    },
    {
      id: 'ownership',
      kind: 'card-select',
      optionIds: ['own', 'rent'],
      content: {
        title: 'Do you own or rent your home?',
        subtitle: 'Showcase projects are available to homeowners.',
        options: {
          own: { label: 'I own my home' },
          rent: { label: 'I rent' },
        },
      },
    },
    { ...ZIP_STEP, content: { ...ZIP_STEP.content, subtitle: 'Showcase bathrooms are selected by neighborhood.' } },
    PII_STEP,
    HOME_TYPE_STEP,
    {
      id: 'age',
      kind: 'card-select',
      optionIds: ['0-5', '5-15', '15-plus', 'original'],
      content: {
        title: 'How old is your bathroom?',
        options: {
          '0-5': { label: '0–5 years', asset: { kind: 'image', src: '/funnels/bathrooms/age/0-5.webp', alt: 'Bathroom 0–5 years old' } },
          '5-15': { label: '5–15 years', asset: { kind: 'image', src: '/funnels/bathrooms/age/5-15.webp', alt: 'Bathroom 5–15 years old' } },
          '15-plus': { label: '15+ years', asset: { kind: 'image', src: '/funnels/bathrooms/age/15-plus.webp', alt: 'Bathroom 15+ years old' } },
          'original': { label: 'Original / never renovated', asset: { kind: 'image', src: '/funnels/bathrooms/age/original.webp', alt: 'Original, never-renovated bathroom' } },
        },
      },
    },
    {
      id: 'scope',
      kind: 'card-select',
      optionIds: ['full-gut', 'tub-to-shower', 'walk-in-shower', 'vanity-fixtures', 'cosmetic'],
      content: {
        title: 'What are you picturing?',
        options: {
          'full-gut': { label: 'Full gut remodel', asset: { kind: 'image', src: '/funnels/bathrooms/scope/full-gut.webp', alt: 'Full gut bathroom remodel' } },
          'tub-to-shower': { label: 'Tub → shower conversion', asset: { kind: 'image', src: '/funnels/bathrooms/scope/tub-to-shower.webp', alt: 'Tub to shower conversion' } },
          'walk-in-shower': { label: 'New walk-in shower', asset: { kind: 'image', src: '/funnels/bathrooms/scope/walk-in-shower.webp', alt: 'New walk-in shower' } },
          'vanity-fixtures': { label: 'Vanity + fixtures', asset: { kind: 'image', src: '/funnels/bathrooms/scope/vanity-fixtures.webp', alt: 'New vanity and fixtures' } },
          'cosmetic': { label: 'Cosmetic refresh', asset: { kind: 'image', src: '/funnels/bathrooms/scope/cosmetic.webp', alt: 'Cosmetic bathroom refresh' } },
        },
      },
    },
    {
      id: 'accessibility',
      kind: 'card-select',
      optionIds: ['curbless', 'grab-bars', 'not-needed'],
      content: {
        title: 'Any accessibility or safety needs?',
        subtitle: 'Aging-in-place upgrades are one of our specialties.',
        options: {
          'curbless': { label: 'Curbless / walk-in access' },
          'grab-bars': { label: 'Grab bars & safety upgrades' },
          'not-needed': { label: 'Not needed right now' },
        },
      },
    },
    {
      id: 'timeline',
      kind: 'card-select',
      optionIds: ['asap', '1-3', '3-6', 'exploring'],
      content: {
        title: 'When would you want to start?',
        options: {
          'asap': { label: 'ASAP' },
          '1-3': { label: '1–3 months' },
          '3-6': { label: '3–6 months' },
          'exploring': { label: 'Just exploring' },
        },
      },
    },
    ADDRESS_STEP,
    CONFIRMATION_STEP,
  ],
}
