import type { BenefitLine, BenefitSelection, HomeSystemId } from '@/features/trade-scenes/types'
import type { BenefitKind } from '@/shared/modules/construction/core/constants/benefit-kinds'

import { BENEFITS_COPY, HOME_SYSTEM_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'
import { benefitCount } from '@/features/trade-scenes/lib/benefit-count'
import { formatAsDollars } from '@/shared/lib/formatters'
import { BENEFIT_KIND_LABELS, BENEFIT_KINDS } from '@/shared/modules/construction/core/constants/benefit-kinds'

export interface RailGroup {
  id: HomeSystemId | BenefitKind
  label: string
  lines: BenefitLine[]
}

export interface RailContent {
  // What is picked in plain words: the title, the count, and the saving where there is one.
  header: string
  title: string
  count: string
  savings: string | null
  groups: RailGroup[]
}

// What the rail shows for a selection: a system's lines under its kinds, a kind's under its systems, a dot's as one group.
export function railGroups(lines: readonly BenefitLine[], selection: BenefitSelection, savingNow: number): RailContent {
  const { rail } = BENEFITS_COPY
  const groups: RailGroup[] = selection.type === 'system'
    ? BENEFIT_KINDS.map(kind => ({ id: kind, label: BENEFIT_KIND_LABELS[kind], lines: lines.filter(line => line.system === selection.system && line.kind === kind) }))
    : selection.type === 'kind'
      ? HOME_SYSTEM_IDS.map(system => ({ id: system, label: HOME_SYSTEM_LABELS[system], lines: lines.filter(line => line.system === system && line.kind === selection.kind) }))
      : [{ id: selection.kind, label: BENEFIT_KIND_LABELS[selection.kind], lines: lines.filter(line => line.system === selection.system && line.kind === selection.kind) }]
  const shown = groups.filter(group => group.lines.length > 0)
  const picked = shown.flatMap(group => group.lines)
  const figured = picked.filter((line): line is BenefitLine & { figure: number } => line.figure !== null)
  // Each system's cuts compound on their own, so a kind's lines added up across systems would overstate the build's saving.
  const money = selection.type === 'kind' ? savingNow : figured.reduce((total, line) => total + line.figure, 0)
  const title = selection.type === 'dot'
    ? `${HOME_SYSTEM_LABELS[selection.system]}${rail.join}${BENEFIT_KIND_LABELS[selection.kind]}`
    : selection.type === 'system' ? HOME_SYSTEM_LABELS[selection.system] : rail.across(BENEFIT_KIND_LABELS[selection.kind])
  const count = benefitCount(picked)
  const savings = figured.length > 0 && money > 0 ? rail.savings(formatAsDollars(money)) : null
  return { header: [title, count, ...(savings === null ? [] : [savings])].join(rail.join), title, count, savings, groups: shown }
}
