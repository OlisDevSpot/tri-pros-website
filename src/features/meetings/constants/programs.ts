import type { MeetingContext, MeetingProgram } from '@/features/meetings/types'
import { getCurrentMonth, getInstallSlotsLeft, getMonthEnd } from '@/features/meetings/lib/buy-triggers'
import { meetingDecisionTimelines, meetingYearsInHome } from '@/shared/constants/enums'

const month = getCurrentMonth()
const monthEnd = getMonthEnd()
const slotsLeft = getInstallSlotsLeft()

export const MEETING_PROGRAMS: MeetingProgram[] = [
  {
    accentColor: 'amber',
    forWho: 'New customers, any trade',
    accessor: 'tpr-monthly-special',
    name: `TPR ${month} Priority Program`,
    signals: [
      'First visit with Tri Pros',
      'Roofing, insulation, windows, or HVAC',
      `Ready to move forward this month`,
      'Wants incentive pricing locked in today',
    ],
    steps: [
      // ── Step 1: Why This Month ──────────────────────────────────────
      {
        accessor: 'why-this-month',
        shortLabel: 'Timing',
        title: 'Why This Month',
        headline: 'You reached out at exactly the right time.',
        body: `Every few months, we negotiate a bulk materials contract with our SoCal suppliers. Right now, in ${month}, we have a contract in place with our roofing and insulation supplier — and we're passing those savings directly to families who schedule this month.\n\nThis isn't a manufactured promotion. It's a real capacity window — we have ${slotsLeft} install slots open before ${monthEnd}, and we're filling them with customers who qualify for this program.\n\nYou reached out at the perfect time. Here's why that matters.`,
        buyTrigger: {
          message: `${month} Priority Program ends ${monthEnd} — ${slotsLeft} install slots remaining`,
          type: 'urgency',
        },
        caseStudy: {
          context: '22-year-old roof with an active leak in the master bedroom. Summer AC bills averaging $320/month.',
          location: 'Whittier, CA',
          name: 'The Ramirez Family',
          quote: `"We'd been putting this off for two years. Wish we hadn't waited."`,
          results: [
            'Roof replaced — passed city inspection and HOA review',
            'Energy bill dropped $130/month after insulation upgrade',
            'Applied IRA 25C credit — received $2,800 back at tax time',
          ],
        },
        collectsData: [
          {
            id: 'scope',
            jsonbKey: 'programDataJSON',
            label: 'Scope they\'re interested in',
            placeholder: 'e.g. Roof replacement + attic insulation',
            required: true,
            type: 'text',
          },
          {
            id: 'yrs',
            jsonbKey: 'programDataJSON',
            label: 'Years in this home',
            options: meetingYearsInHome,
            type: 'select',
          },
        ],
      },

      // ── Step 2: What's Included ─────────────────────────────────────
      {
        accessor: 'package',
        shortLabel: 'Package',
        title: `${month} Priority Package`,
        headline: `Here's exactly what's in the ${month} package — priced, defined, and in writing.`,
        body: `The ${month} Priority Package is not a discount. It's a structured incentive package we've built around three specific benefits we can offer this month because of our current supplier contract.\n\n**What's included:**\n• Material upgrade: standard 3-tab shingles → premium architectural shingles at the same price ($800 value)\n• Warranty extension: standard 3-year → 5-year workmanship warranty ($400 value)\n• Free attic inspection with any roof scope ($200 value)\n\nTotal package value: $1,400 — included at no additional cost for families who sign this month.\n\nThis also stacks with federal IRA Section 25C tax credits for qualifying energy upgrades (HVAC, insulation, windows) — up to 30% back, and the LADWP Home Upgrade rebate program is currently open (up to $3,000 for qualifying improvements).`,
        buyTrigger: {
          message: `Only ${slotsLeft} ${month} Priority slots remaining — package expires ${monthEnd}`,
          type: 'scarcity',
        },
        caseStudy: {
          context: '18-year-old roof with visible granule loss and 8 windows leaking condensation. Both handled in one mobilization.',
          location: 'Cerritos, CA',
          name: 'The Gutierrez Family',
          quote: `"I kept thinking I had to choose between the roof and the windows. Turns out I didn't."`,
          results: [
            'Complete roof replacement + 8 window upgrades — single crew mobilization',
            'Monthly payment: $198 over 180 months',
            'Saved $780 vs. scheduling separately — one permit, one inspection',
          ],
        },
        collectsData: [
          {
            id: 'timeline',
            jsonbKey: 'programDataJSON',
            label: 'When they want to move forward',
            options: meetingDecisionTimelines,
            type: 'select',
          },
          {
            id: 'bill',
            jsonbKey: 'programDataJSON',
            label: 'Current monthly energy bill (optional)',
            placeholder: 'e.g. $220',
            type: 'text',
          },
        ],
      },

      // ── Step 3: The Numbers ─────────────────────────────────────────
      {
        accessor: 'numbers',
        shortLabel: 'Financing',
        title: 'The Numbers',
        headline: 'Less than a car payment. For permanent results.',
        body: `Let's talk about what this investment looks like month to month.\n\nWe work with GreenSky, a home improvement financing specialist. At 9.99% APR:\n\n• 180-month term (15 years): most projects run $140–$220/month\n• 120-month term (10 years): slightly higher monthly, paid off faster\n\nWe also have an 18-month same-as-cash option — 0% interest if paid in full before month 19. Families with available cash or a home equity line use this to avoid interest entirely.\n\nFor qualifying energy upgrades (HVAC, insulation, windows), the federal IRA Section 25C credit gives you 30% back at tax time. On a $12,000 insulation + HVAC project, that's $3,600 directly back to you. The monthly payment drops accordingly.\n\nThe ${month} Priority Package reduces your starting cost by $1,400 — which lowers your monthly payment before financing even begins.`,
        buyTrigger: {
          message: '5-year workmanship warranty · Licensed CA Contractor · $2M insured',
          type: 'risk-reduction',
        },
        caseStudy: {
          context: 'Running AC 12+ hours/day during summer. Average utility bill: $290/month.',
          location: 'Downey, CA',
          name: 'The Kim Family',
          quote: `"The AC barely runs now. In August. In Downey."`,
          results: [
            'Insulation upgraded — electric bill dropped $95/month',
            'Applied IRA 25C credit: $1,400 back at tax time',
            'Monthly payment: $160 over 120 months — paid off in 10 years',
          ],
        },
      },

      // ── Step 4: Success Stories ─────────────────────────────────────
      {
        accessor: 'stories',
        shortLabel: 'Stories',
        title: 'Homes Like Yours',
        headline: 'Three Southern California families. Three decisions like the one you\'re making today.',
        body: `**The Ramirez Family — Whittier, CA**\nRoofing + insulation. 22-year-old roof with an active leak. Summer bills at $320/month. They replaced the roof, added attic insulation, and received $2,800 back at tax time via the IRA 25C credit. Their energy bill dropped $130/month. "We'd been putting this off for two years. Wish we hadn't waited."\n\n**The Gutierrez Family — Cerritos, CA**\nRoofing + windows. 18-year-old roof and 8 leaking double-pane windows. One mobilization, one permit, one inspection. Monthly payment: $198. "I kept thinking I had to choose between the roof and the windows. Turns out I didn't."\n\n**The Kim Family — Downey, CA**\nInsulation + HVAC service. Running AC 12+ hours a day, $290/month in summer bills. After insulation: electric bill dropped $95/month. IRA credit: $1,400 back. Monthly payment: $160 over 10 years. "The AC barely runs now. In August. In Downey."`,
        buyTrigger: {
          message: '500+ Southern California projects completed · 98% customer satisfaction',
          type: 'social-proof',
        },
        caseStudy: {
          context: 'All three families were first-time TPR customers. All three signed same day.',
          location: 'Southern California',
          name: 'Pattern: SoCal Families',
          quote: `"It felt like the whole program was built for our situation. Because it kind of was."`,
          results: [
            'Average install timeline: 3–4 weeks from signing',
            'Average IRA credit received: $1,800–$2,800',
            'All three referred at least one neighbor within 6 months',
          ],
        },
      },

      // ── Step 5: Your Situation (Personalized) ──────────────────────
      {
        accessor: 'your-home',
        shortLabel: 'Yours',
        title: 'Your Situation',
        headline: 'Your home. Your numbers. Your timeline.',
        headlineFn: (ctx: MeetingContext) => {
          const firstName = ctx.customer?.name.split(' ')[0]
          return firstName
            ? `${firstName}'s home. ${firstName}'s numbers. ${firstName}'s timeline.`
            : 'Your home. Your numbers. Your timeline.'
        },
        body: `Every home in Southern California has the same underlying challenge: aging materials, rising energy costs, and a project that keeps getting pushed to "next month." Let's make this specific to your situation.\n\nBased on everything we've covered today, here's exactly what your project looks like — the scope, the cost, the timeline, and why this month is the right financial decision for your family.`,
        bodyFn: (ctx: MeetingContext) => {
          const firstName = ctx.customer?.name.split(' ')[0] ?? null
          const city = ctx.customer?.city ? `in ${ctx.customer.city}` : 'in your area'
          const { bill, dmsPresent, scope, timeline, triggerEvent, yrs } = ctx.collectedData

          const hasContext = firstName || scope || triggerEvent || timeline || yrs || bill

          if (!hasContext) {
            return `Every home in Southern California has the same underlying challenge: aging materials, rising energy costs, and a project that keeps getting pushed to "next month." Let's make this specific to your situation.\n\nBased on everything we've covered today, here's exactly what your project looks like — the scope, the cost, the timeline, and why this month is the right financial decision for your family.`
          }

          const name = firstName ?? 'you'
          let body = `${firstName ? `${firstName}` : 'Here'}'s what this looks like for your home ${city}.\n\n`

          if (scope) {
            body += `The scope you're looking at — ${scope} — is exactly what the ${month} Priority Program was designed for. The incentive package applies directly to this work, and this month's supplier contract means you're getting material pricing we can't guarantee next month.\n\n`
          }

          if (triggerEvent && triggerEvent !== 'Other') {
            body += `You mentioned ${triggerEvent.toLowerCase()}. That ongoing problem has a real cost — not just the visible damage, but the energy loss, the risk of it getting worse, and the stress of knowing it needs to happen. The cost of not acting isn't zero.\n\n`
          }

          if (timeline === 'ASAP') {
            body += `You said ASAP. Good — we have ${slotsLeft} install slots open this month. We can have a crew on your property within 3–4 weeks of signing, and most projects wrap in 10–14 business days.\n\n`
          }
          else if (timeline === '1–3 months') {
            body += `You said 1–3 months. We can lock in ${month} pricing now and schedule within your window. No rush, no pressure — the incentive is yours when you sign today.\n\n`
          }
          else if (timeline && timeline !== 'Not sure') {
            body += `You said ${timeline.toLowerCase()}. You have time to plan, but the ${month} Priority Package expires ${monthEnd}. Locking it in now keeps your options open without committing to a start date today.\n\n`
          }

          if (bill) {
            body += `At ${bill}/month in energy costs, a qualifying upgrade pays for itself faster than most families expect — especially with the 30% IRA credit stacking on top. The math works strongly in your favor.\n\n`
          }

          if (yrs) {
            body += `After ${yrs} in this home, you know its rhythms. You've earned the right to a house that performs the way you want it to. This is the moment to make that permanent.`
          }
          else {
            body += `The cost of waiting isn't zero — it's the ongoing drain of the problem, month after month. Today is how you end it.`
          }

          if (dmsPresent === 'Primary only' || dmsPresent === 'Partner on phone') {
            body += `\n\nOne thing worth noting: if there are other decision-makers who weren't here today, we can hold your slot and pricing for 48 hours while you loop them in. Just let me know.`
          }

          // Replace "you" with name for more personal feel when firstName known
          if (firstName && name !== 'you') {
            body = body.replace(/\byou've\b/g, `${firstName}, you've`)
          }

          return body
        },
        buyTrigger: {
          message: `${month} Priority Package · ${slotsLeft} slots remaining · Expires ${monthEnd}`,
          type: 'authority',
        },
        caseStudy: {
          context: 'Personalized proposal built on-site using the customer\'s actual scope and timeline.',
          location: 'Cerritos, CA',
          name: 'The Gutierrez Family',
          quote: `"It felt like the whole program was built for our situation. Because it kind of was."`,
          results: [
            'Scope matched exactly to their home\'s actual condition',
            'Financing term chosen based on their stated budget',
            'Installed 3 weeks after signing — complete before end of month',
          ],
        },
      },

      // ── Step 6: What's Next ─────────────────────────────────────────
      {
        accessor: 'close',
        shortLabel: 'Close',
        title: `What's Next`,
        headline: 'The next step takes 5 minutes. The result lasts decades.',
        body: `Here's a summary of everything we've covered:\n\n• Scope: Roofing, insulation, windows, and qualifying HVAC upgrades — all eligible this month\n• Incentive: ${month} Priority Package — architectural shingle upgrade + 5-year warranty + free attic inspection ($1,400 combined value)\n• Financing: 9.99% APR via GreenSky — 180-month or 120-month terms. 18-month same-as-cash available.\n• Tax credit: 30% IRA Section 25C credit for qualifying energy upgrades — applied at tax time\n• Timeline: Install within 3–4 weeks of signing. Most projects complete in 10–14 business days.\n• Expiration: ${monthEnd}\n\nWe'll build your proposal right now. It takes about 5 minutes — your name, address, scope confirmation, and financing preference. Our install coordinator calls you within 24 hours to schedule your start date.\n\nReady?`,
        buyTrigger: {
          message: `${month} Priority Package expires ${monthEnd} — build your proposal now`,
          type: 'urgency',
        },
        caseStudy: {
          context: 'Called on the 23rd. Signed the same day. On the calendar the next morning.',
          location: 'Bellflower, CA',
          name: 'The Ramirez Family',
          quote: `"I thought the paperwork would take forever. It was literally 5 minutes. We were scheduled the next day."`,
          results: [
            'Proposal built in under 10 minutes',
            'Scheduled within 24 hours of signing',
            'Complete roof replacement + attic inspection — done before end of month',
          ],
        },
      },
    ],
    tagline: `Lock in ${month} pricing before ${monthEnd} — only ${slotsLeft} install slots remaining.`,
  },
  {
    accentColor: 'sky',
    forWho: 'Homeowners with high utility bills or comfort issues',
    accessor: 'energy-saver',
    name: 'Energy-Saver Incentive Program',
    signals: [
      'High monthly utility bills ($200+/month)',
      'Rooms that are too hot, too cold, or drafty',
      'Older HVAC, windows, or minimal insulation',
      'Interested in government rebates or tax credits',
    ],
    steps: [
      {
        body: `Most homes in Southern California lose between $100 and $250 every month through poor insulation, leaky windows, and inefficient HVAC systems.\n\nThat's not a comfort problem. That's a money problem — and it's been running in the background since the day you moved in.\n\nThe good news: it's fixable. And a significant portion of the fix can be covered by federal and state programs.`,
        buyTrigger: {
          message: 'Every month you wait costs money — the problem is ongoing',
          type: 'urgency',
        },
        caseStudy: {
          context: 'AC running 14 hours/day in summer. $320/month average utility bill.',
          location: 'Pomona, CA',
          name: 'The Williams Family',
          quote: `"I knew we were spending a lot on AC. I didn't realize our insulation was basically nonexistent until the audit."`,
          results: [
            'Utility bill averaged $320/month before the project',
            'Identified 3 sources of air loss in a 20-minute walkthrough',
            'Moved forward the same week',
          ],
        },
        headline: `Your home is spending money every month it doesn't have to.`,
        accessor: 'problem',
        title: 'The Problem',
      },
      {
        body: `We don't patch one thing and leave. We address the full energy envelope: attic insulation, window sealing or replacement, and HVAC tune-up or upgrade.\n\nThe reason this works is compounding: each upgrade multiplies the effect of the others. Better insulation makes HVAC more efficient. Better windows reduce radiant heat gain. Together, families see 30–55% reductions in heating and cooling costs.\n\nOne contractor. One mobilization. One invoice.`,
        buyTrigger: {
          message: 'Licensed CA contractor · $2M insured · HERS-certified auditor',
          type: 'authority',
        },
        caseStudy: {
          context: 'Attic insulation + window replacement + HVAC service. One project.',
          location: 'Diamond Bar, CA',
          name: 'The Chen Family',
          quote: `"We had three companies come out before and they all wanted to do just one thing. Tri Pros looked at the whole picture."`,
          results: [
            'Utility bill dropped from $290/mo to $155/mo',
            'All three upgrades completed in a single 4-day mobilization',
            'Home comfort noticeably improved within the first week',
          ],
        },
        headline: 'Three upgrades. One story. Dramatically lower bills.',
        accessor: 'solution',
        title: 'The Solution',
      },
      {
        body: `Right now, several programs are paying homeowners to make exactly these upgrades.\n\nThe federal Inflation Reduction Act provides up to $3,200 in annual tax credits for energy-efficient home improvements. LADWP and SoCalGas run rebate programs on top of that. Combined, qualifying families can offset 25–45% of project cost.\n\nThese programs have annual caps and sunset dates. When they fill up, they're gone.`,
        buyTrigger: {
          message: 'Federal + utility rebate programs have annual caps — first-come, first-served',
          type: 'scarcity',
        },
        caseStudy: {
          context: 'Combined IRA tax credit + LADWP rebate covered 42% of the project.',
          location: 'Montebello, CA',
          name: 'The Hernandez Family',
          quote: `"I was skeptical about the rebates. Our tax preparer confirmed we qualified for the full IRA credit. It changed the math completely."`,
          results: [
            'IRA tax credit: $1,800',
            'LADWP rebate: $600',
            'Net project cost reduced by 42% after credits applied',
          ],
        },
        headline: 'Federal and state programs pay for part of this.',
        accessor: 'government',
        title: 'What the Government Covers',
      },
      {
        body: `Let's look at the actual numbers side by side.\n\nBefore: average $280/month in cooling and heating costs, plus the comfort issues that don't show up on a bill.\n\nAfter: average $155/month — a reduction of $125/month or $1,500/year.\n\nAt typical financing terms, the monthly payment on this project runs $180–$220. Within 8–10 months after install, the utility savings cover the payment. After that, you're ahead every month.`,
        buyTrigger: {
          message: 'Workmanship warranty + 5-year manufacturer coverage on all equipment',
          type: 'risk-reduction',
        },
        caseStudy: {
          context: 'Before: $340/mo in utilities. After: $190/mo. Project paid for itself in 8 months.',
          location: 'La Puente, CA',
          name: 'The Thompson Family',
          quote: `"Month 8 post-install, the savings covered the full monthly payment. Month 9, we were making money."`,
          results: [
            'Utility bill: $340/mo → $190/mo (44% reduction)',
            'Monthly payment: $215 over 60 months',
            'Break-even: 8 months post-install',
          ],
        },
        headline: 'Before vs. after — side by side.',
        accessor: 'math',
        title: 'Your Monthly Math',
      },
      {
        body: `Here's the part most people don't factor in: these programs change.\n\nThe LADWP rebate program hit its 2024 cap in October — three months before the federal program renewed. Families who waited missed $600 they were entitled to.\n\nThe IRA credits are currently scheduled through 2032, but utility rebate programs reset and cap annually. The best time to apply incentives is before they adjust.\n\nMoving forward this month is the right financial decision.`,
        buyTrigger: {
          message: `${month} rebate window open — start the application before caps fill`,
          type: 'urgency',
        },
        caseStudy: {
          context: 'Waited 2 months to decide. LADWP rebate program hit its cap in the meantime.',
          location: 'El Monte, CA',
          name: 'The Garcia Family',
          quote: `"We waited two months, then the rebate disappeared. I wish we had moved when the numbers first made sense."`,
          results: [
            'Missed $600 LADWP rebate due to program cap',
            'Still moved forward — savings justified the project regardless',
            'Project completed; utility savings on track with projections',
          ],
        },
        headline: 'These programs have deadlines. Here is why this month matters.',
        accessor: 'why-now',
        title: 'Why Now',
      },
    ],
    tagline: 'Turn your monthly utility bill into a monthly savings check.',
  },
  {
    accentColor: 'violet',
    forWho: 'Returning Tri Pros customers',
    accessor: 'existing-customer-savings-plus',
    name: 'Existing Customer Savings+',
    signals: [
      'Had previous work done with Tri Pros',
      'Ready for next phase or additional scope',
      'Wants loyalty pricing and priority scheduling',
      'Trusts the process — already knows our quality',
    ],
    steps: [
      {
        body: `You already know how we work. You've seen the quality firsthand, you know our crews are clean and professional, and you know we back our work.\n\nSo today isn't a sales call — it's a planning conversation. We want to show you what's new since your last project: new material options, new programs, and a loyalty structure we've built specifically for families like yours.`,
        buyTrigger: {
          message: 'Existing customer priority: guaranteed crew availability + no mobilization fee',
          type: 'authority',
        },
        caseStudy: {
          context: 'First project: kitchen remodel in 2022. Back for the master bathroom.',
          location: 'Torrance, CA',
          name: 'The Nakamura Family',
          quote: `"Coming back was easy. We knew what to expect. The new pricing made it an even easier yes than the first time."`,
          results: [
            'Master bath completed 2 years after the kitchen',
            'Loyalty discount applied: saved $1,950',
            'Same crew from the first project',
          ],
        },
        headline: 'You already know what we do. Here is what is new.',
        accessor: 'welcome-back',
        title: 'Welcome Back',
      },
      {
        body: `Two things have changed since your last project that directly benefit you.\n\nFirst, we've added new supplier relationships — including direct accounts with two premium quartz and cabinet manufacturers that weren't available before. That translates to 20–30% better material pricing on most kitchen and bath scopes.\n\nSecond, we've launched the Savings+ program specifically for returning customers — with loyalty discounts, priority scheduling, and enhanced warranty coverage that new customers don't have access to.`,
        buyTrigger: {
          message: '6 families returned for Phase 2 in the last 90 days — the pattern is clear',
          type: 'social-proof',
        },
        caseStudy: {
          context: 'Second project: same home, bathroom addition. 30% better material pricing than first project.',
          location: 'Hawthorne, CA',
          name: 'The Reyes Family',
          quote: `"The quartz for the bathroom was significantly better quality than what we could have gotten three years ago, and it cost less. That was a surprise."`,
          results: [
            'Material pricing: 28% below their 2021 kitchen project costs',
            'New quartz selection: 40% wider than previous catalog',
            'Project delivered $3,100 under original estimate',
          ],
        },
        headline: 'New scopes. New incentives. Better pricing than before.',
        accessor: 'whats-changed',
        title: `What's Changed`,
      },
      {
        body: `As an existing Tri Pros customer, you qualify for benefits we extend privately:\n\n• 20% loyalty discount off standard labor rates\n• Priority scheduling — your project goes on the calendar before new inquiries\n• VIP warranty extension — 2 additional years on workmanship, beyond our standard coverage\n• No mobilization fee on your next project\n\nThese benefits don't appear on our website and aren't offered at first appointments. They're exclusively for families who already know us.`,
        buyTrigger: {
          message: 'Loyalty benefits are available this month — they apply to projects started now',
          type: 'scarcity',
        },
        caseStudy: {
          context: 'Third project with Tri Pros. Applied loyalty pricing + priority scheduling.',
          location: 'Inglewood, CA',
          name: 'The Brown Family',
          quote: `"The VIP warranty extension sealed it for me. Five years of coverage on a $28,000 project — that's real peace of mind."`,
          results: [
            '20% loyalty discount saved $4,200 on labor',
            'Scheduled within 3 days (vs. 3-week backlog for new customers)',
            'VIP warranty: 7 years total workmanship coverage',
          ],
        },
        headline: `As an existing customer, you get things we can't offer publicly.`,
        accessor: 'benefits',
        title: 'Your Exclusive Benefits',
      },
      {
        body: `Based on what we know about your home — and what you've already completed — here's what makes the most sense for Phase 2.\n\nEvery home has a natural upgrade sequence. The work you've already done created the foundation. The next logical scope delivers the biggest visible impact relative to investment.\n\nWe'll look at that scope together and build the plan around your priorities and timeline.`,
        buyTrigger: {
          message: 'No-risk proposal: zero obligation to proceed after reviewing the numbers',
          type: 'risk-reduction',
        },
        caseStudy: {
          context: 'Phase 1: kitchen remodel. Phase 2: master suite — the project they always wanted.',
          location: 'Compton, CA',
          name: 'The Lee Family',
          quote: `"The kitchen was Phase 1. The master suite was always the dream. When they showed us how Phase 2 would look with the loyalty pricing, we knew it was time."`,
          results: [
            'Master suite: bedroom + bath + custom closet',
            'Loyalty pricing reduced Phase 2 cost by $5,600 vs. new-customer rate',
            'Complete in 14 business days',
          ],
        },
        headline: `The next logical upgrade based on what we've done.`,
        accessor: 'whats-next',
        title: `What's Next for Your Home`,
      },
      {
        body: `You've already done this. You know how our crew works, you know what the process looks like, and you know how the project turns out.\n\nThe paperwork is the same. The process is the same. The outcome is the same — except this time, you're getting loyalty pricing, priority scheduling, and extended warranty coverage on top.\n\nThis is the easiest yes you'll ever make.`,
        buyTrigger: {
          message: `Loyalty pricing + priority scheduling guaranteed if started in ${month}`,
          type: 'urgency',
        },
        caseStudy: {
          context: 'Second project. Zero hesitation. Signed the same day.',
          location: 'Culver City, CA',
          name: 'The Davis Family',
          quote: `"First time I was nervous — normal for anyone spending that kind of money. Second time? I just asked where to sign. We already knew."`,
          results: [
            'Second project signed in under 20 minutes',
            'Installed in 9 business days',
            'Currently planning a third phase',
          ],
        },
        headline: `You've done this before. You know how it goes.`,
        accessor: 'close',
        title: 'The Easiest Yes',
      },
    ],
    tagline: 'You already trust us. Now let us reward that.',
  },
]

export function getProgramByAccessor(accessor: string): MeetingProgram | undefined {
  return MEETING_PROGRAMS.find(p => p.accessor === accessor)
}

export function resolveProgramName(program: MeetingProgram): string {
  return program.name
}
