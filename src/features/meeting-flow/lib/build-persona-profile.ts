import type {
  CustomerPersonaProfile,
  PersonaBenefit,
  PersonaDecisionDriver,
  PersonaEmotionalLever,
  PersonaFear,
  PersonaHouseholdResonance,
  PersonaRiskFactor,
} from '@/shared/entities/customers/persona-profile-schema'
import type { CustomerProfile, FinancialProfile, PropertyProfile } from '@/shared/entities/customers/schemas'
import type { MeetingContext, MeetingFlowState } from '@/shared/entities/meetings/schemas'
import type { NotionPainPoint } from '@/shared/services/notion/lib/pain-points/schema'
import {
  BENEFIT_TEMPLATES,
  EMOTIONAL_LEVER_DESCRIPTIONS,
  FEAR_TEMPLATES,
  HOUSEHOLD_AMPLIFIED_CONCERNS,
  RISK_FACTOR_RULES,
  SEVERITY_WEIGHT,
} from '@/features/meeting-flow/constants/persona-profile-maps'

export interface BuildPersonaProfileInput {
  customerProfile: CustomerProfile | null | undefined
  propertyProfile: PropertyProfile | null | undefined
  financialProfile: FinancialProfile | null | undefined
  meetingContext: MeetingContext | null | undefined
  flowState: MeetingFlowState | null | undefined
  painPointsDb: NotionPainPoint[]
}

// ---- Helpers ----------------------------------------------------------------

function resolveCustomerPainPoints(
  customerProfile: CustomerProfile | null | undefined,
  painPointsDb: NotionPainPoint[],
): NotionPainPoint[] {
  if (!customerProfile) {
    return []
  }

  const accessorMap = new Map(painPointsDb.map(pp => [pp.accessor, pp]))
  const matched: NotionPainPoint[] = []

  if (customerProfile.mainPainPoint?.accessor) {
    const found = accessorMap.get(customerProfile.mainPainPoint.accessor)
    if (found) {
      matched.push(found)
    }
  }

  for (const additional of customerProfile.additionalPainPoints ?? []) {
    if (additional.accessor) {
      const found = accessorMap.get(additional.accessor)
      if (found && !matched.some(m => m.id === found.id)) {
        matched.push(found)
      }
    }
  }

  return matched
}

function getSelectedTradeIds(flowState: MeetingFlowState | null | undefined): Set<string> {
  if (!flowState?.tradeSelections) {
    return new Set()
  }
  return new Set(flowState.tradeSelections.map(ts => ts.tradeId))
}

function getTradeNameById(flowState: MeetingFlowState | null | undefined, tradeId: string): string {
  const selection = flowState?.tradeSelections?.find(ts => ts.tradeId === tradeId)
  return selection?.tradeName ?? 'Unknown'
}

function filterPainPointsByTrade(
  painPoints: NotionPainPoint[],
  selectedTradeIds: Set<string>,
): Array<{ painPoint: NotionPainPoint, matchedTradeIds: string[] }> {
  if (selectedTradeIds.size === 0) {
    return painPoints.map(pp => ({ painPoint: pp, matchedTradeIds: [] }))
  }

  const results: Array<{ painPoint: NotionPainPoint, matchedTradeIds: string[] }> = []

  for (const pp of painPoints) {
    const matchedTradeIds = pp.trades.filter(t => selectedTradeIds.has(t))
    // Include pain points that match selected trades OR have no trade relations (universal)
    if (matchedTradeIds.length > 0 || pp.trades.length === 0) {
      results.push({ painPoint: pp, matchedTradeIds })
    }
  }

  return results
}

// ---- Builders ---------------------------------------------------------------

function buildFears(
  tradeFilteredPainPoints: Array<{ painPoint: NotionPainPoint, matchedTradeIds: string[] }>,
  flowState: MeetingFlowState | null | undefined,
): PersonaFear[] {
  const fears: PersonaFear[] = []

  for (const { painPoint, matchedTradeIds } of tradeFilteredPainPoints) {
    const category = painPoint.category
    if (!category) {
      continue
    }

    const template = FEAR_TEMPLATES[category]
    if (!template) {
      continue
    }

    // Find the best trade-specific fear text
    let fearText = template.generic
    for (const tradeId of matchedTradeIds) {
      const tradeName = getTradeNameById(flowState, tradeId)
      if (template.byTrade[tradeName]) {
        fearText = template.byTrade[tradeName]
        break
      }
    }

    const severity = painPoint.severity === 'variable' ? 'medium' : (painPoint.severity ?? 'medium')
    const primaryDriver = painPoint.emotionalDrivers[0] ?? 'fear'

    fears.push({
      fear: fearText,
      source: painPoint.accessor,
      severity,
      emotionalDriver: primaryDriver,
    })
  }

  // Sort by severity weight descending
  fears.sort((a, b) => (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0))

  return fears
}

function buildBenefits(
  tradeFilteredPainPoints: Array<{ painPoint: NotionPainPoint, matchedTradeIds: string[] }>,
  flowState: MeetingFlowState | null | undefined,
): PersonaBenefit[] {
  const benefits: PersonaBenefit[] = []
  const seen = new Set<string>() // Deduplicate by category + trade

  for (const { painPoint, matchedTradeIds } of tradeFilteredPainPoints) {
    const category = painPoint.category
    if (!category) {
      continue
    }

    const template = BENEFIT_TEMPLATES[category]
    if (!template) {
      continue
    }

    if (matchedTradeIds.length > 0) {
      for (const tradeId of matchedTradeIds) {
        const tradeName = getTradeNameById(flowState, tradeId)
        const key = `${category}::${tradeName}`
        if (seen.has(key)) {
          continue
        }
        seen.add(key)

        benefits.push({
          headline: template.headline,
          body: template.byTrade[tradeName] ?? template.genericBody,
          tradeName,
          category,
        })
      }
    }
    else {
      const key = `${category}::generic`
      if (!seen.has(key)) {
        seen.add(key)
        benefits.push({
          headline: template.headline,
          body: template.genericBody,
          tradeName: 'General',
          category,
        })
      }
    }
  }

  return benefits
}

function buildDecisionDrivers(
  customerProfile: CustomerProfile | null | undefined,
  meetingContext: MeetingContext | null | undefined,
): PersonaDecisionDriver[] {
  const drivers: PersonaDecisionDriver[] = []

  // Timeline
  if (customerProfile?.decisionTimeline === 'ASAP') {
    drivers.push({ driver: 'Decision timeline is immediate', signal: 'decisionTimeline: ASAP', weight: 'strong' })
  }
  else if (customerProfile?.decisionTimeline === '1–3 months') {
    drivers.push({ driver: 'Active decision window — 1-3 months', signal: 'decisionTimeline: 1–3 months', weight: 'moderate' })
  }

  // Project necessity
  if (customerProfile?.projectNecessityRating && customerProfile.projectNecessityRating >= 8) {
    drivers.push({ driver: 'Customer rates project as highly necessary', signal: `projectNecessityRating: ${customerProfile.projectNecessityRating}`, weight: 'strong' })
  }
  else if (customerProfile?.projectNecessityRating && customerProfile.projectNecessityRating >= 5) {
    drivers.push({ driver: 'Customer sees moderate project necessity', signal: `projectNecessityRating: ${customerProfile.projectNecessityRating}`, weight: 'moderate' })
  }

  // Budget comfort
  if (meetingContext?.observedBudgetComfort === 'comfortable') {
    drivers.push({ driver: 'Budget comfort is high — customer is ready to invest', signal: 'observedBudgetComfort: comfortable', weight: 'strong' })
  }

  // DMs present
  if (meetingContext?.decisionMakersPresent === 'All present') {
    drivers.push({ driver: 'All decision makers present — can close today', signal: 'decisionMakersPresent: All present', weight: 'strong' })
  }

  // Observed urgency
  if (meetingContext?.observedUrgency && meetingContext.observedUrgency >= 8) {
    drivers.push({ driver: 'Agent observes high urgency from customer', signal: `observedUrgency: ${meetingContext.observedUrgency}`, weight: 'strong' })
  }

  // Outcome priority
  if (customerProfile?.outcomePriority === 'Quality') {
    drivers.push({ driver: 'Customer prioritizes quality over price — lead with craftsmanship and warranty', signal: 'outcomePriority: Quality', weight: 'moderate' })
  }
  else if (customerProfile?.outcomePriority === 'Speed') {
    drivers.push({ driver: 'Customer prioritizes speed — emphasize scheduling availability and timeline', signal: 'outcomePriority: Speed', weight: 'moderate' })
  }
  else if (customerProfile?.outcomePriority === 'Price') {
    drivers.push({ driver: 'Customer is price-sensitive — use payment framing and ROI justification', signal: 'outcomePriority: Price', weight: 'moderate' })
  }

  // Selling soon
  if (customerProfile?.sellPlan === 'Yes' || customerProfile?.sellPlan === 'Soon') {
    drivers.push({ driver: 'Customer is planning to sell — resale ROI framing is critical', signal: `sellPlan: ${customerProfile.sellPlan}`, weight: 'strong' })
  }

  return drivers
}

function buildEmotionalLevers(
  tradeFilteredPainPoints: Array<{ painPoint: NotionPainPoint, matchedTradeIds: string[] }>,
): PersonaEmotionalLever[] {
  // Count frequency of each emotional driver across all matched pain points
  const driverCounts = new Map<string, number>()
  const totalPainPoints = tradeFilteredPainPoints.length

  for (const { painPoint } of tradeFilteredPainPoints) {
    for (const driver of painPoint.emotionalDrivers) {
      driverCounts.set(driver, (driverCounts.get(driver) ?? 0) + 1)
    }
  }

  // Sort by frequency, then map to levers
  const sorted = [...driverCounts.entries()].sort((a, b) => b[1] - a[1])

  return sorted.map(([driver, count], index) => ({
    lever: driver,
    relevance: index < 2 ? 'primary' as const : 'secondary' as const,
    context: totalPainPoints > 0
      ? `${count} of ${totalPainPoints} pain points trigger ${driver}`
      : EMOTIONAL_LEVER_DESCRIPTIONS[driver as keyof typeof EMOTIONAL_LEVER_DESCRIPTIONS] ?? driver,
  }))
}

function buildHouseholdResonance(
  customerProfile: CustomerProfile | null | undefined,
  tradeFilteredPainPoints: Array<{ painPoint: NotionPainPoint, matchedTradeIds: string[] }>,
): PersonaHouseholdResonance[] {
  const results: PersonaHouseholdResonance[] = []

  // Match customer household type against known amplified concerns
  const householdType = customerProfile?.householdType
  if (householdType && HOUSEHOLD_AMPLIFIED_CONCERNS[householdType]) {
    results.push({
      factor: householdType,
      amplifiedConcerns: HOUSEHOLD_AMPLIFIED_CONCERNS[householdType],
    })
  }

  // Also check Notion pain points' household resonance for additional matches
  const notionResonanceFactors = new Set<string>()
  for (const { painPoint } of tradeFilteredPainPoints) {
    for (const factor of painPoint.householdResonance) {
      // Only add if we haven't already covered it via the customer profile
      if (factor !== householdType) {
        notionResonanceFactors.add(factor)
      }
    }
  }

  // Add Notion-derived resonance factors that match known concerns
  for (const factor of notionResonanceFactors) {
    if (HOUSEHOLD_AMPLIFIED_CONCERNS[factor] && !results.some(r => r.factor === factor)) {
      results.push({
        factor,
        amplifiedConcerns: HOUSEHOLD_AMPLIFIED_CONCERNS[factor],
      })
    }
  }

  return results
}

function buildRiskFactors(
  meetingContext: MeetingContext | null | undefined,
  customerProfile: CustomerProfile | null | undefined,
  financialProfile: FinancialProfile | null | undefined,
): PersonaRiskFactor[] {
  const risks: PersonaRiskFactor[] = []

  if (meetingContext?.observedBudgetComfort === 'resistant') {
    risks.push(RISK_FACTOR_RULES.budgetResistant)
  }

  if (meetingContext?.decisionMakersPresent && meetingContext.decisionMakersPresent !== 'All present') {
    risks.push(RISK_FACTOR_RULES.missingDMs)
  }

  if (meetingContext?.customerDemeanor === 'guarded') {
    risks.push(RISK_FACTOR_RULES.guardedDemeanor)
  }

  if (meetingContext?.customerDemeanor === 'anxious') {
    risks.push(RISK_FACTOR_RULES.anxiousDemeanor)
  }

  if (meetingContext?.spouseDynamic === 'one-skeptical') {
    risks.push(RISK_FACTOR_RULES.skepticalSpouse)
  }

  if (financialProfile?.numQuotesReceived && financialProfile.numQuotesReceived >= 3) {
    risks.push(RISK_FACTOR_RULES.shoppingAround)
  }

  if (customerProfile?.decisionTimeline === '6+ months') {
    risks.push(RISK_FACTOR_RULES.longTimeline)
  }

  if (customerProfile?.projectNecessityRating && customerProfile.projectNecessityRating <= 3) {
    risks.push(RISK_FACTOR_RULES.lowNecessity)
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 }
  risks.sort((a, b) => (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0))

  return risks
}

// ---- Main -------------------------------------------------------------------

export function buildPersonaProfile(input: BuildPersonaProfileInput): CustomerPersonaProfile {
  const { customerProfile, financialProfile, meetingContext, flowState, painPointsDb } = input

  // 1. Resolve customer pain points from Notion DB
  const matchedPainPoints = resolveCustomerPainPoints(customerProfile, painPointsDb)

  // 2. Filter by selected trades
  const selectedTradeIds = getSelectedTradeIds(flowState)
  const tradeFiltered = filterPainPointsByTrade(matchedPainPoints, selectedTradeIds)

  // 3. Build all profile sections
  return {
    fears: buildFears(tradeFiltered, flowState),
    benefits: buildBenefits(tradeFiltered, flowState),
    decisionDrivers: buildDecisionDrivers(customerProfile, meetingContext),
    emotionalLevers: buildEmotionalLevers(tradeFiltered),
    householdResonance: buildHouseholdResonance(customerProfile, tradeFiltered),
    riskFactors: buildRiskFactors(meetingContext, customerProfile, financialProfile),
  }
}
