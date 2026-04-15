import type { Customer } from '@/shared/db/schema'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'

export interface ProfileBenefit {
  headline: string
  body: string
  category: 'financial' | 'security' | 'comfort' | 'pride' | 'family' | 'urgency'
}

/**
 * Generates personalized benefit messaging based on customer profile and selected trades.
 * Returns the top 3-4 most resonant benefits for this customer.
 */
export function getProfileBenefits(
  customer: Customer | null,
  tradeSelections: TradeSelection[],
): ProfileBenefit[] {
  const benefits: ProfileBenefit[] = []
  const profile = customer?.customerProfileJSON
  const householdType = profile?.householdType
  const triggerEvent = profile?.triggerEvent
  const outcomePriority = profile?.outcomePriority
  const sellPlan = profile?.sellPlan
  const painPoints = tradeSelections.flatMap(t => t.painPoints)
  const tradeNames = tradeSelections.map(t => t.tradeName.toLowerCase())

  const hasRoofing = tradeNames.some(t => t.includes('roof'))
  const hasInterior = tradeNames.some(t =>
    ['bathroom', 'kitchen', 'flooring', 'painting'].some(e => t.includes(e)),
  )

  // ── Single woman benefits ─────────────────────────────────────────────
  if (householdType === 'Single woman') {
    benefits.push({
      headline: 'A home you\'re proud to come back to',
      body: 'Your home should be your sanctuary — a place you feel proud showing to friends and family. This project transforms it from something you tolerate into something you love.',
      category: 'pride',
    })
    benefits.push({
      headline: 'One trusted team, start to finish',
      body: 'You won\'t need to manage multiple contractors or worry about who\'s on your property. One licensed team, one point of contact, background-checked crews.',
      category: 'security',
    })
  }

  // ── Single man benefits ───────────────────────────────────────────────
  if (householdType === 'Single man') {
    benefits.push({
      headline: 'Get it done right the first time',
      body: 'No second trips, no call-backs, no "we\'ll fix that later." Everything scoped, scheduled, and completed — so you can move on with your life.',
      category: 'comfort',
    })
  }

  // ── Family-focused benefits ───────────────────────────────────────────
  if (householdType === 'Family' || householdType === 'Relatives') {
    benefits.push({
      headline: 'A safer, healthier home for your family',
      body: 'Outdated insulation, leaky windows, and aging systems don\'t just cost money — they affect air quality, comfort, and safety. This project makes your home work for everyone who lives in it.',
      category: 'family',
    })
  }

  // ── Couple benefits ───────────────────────────────────────────────────
  if (householdType === 'Couple') {
    benefits.push({
      headline: 'An investment you both feel good about',
      body: 'Big home decisions work best when both people have the same information. That\'s why we walk through everything together — scope, timeline, cost, and exactly what you\'re getting.',
      category: 'comfort',
    })
  }

  // ── Pain-point driven benefits ────────────────────────────────────────
  if (painPoints.includes('High maintenance / utility costs') || painPoints.includes('Home has inefficiencies')) {
    benefits.push({
      headline: 'Stop bleeding money every month',
      body: 'Every month you wait, the inefficiency costs you. Families in your situation typically see a 30-55% reduction in energy costs after upgrading. The project pays for itself.',
      category: 'financial',
    })
  }

  if (painPoints.includes('Has urgent fixes') || painPoints.includes('Home has physical damages')) {
    benefits.push({
      headline: 'End the damage before it compounds',
      body: 'What starts as a small problem becomes an expensive one. Acting now prevents the kind of secondary damage that doubles project costs — and keeps your home safe in the meantime.',
      category: 'urgency',
    })
  }

  if (painPoints.includes('Had bad past experience')) {
    benefits.push({
      headline: 'This time, it\'s different',
      body: 'We know you\'ve been burned before. Licensed, insured, written scope, dual supervision, and a 5-year warranty — not because we say so, but because we put it in writing before a single nail goes in.',
      category: 'security',
    })
  }

  if (painPoints.includes('Home is not place of rest / comfort')) {
    benefits.push({
      headline: 'Come home to comfort',
      body: 'Your home should be where you recharge — not where you endure drafts, noise, and discomfort. This project changes how your home feels, every single day.',
      category: 'comfort',
    })
  }

  // ── Trigger-event benefits ────────────────────────────────────────────
  if (triggerEvent === 'Selling soon' || sellPlan === 'Yes' || sellPlan === 'Soon') {
    benefits.push({
      headline: 'Maximize your resale value',
      body: 'Buyers notice updated roofs, efficient HVAC, and modern windows. These upgrades don\'t just make your home more sellable — they increase your asking price and reduce time on market.',
      category: 'financial',
    })
  }

  if (triggerEvent === 'High bill') {
    benefits.push({
      headline: 'Your utility bill is the proof',
      body: 'You\'re already paying for this project — you\'re just paying it to the utility company instead. Redirecting that money into a permanent upgrade is the smartest financial move on the table.',
      category: 'financial',
    })
  }

  // ── Outcome priority benefits ─────────────────────────────────────────
  if (outcomePriority === 'Price') {
    benefits.push({
      headline: 'Structured to fit your budget',
      body: 'This isn\'t about spending the most — it\'s about getting the best value. Our program pricing, financing options, and tax credits are designed to make quality work affordable.',
      category: 'financial',
    })
  }

  if (outcomePriority === 'Quality') {
    benefits.push({
      headline: 'Built to the standard you expect',
      body: 'Premium materials, licensed crews, proper supervision, and a warranty that actually means something. You\'re not settling — you\'re investing in work that lasts.',
      category: 'pride',
    })
  }

  if (outcomePriority === 'Speed') {
    benefits.push({
      headline: 'On your timeline, not ours',
      body: 'Most projects complete in 10-14 business days. We schedule crews ahead, order materials in advance, and keep the install window tight — because your time matters.',
      category: 'urgency',
    })
  }

  // ── Trade-specific benefits ───────────────────────────────────────────
  if (hasRoofing && !benefits.some(b => b.category === 'security')) {
    benefits.push({
      headline: '30 years of protection overhead',
      body: 'A new roof isn\'t cosmetic — it\'s the single most important structural investment you can make. Architectural shingles, proper ventilation, and a warranty that covers both materials and labor.',
      category: 'security',
    })
  }

  if (hasInterior && !benefits.some(b => b.category === 'pride')) {
    benefits.push({
      headline: 'Transform how you live at home',
      body: 'These are the spaces you use every day. A bathroom you love, a kitchen that works, floors that feel clean — the impact is immediate and lasting.',
      category: 'pride',
    })
  }

  // Deduplicate by category, keep max 4
  const seen = new Set<string>()
  return benefits.filter((b) => {
    if (seen.has(b.category)) {
      return false
    }
    seen.add(b.category)
    return true
  }).slice(0, 4)
}

const CATEGORY_LABELS: Record<string, string> = {
  comfort: 'Comfort',
  family: 'Family',
  financial: 'Financial',
  pride: 'Pride',
  security: 'Security',
  urgency: 'Urgency',
}

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}
