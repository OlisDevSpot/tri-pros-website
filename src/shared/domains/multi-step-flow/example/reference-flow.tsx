'use client'

import type { BaseStep, FlowConfig, StepProps, StepRegistry } from '../types'
import { useMemo, useRef } from 'react'
import { useStepEngine } from '../hooks/use-step-engine'
import { cardOptions, text } from '../lib/card-options'
import { scrollToTop } from '../lib/scroll-to-top'
import { CardOption } from '../ui/card-option'
import { StepShell } from '../ui/step-shell'
import { createInMemoryAdapter } from './reference-adapter'

// --- This consumer's kinds, content, answers, ctx (lockstep, per-engine) ---
type RefKind = 'welcome' | 'name' | 'pick' | 'done'

interface WelcomeStep extends BaseStep<'welcome'> { content: { title: string } }
interface NameStep extends BaseStep<'name'> { content: { title: string } }
interface PickStep extends BaseStep<'pick'> { content: { title: string, options: ReturnType<typeof cardOptions> } }
interface DoneStep extends BaseStep<'done'> { content: { title: string } }
type RefStep = WelcomeStep | NameStep | PickStep | DoneStep

interface RefCtx { flowName: string }

// --- Step components, each authored against its own narrow StepProps ---
function WelcomeStepView({ content, advance }: StepProps<{ title: string }, unknown, RefCtx>) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-3xl font-bold">{content.title}</h1>
      <button className="rounded-lg bg-primary px-6 py-3 text-primary-foreground" type="button" onClick={advance}>
        Start
      </button>
    </div>
  )
}

function NameStepView({ content, value, setValue }: StepProps<{ title: string }, string, RefCtx>) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{content.title}</h2>
      <input
        className="rounded-lg border border-border px-4 py-2"
        placeholder="Type anything"
        value={value ?? ''}
        onChange={e => setValue(e.target.value)}
      />
    </div>
  )
}

function PickStepView({ content, value, setValue, advance }: StepProps<PickStep['content'], string, RefCtx>) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{content.title}</h2>
      <div className="flex flex-col gap-3">
        {content.options.map(opt => (
          <CardOption
            key={opt.id}
            columns={1}
            option={opt}
            selected={value === opt.id}
            onSelect={(id) => {
              setValue(id)
              advance()
            }}
          />
        ))}
      </div>
    </div>
  )
}

function DoneStepView({ content }: StepProps<{ title: string }, unknown, RefCtx>) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-bold">{content.title}</h1>
      <p className="text-muted-foreground">Reference flow complete.</p>
    </div>
  )
}

const REGISTRY: StepRegistry<RefKind> = {
  welcome: WelcomeStepView,
  name: NameStepView,
  pick: PickStepView,
  done: DoneStepView,
}

export function ReferenceFlow() {
  const stageRef = useRef<HTMLDivElement>(null)
  const adapter = useMemo(() => createInMemoryAdapter(), [])

  const config = useMemo<FlowConfig<RefStep, RefCtx>>(() => ({
    steps: [
      { id: 'welcome', kind: 'welcome', content: { title: 'Multi-Step-Flow Reference' } },
      { id: 'name', kind: 'name', content: { title: 'What should we call you?' } },
      {
        id: 'pick',
        kind: 'pick',
        content: {
          title: 'Pick one',
          options: cardOptions([text('a', 'Option A'), text('b', 'Option B'), text('c', 'Option C')]),
        },
      },
      { id: 'done', kind: 'done', content: { title: 'All set 🎉' } },
    ],
    terminalKinds: ['done'],
  }), [])

  const ctx = useMemo<RefCtx>(() => ({ flowName: 'reference' }), [])
  const engine = useStepEngine(config, adapter, { onNavigate: () => scrollToTop(stageRef.current) })

  return (
    <div ref={stageRef}>
      <StepShell config={config} ctx={ctx} engine={engine} registry={REGISTRY as StepRegistry<string>} />
    </div>
  )
}
