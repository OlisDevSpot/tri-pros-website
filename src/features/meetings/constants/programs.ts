import type { MeetingProgram, QualificationContext, QualificationResult } from '@/features/meetings/types'
import { isEnergyEfficientTrade } from '@/features/meetings/constants/energy-trades'
import { getCurrentMonth, getInstallSlotsLeft, getMonthEnd } from '@/features/meetings/lib/buy-triggers'

function qualifyMonthlySpecial(): QualificationResult {
  return {
    qualified: true,
    reason: 'All customers qualify for the monthly priority program.',
    matchedCriteria: ['Active customer'],
    missedCriteria: [],
  }
}

function qualifyEnergySaver(ctx: QualificationContext): QualificationResult {
  const energyTrades = ctx.tradeSelections.filter(t => isEnergyEfficientTrade(t.tradeId))
  if (energyTrades.length === 0) {
    return {
      qualified: false,
      reason: 'Requires at least 1 energy-efficient trade (Insulation, HVAC, Windows, or Solar).',
      matchedCriteria: [],
      missedCriteria: ['Energy-efficient trade selected'],
    }
  }
  return {
    qualified: true,
    reason: `Qualified — ${energyTrades.length} energy-efficient trade${energyTrades.length > 1 ? 's' : ''} selected.`,
    matchedCriteria: energyTrades.map(t => t.tradeName),
    missedCriteria: [],
  }
}

function qualifyExistingCustomer(ctx: QualificationContext): QualificationResult {
  if (ctx.meetingType === 'Rehash' || ctx.meetingType === 'Follow-up') {
    return {
      qualified: true,
      reason: 'Returning customer — eligible for loyalty benefits.',
      matchedCriteria: ['Returning customer'],
      missedCriteria: [],
    }
  }
  return {
    qualified: false,
    reason: 'Available for returning Tri Pros customers only.',
    matchedCriteria: [],
    missedCriteria: ['Prior completed project with TPR'],
  }
}

export const MEETING_PROGRAMS: MeetingProgram[] = [
  {
    accessor: 'tpr-monthly-special',
    name: `TPR ${getCurrentMonth()} Priority Program`,
    tagline: `Lock in ${getCurrentMonth()} pricing before ${getMonthEnd()}.`,
    accentColor: 'amber',
    qualify: qualifyMonthlySpecial,
    expiresLabel: getMonthEnd(),
    incentives: [
      {
        id: 'material-upgrade',
        label: 'Architectural Shingle Upgrade',
        description: 'Standard 3-tab shingles upgraded to premium architectural shingles — included at the same price.',
        valueDisplay: '$800 value',
        valueType: 'fixed',
        calculateDeduction: () => 800,
      },
      {
        id: 'warranty-extension',
        label: '5-Year Workmanship Warranty',
        description: 'Standard warranty extended from 3 years to 5 years on all workmanship.',
        valueDisplay: '$400 value',
        valueType: 'fixed',
        calculateDeduction: () => 400,
      },
      {
        id: 'attic-inspection',
        label: 'Free Attic Inspection',
        description: 'A licensed inspector walks your attic before installation — documenting ventilation, insulation levels, and any moisture or pest issues.',
        valueDisplay: '$200 value',
        valueType: 'fixed',
        calculateDeduction: () => 200,
      },
    ],
    presentation: {
      story: `Every few months, we negotiate a bulk materials contract with our SoCal suppliers. Right now, in ${getCurrentMonth()}, we have a contract in place — and we're passing those savings directly to families who schedule this month. This isn't a manufactured promotion. It's a real capacity window.`,
      history: 'Tri Pros has been serving Southern California homeowners for over a decade. Our relationships with local suppliers allow us to offer structured incentive windows that benefit families who are ready to move forward.',
      timeline: `Sign this month → Install coordinator calls within 24 hours → Crew on-site within 3-4 weeks → Most projects complete in 10-14 business days. Program expires ${getMonthEnd()}.`,
      faqs: [
        { question: 'Is this a real discount or a sales tactic?', answer: 'This is a structured incentive based on our current supplier contract. The material upgrade, warranty extension, and inspection are real line items with real value. When the contract period ends, so does the package.' },
        { question: 'What if I\'m not ready to start this month?', answer: 'You can lock in the pricing by signing this month and schedule the install within your preferred window. The incentive is tied to the agreement date, not the start date.' },
        { question: 'Can I combine this with other programs?', answer: 'The Monthly Priority Package is standalone. However, if you qualify for Energy Saver+ incentives (IRA tax credits, utility rebates), those stack on top.' },
      ],
      keyStats: [
        { label: 'Install slots remaining', value: `${getInstallSlotsLeft()}` },
        { label: 'Package value', value: '$1,400' },
        { label: 'Avg. project timeline', value: '10-14 days' },
      ],
    },
  },
  {
    accessor: 'energy-saver-plus',
    name: 'Energy Saver+ Program',
    tagline: 'Turn your monthly utility bill into a monthly savings check.',
    accentColor: 'sky',
    qualify: qualifyEnergySaver,
    expiresLabel: 'Annual program — caps reset yearly',
    incentives: [
      {
        id: 'ira-25c-credit',
        label: 'IRA Section 25C Tax Credit',
        description: 'Federal tax credit of $1,200 for qualifying insulation installation or window/sliding door replacement. Applied at tax time — not a deduction from TCP.',
        valueDisplay: '$1,200 (noted)',
        valueType: 'credit',
        calculateDeduction: () => 0,
      },
      {
        id: 'energy-audit',
        label: 'Free Energy Audit',
        description: 'Comprehensive assessment of your home\'s energy performance before any work begins.',
        valueDisplay: 'Included',
        valueType: 'fixed',
        calculateDeduction: () => 0,
      },
    ],
    presentation: {
      story: 'Most homes in Southern California lose between $100 and $250 every month through poor insulation, leaky windows, and inefficient HVAC systems. That\'s not a comfort problem — that\'s a money problem. The good news: it\'s fixable, and a significant portion of the fix can be covered by federal programs.',
      history: 'The Inflation Reduction Act of 2022 created the largest residential energy incentive program in U.S. history. Tri Pros has helped hundreds of SoCal families access these credits since the program launched.',
      timeline: 'Energy audit → Scope finalization → Install within 3-4 weeks → Tax credit applied at next filing.',
      faqs: [
        { question: 'How do I know if I qualify for the tax credit?', answer: 'The $1,200 IRA Section 25C credit applies to qualifying insulation installation or window/sliding door replacement in your primary residence. We help you document everything for your tax preparer.' },
        { question: 'Is the tax credit deducted from my price?', answer: 'No — the tax credit is applied when you file your taxes, not deducted from the contract price. It\'s a separate benefit on top of your project.' },
        { question: 'How much will I actually save on my bill?', answer: 'Most families see a 30-55% reduction in heating and cooling costs. The exact number depends on your current insulation, HVAC efficiency, and window condition — which the energy audit quantifies.' },
      ],
      keyStats: [
        { label: 'Avg. bill reduction', value: '30-55%' },
        { label: 'IRA 25C credit', value: '$1,200' },
        { label: 'Qualifying scopes', value: 'Insulation, Windows' },
      ],
    },
  },
  {
    accessor: 'existing-customer-savings-plus',
    name: 'Existing Customer Savings+',
    tagline: 'You already trust us. Now let us reward that.',
    accentColor: 'violet',
    qualify: qualifyExistingCustomer,
    expiresLabel: `${getCurrentMonth()} loyalty window`,
    incentives: [
      {
        id: 'loyalty-discount',
        label: '20% Loyalty Discount',
        description: 'Applied to standard labor rates — exclusively for returning customers.',
        valueDisplay: '20% off labor',
        valueType: 'percentage',
        calculateDeduction: (tcp: number) => Math.round(tcp * 0.2 * 0.4),
      },
      {
        id: 'priority-scheduling',
        label: 'Priority Scheduling',
        description: 'Your project goes on the calendar before new customer inquiries.',
        valueDisplay: 'Priority access',
        valueType: 'fixed',
        calculateDeduction: () => 0,
      },
      {
        id: 'vip-warranty',
        label: 'VIP Warranty Extension',
        description: '2 additional years on workmanship warranty — beyond standard coverage.',
        valueDisplay: '+2 years',
        valueType: 'fixed',
        calculateDeduction: () => 0,
      },
      {
        id: 'no-mobilization',
        label: 'No Mobilization Fee',
        description: 'Crew mobilization fee waived for returning customers.',
        valueDisplay: 'Waived',
        valueType: 'fixed',
        calculateDeduction: () => 500,
      },
    ],
    presentation: {
      story: 'You already know how we work. You\'ve seen the quality firsthand, you know our crews are clean and professional, and you know we back our work. Today isn\'t a sales call — it\'s a planning conversation.',
      history: 'Our returning customer program was built because the families who come back are the families we most want to serve. Every repeat project strengthens the relationship and lets us offer better terms.',
      timeline: 'Same-day proposal → Priority scheduling (within days, not weeks) → Same crew when possible → VIP warranty kicks in automatically.',
      faqs: [
        { question: 'Do I automatically get loyalty pricing?', answer: 'Yes — any customer with a prior completed Tri Pros project qualifies. The discount applies to all labor on your next project.' },
        { question: 'Can I request the same crew?', answer: 'We prioritize crew continuity for returning customers. If your original crew is available, they\'re assigned first.' },
        { question: 'Does this stack with other programs?', answer: 'The loyalty discount is standalone. However, if your new project includes energy-efficient upgrades, you may also qualify for IRA tax credits independently.' },
      ],
      keyStats: [
        { label: 'Returning families (2024)', value: '47' },
        { label: 'Avg. loyalty savings', value: '$3,200' },
        { label: 'Crew continuity rate', value: '85%' },
      ],
    },
  },
]

export function getProgramByAccessor(accessor: string): MeetingProgram | undefined {
  return MEETING_PROGRAMS.find(p => p.accessor === accessor)
}
