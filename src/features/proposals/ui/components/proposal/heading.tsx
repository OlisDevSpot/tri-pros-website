import { Logo } from '@/components/logo'

export function Heading() {
  return (
    <div className="flex justify-between items-center">
      <div className="w-[180px] h-[50px] shrink-0">
        <Logo />
      </div>
      <div>
        <h2 className="text-4xl">
          Proposal for
          {' {{ho.firstName}} {{ho.lastName}} '}
        </h2>
      </div>
      <div>
        <p>{`{{project.proposalDateSent}}`}</p>
      </div>
    </div>
  )
}
