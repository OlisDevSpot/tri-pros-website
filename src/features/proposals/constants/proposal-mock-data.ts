import { BabyIcon, BanknoteArrowDownIcon, CircleDollarSignIcon, CircleUserIcon, DrillIcon, HandCoinsIcon, MailIcon, MapPinHouseIcon, PhoneIcon } from 'lucide-react'
import { FaTimeline } from 'react-icons/fa6'

export const proposalSections = [
  {
    label: 'Homeowner',
    overviewFields: [
      {
        label: 'Name',
        name: 'name',
        value: '{{ho.firstName}} {{ho.lastName}}',
        Icon: CircleUserIcon,
      },
      {
        label: 'Full address',
        name: 'address',
        value: '{{ho.address}}, {{ho.city}}, {{ho.state}} {{ho.zipCode}}',
        Icon: MapPinHouseIcon,
      },
      {
        label: 'Email',
        name: 'email',
        value: '{{ho.email}}',
        Icon: MailIcon,
      },
      {
        label: 'Phone',
        name: 'phone',
        value: '{{ho.phone}}',
        Icon: PhoneIcon,
      },
      {
        label: 'Age',
        name: 'age',
        value: '{{ho.age}}',
        Icon: BabyIcon,
      },
    ],
  },
  {
    label: 'Project',
    overviewFields: [
      {
        label: 'Project Type',
        name: 'projectType',
        value: '{{project.type}}',
        Icon: DrillIcon,
      },
      {
        label: 'Approximate timeline',
        name: 'approximateTimeline',
        value: '{{project.timeAllocated}}',
        Icon: FaTimeline,
      },
    ],
    extraFields: [
      {
        label: 'Scope of Work Summary',
        name: 'scopeOfWorkSummary',
        value: '{{project.scopeOfWorkSummary}}',
      },
      {
        label: 'Approximate start date',
        name: 'approximateStartDate',
        value: '{{project.approximateStartDate}}',
      },
      {
        label: 'Approximate completion date',
        name: 'approximateCompletionDate',
        value: '{{project.approximateCompletionDate}}',
      },
    ],
  },
  {
    label: 'Funding',
    overviewFields: [
      {
        label: 'Total Contract Price',
        name: 'tcp',
        value: '{{project.tcp}}',
        Icon: CircleDollarSignIcon,
      },
      {
        label: 'Deposit',
        name: 'deposit',
        value: '{{project.deposit}}',
        Icon: BanknoteArrowDownIcon,
      },
      {
        label: 'Funding Type',
        name: 'fundingType',
        value: '{{project.fundingType}}',
        Icon: HandCoinsIcon,
      },
    ],
    extraFields: [
      {
        label: 'Total Cash',
        name: 'totalCash',
        value: '{{funding.totalCash}}',
      },
      {
        label: 'Total Loan',
        name: 'totalLoan',
        value: '{{funding.totalLoan}}',
      },
      {
        label: 'Finance Company',
        name: 'financeCompany',
        value: '{{funding.financeCompany}}',
      },
      {
        label: 'Loan Term',
        name: 'loanTerm',
        value: '{{funding.loanTerm}}',
      },
      {
        label: 'Interest Rate',
        name: 'interestRate',
        value: '{{funding.interestRate}}',
      },
      {
        label: 'Discounts',
        name: 'discounts',
        value: '{{funding.discount[]}}',
      },
    ],
  },
]
