import type { LucideIcon } from 'lucide-react'
import type { IconType } from 'react-icons/lib'
import {
  BabyIcon,
  BanknoteArrowDownIcon,
  CircleDollarSignIcon,
  CircleUserIcon,
  DrillIcon,
  MailIcon,
  MapPinHouseIcon,
  PhoneIcon,
} from 'lucide-react'
import { FaTimeline } from 'react-icons/fa6'
import { projectTypes } from '@/shared/constants/enums'

interface BaseField {
  label: string
  name: string
  Icon?: LucideIcon | IconType
}

interface TextField extends BaseField {
  type: 'text'
  value?: string
  format?: (value: string) => string
}

interface EnumField<T extends string> extends BaseField {
  type: 'enum'
  values: readonly T[]
  value?: T
  format?: (value: T) => string
}

interface NumberField extends BaseField {
  type: 'number'
  value?: number
  format: (value: number) => string
}

type Field<E extends string = string> = BaseField | NumberField | TextField | EnumField<E>

interface Section {
  label: string
  overviewFields: Field[]
  extraFields: Field[]
}

export const proposalFields = [
  {
    label: 'Homeowner',
    overviewFields: [
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
        format: value => `${value} years old`,
      },
    ],
    extraFields: [
      {
        label: 'Full address',
        name: 'address',
        Icon: MapPinHouseIcon,
      },
    ],
  },
  {
    label: 'Project',
    overviewFields: [
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
        label: 'Time Allocated',
        name: 'timeAllocated',
        Icon: FaTimeline,
      },
    ],
    extraFields: [
      {
        label: 'Scope of Work Summary',
        name: 'scopeOfWorkSummary',
      },
      {
        label: 'Approximate start date',
        name: 'approximateStartDate',
      },
      {
        label: 'Approximate completion date',
        name: 'approximateCompletionDate',
      },
    ],
  },
  {
    label: 'Funding',
    overviewFields: [
      {
        type: 'number',
        label: 'Total Contract Price',
        name: 'tcp',
        format: value => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
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
    ],
    extraFields: [
      {
        label: 'Total Cash',
        name: 'cashInDeal',
      },
      {
        label: 'Total Loan',
        name: 'totalLoan',
      },
      {
        label: 'Finance Company',
        name: 'financeCompany',
      },
      {
        label: 'Loan Term',
        name: 'loanTerm',
      },
      {
        label: 'Interest Rate',
        name: 'interestRate',
      },
      {
        label: 'Discounts',
        name: 'discounts',
      },
    ],
  },
] as const satisfies Section[]
