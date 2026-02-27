import type { LucideIcon } from 'lucide-react'
import type { IconType } from 'react-icons/lib'
import type { Proposal } from '@/shared/db/schema'
import {
  BabyIcon,
  BanknoteArrowDownIcon,
  CircleDollarSignIcon,
  CircleUserIcon,
  DrillIcon,
  MailIcon,
  PhoneIcon,
} from 'lucide-react'
import { FaTimeline } from 'react-icons/fa6'
import { projectTypes } from '@/shared/constants/enums'

export type Display = string | React.ReactNode

export type ProposalContext
  = Proposal['homeownerJSON']['data']
    & Proposal['projectJSON']['data']
    & Proposal['fundingJSON']['data']

export interface BaseField {
  label: string
  name: keyof ProposalContext | string
  Icon?: LucideIcon | IconType
}

interface TextField extends BaseField {
  type?: 'text'
  format?: (value: string, ctx: ProposalContext) => Display
}

interface EnumField<T extends string> extends BaseField {
  type: 'enum'
  values: readonly T[]
  format?: (value: T, ctx: ProposalContext) => Display
}

interface NumberField extends BaseField {
  type: 'number'
  format: (value: number, ctx: ProposalContext) => Display
}

type Field<E extends string = string> = BaseField | NumberField | TextField | EnumField<E>

export type FieldWithValues<F extends Field = Field> = F & {
  rawValue?: unknown
  displayValue: Display
}

interface Section {
  label: string
  fields: Field[]
}

export const proposalFields = [
  {
    label: 'Homeowner',
    fields: [
      {
        label: 'Name',
        name: 'name',
        Icon: CircleUserIcon,
      },
      {
        label: 'Email',
        name: 'email',
        Icon: MailIcon,
      },
      {
        label: 'Phone',
        name: 'phoneNum',
        Icon: PhoneIcon,
      },
      {
        type: 'number',
        label: 'Age',
        name: 'age',
        Icon: BabyIcon,
        format: value => value ? `${value} years old` : '-',
      },
    ],
  },
  {
    label: 'Project',
    fields: [
      {
        label: 'Project Type',
        name: 'type',
        type: 'enum',
        values: projectTypes,
        format: (value) => {
          if (value === 'general-remodeling') {
            return 'General Remodeling'
          }

          if (value === 'energy-efficient') {
            return 'Energy Efficient'
          }

          return ''
        },
        Icon: DrillIcon,
      },
      {
        label: 'Scopes',
        name: 'scopes',
        Icon: BanknoteArrowDownIcon,
      },
      {
        label: 'Time Allocated',
        name: 'timeAllocated',
        Icon: FaTimeline,
      },
    ],
  },
  {
    label: 'Funding',
    fields: [
      {
        type: 'number',
        label: 'Total Contract Price',
        name: 'finalTcp',
        format: (value, ctx) => {
          const discounts = ctx.incentives.reduce((acc, cur) => cur.type === 'discount' ? acc + cur.amount : acc, 0)
          const formattedStartingTcp = ctx.startingTcp.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          })

          const formattedFinalTcp = value.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          })

          if (!discounts) {
            return formattedFinalTcp
          }

          return (
            <span className="inline-flex items-center gap-2">
              <span className="line-through text-muted-foreground">{formattedStartingTcp}</span>
              <span className="font-medium">{formattedFinalTcp}</span>
            </span>
          )
        },
        Icon: CircleDollarSignIcon,
      },
      {
        type: 'number',
        label: 'Deposit',
        name: 'depositAmount',
        format: value => value.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }),
        Icon: BanknoteArrowDownIcon,
      },
      {
        type: 'text',
        label: 'Exclusive Offer',
        name: 'exclusiveOffers',
        format: (value) => {
          const offers = value.split(',').map(offer => offer.trim())

          return (
            <span>
              {offers.join(', ')}
            </span>
          )
        },
        Icon: CircleDollarSignIcon,
      },
    ],
  },
] as const satisfies Section[]
