export interface HomeownerInfo {
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  email: string
  phone: string
  projectType: string
  fundingType: string
}

export interface ProposalStep {
  title: string
  accessor: string
  description: string
  Component: () => React.ReactNode
}
