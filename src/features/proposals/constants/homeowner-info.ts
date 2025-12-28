import { CircleDollarSignIcon, CircleUserIcon, DrillIcon, MailIcon, MapPinHouseIcon, PhoneIcon } from 'lucide-react'

export const homeownerInfoFields = [
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
    label: 'Project Type',
    name: 'projectType',
    value: '{{project.type}}',
    Icon: DrillIcon,
  },
  {
    label: 'Funding Type',
    name: 'fundingType',
    value: '{{project.fundingType}}',
    Icon: CircleDollarSignIcon,
  },
]
