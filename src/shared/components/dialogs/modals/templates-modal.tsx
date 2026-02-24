import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { useQuery } from '@tanstack/react-query'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'
import { Modal } from './base-modal'

interface Props {
  trade?: Trade
  scopes: ScopeOrAddon[]
  onSelect: (template: string) => void
}

export function TemplatesModal({ trade, scopes, onSelect }: Props) {
  const { isOpen, close } = useModalStore()

  const trpc = useTRPC()
  const SOWs = useQuery(trpc.notionRouter.scopes.getAllSOW.queryOptions({ scopeId: scopes[0].id }))

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      title={`${trade?.name} Templates`}
      description="Choose a starting template"
      className="w-full md:max-w-[80%]"
    >
      <div className="w-full space-y-4">
        {scopes.map(scope => (
          <div
            key={scope.id}
            className="p-4 rounded-md border space-y-4"
          >
            <div>
              <h3 className="font-semibold">{scope.name}</h3>
              <hr className="mt-1" />
            </div>
            <div className="flex flex-col gap-2">
              {SOWs.data?.filter(sow => scope.relatedScopesOfWork?.includes(sow.id)).map(sow => (
                <div
                  key={sow.id}
                  className="p-2 rounded-md min-w-max"
                >
                  <button
                    onClick={() => {
                      onSelect(sow.id)
                    }}
                  >
                    {sow.name}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
