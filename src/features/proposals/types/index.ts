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

export interface ProposalStep<P> {
  title: string
  accessor: string
  description: string
  Component: (props: P) => React.ReactNode
}
