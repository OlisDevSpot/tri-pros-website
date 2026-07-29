# multi-step-flow

A generic, ordered/branching multi-step flow framework: a declarative config, a
uniform step contract, a small reducer-style engine hook, an injected
persistence adapter, and a slotted shell to render it. It has no knowledge of
any particular consumer's domain.

## What this is

- **Config** (`FlowConfig<Step, Ctx>`): an ordered `steps` array plus optional
  `next` branching logic, `landingStepId`, and `terminalKinds`.
- **Step contract** (`BaseStep<K>` / `StepProps<Content, Answer, Ctx>`): every
  step is `{ id, kind }` plus whatever `content` the consumer attaches; every
  step component receives the same uniform props (`content`, `value`,
  `setValue`, `answers`, `ctx`, `advance`, `back`, `isFirst`, `isAnswered`).
- **Reducer** (`useStepEngine`): a hook that holds `{ currentStepId, history,
  answers }`, computes the next step (linear by default, or via `config.next`),
  and exposes `advance` / `back` / `setAnswer` / `reset`.
- **Injected persistence adapter** (`StepPersistenceAdapter<State>`): the
  engine never talks to storage directly. It calls `adapter.load()` /
  `adapter.persist()` and defers hydration if `adapter.useHydration` says the
  adapter isn't ready yet.
- **Slotted shell** (`StepShell`): renders landing / steps / terminal views
  with progress, back/next nav, and named slots (`header`, `footer`,
  `background`, `landing`, `terminal`, `renderStep`) that a consumer fills in.
  Its Next button is gated on `engine.value != null`, so a content-only step
  (one that collects no answer) must be the landing step or a terminal-kind
  step — placed mid-flow it would leave Next permanently disabled and strand
  the user. This is by design: mid-flow steps are expected to collect an
  answer.

Nothing in the package refers to funnels, trades, or any other product
concept — it is domain-neutral by construction.

## What it is NOT

- It owns **no steps**. Step content, kinds, and copy all live in the
  consumer.
- It owns **no persistence store**. It does not touch `localStorage`, a
  database, or any API — it only calls the adapter the consumer hands it.
- It owns **no CSS scopes or theme**. Styling hooks (e.g. a scoped light
  theme) are the consumer's responsibility.
- It owns **no slug registry**. Mapping a URL segment to a specific flow
  config is entirely up to the consumer (funnels, for example, would supply
  their own trade→config lookup).

## How to build a consumer engine

A consumer wires up five things:

**1. A `Kind` union + per-kind content/answer shapes + `Ctx`**

```ts
type RefKind = 'welcome' | 'name' | 'pick' | 'done'

interface WelcomeStep extends BaseStep<'welcome'> { content: { title: string } }
interface NameStep extends BaseStep<'name'> { content: { title: string } }
type RefStep = WelcomeStep | NameStep | /* ... */

interface RefCtx { flowName: string }
```

**2. Step components authored against a narrow `StepProps<Content, Answer, Ctx>`**

```tsx
function NameStepView({ content, value, setValue }: StepProps<{ title: string }, string, RefCtx>) {
  return <input value={value ?? ''} onChange={e => setValue(e.target.value)} />
}
```

Each component only knows its own `Content`/`Answer` shape — never the union
of all steps in the flow.

**3. A `StepRegistry<Kind>` mapping kind → component**

```ts
const REGISTRY: StepRegistry<RefKind> = {
  welcome: WelcomeStepView,
  name: NameStepView,
  pick: PickStepView,
  done: DoneStepView,
}
```

**4. A `StepPersistenceAdapter<EngineState>`**

Two shapes are supported:
- **Sync (e.g. localStorage)**: `load` reads and returns state immediately;
  `useHydration` is omitted.
- **Async (e.g. a DB-backed autosave)**: `load` returns the adapter's cached
  snapshot (or `null`); `useHydration` is a hook returning whether the async
  fetch has resolved yet, so the engine knows when it's safe to adopt the
  loaded state.

**5. A `FlowConfig` + `useStepEngine(config, adapter, { onNavigate })` rendered through `<StepShell>`**

```tsx
const config = useMemo<FlowConfig<RefStep, RefCtx>>(() => ({
  steps: [
    { id: 'welcome', kind: 'welcome', content: { title: 'Multi-Step-Flow Reference' } },
    { id: 'name', kind: 'name', content: { title: 'What should we call you?' } },
    // ...
  ],
  terminalKinds: ['done'],
}), [])

const ctx = useMemo<RefCtx>(() => ({ flowName: 'reference' }), [])
const engine = useStepEngine(config, adapter, { onNavigate: () => scrollToTop(stageRef.current) })

return (
  <StepShell
    config={config}
    ctx={ctx}
    engine={engine}
    registry={REGISTRY as StepRegistry<string>}
  />
)
```

Pass a stable `options` object (memoize it, or at least the `onNavigate`
callback) — `advance`/`back` identities depend on it, so a fresh inline
`{ onNavigate }` literal each render makes them change every render. The
snippet above does this harmlessly, but real consumers with memo-sensitive
children should keep it stable.

`StepShell` picks the landing / steps / terminal view for you based on
`config.landingStepId` and `config.terminalKinds`, and renders whichever of
`landing` / `terminal` / `header` / `footer` / `background` slots the
consumer passes in. See `example/reference-flow.tsx` for the complete,
runnable version of the sketch above, including `lib/card-options.ts` helpers
(`icon` / `img` / `text` / `cardOptions`) for building `CardOption[]` content.

## Persistence adapter contract

```ts
export interface StepPersistenceAdapter<State> {
  load: () => State | null
  persist: (next: State) => void
  useHydration?: () => boolean
}
```

- `load()` must be safe to call synchronously and return `null` when there's
  nothing to hydrate from.
- `persist(next)` is called on every state change once the engine is ready;
  it should be fire-and-forget from the engine's perspective (fire the write,
  don't block rendering on it).
- `useHydration` is the sync/async seam: a localStorage adapter loads
  synchronously and omits it entirely (the engine treats "no `useHydration`"
  as "already hydrated"). A DB adapter that fetches asynchronously provides
  `useHydration` so the engine can hold off adopting `load()`'s result — and
  keep rendering the same `initial` state it used for SSR — until the async
  fetch resolves. This avoids a hydration mismatch between server-rendered
  markup and the eventually-loaded client state.

## The one cast

`StepShell` looks up the component for the current step from the registry and
invokes it:

```ts
// The one documented widening at the dispatch seam.
const StepView = registry[engine.step.kind] as ComponentType<StepProps<any, any, any>>
```

This is the single place in the package where type safety is deliberately
widened. It exists because a `StepRegistry<Kind>` is a union of components
with *different* `Content`/`Answer` types, and nothing at the call site can
narrow `engine.step.kind` back down to the specific step type before handing
props to whichever component happens to live at that key. Every individual
step component stays authored against its own narrow `StepProps<Content,
Answer, Ctx>` (see section 2 above) — the widening is contained entirely
inside `StepShell`'s dispatch, not leaked into consumer code.

## Typing content-only steps

Some steps don't collect an answer at all — a welcome screen, a "you're done"
screen. Model these as `StepProps<Content, unknown, Ctx>`, **not**
`StepProps<Content, never, Ctx>`.

`never` looks like the more precise choice ("this step can never have a
value"), but a component typed with `Answer = never` fails to assign into a
`StepRegistry<Kind>` under strict mode (TS2322) — `never` cannot satisfy the
positions in `StepProps` that consume the parameter (e.g. `setValue: (answer:
Answer) => void`), because a function parameter typed `never` is not a valid
substitute for one typed `unknown` at the calling positions the registry
needs. `unknown` is the correct "no real answer" type: it is a supertype that
`StepRegistry` can always accept, and it still forces the (unused) `setValue`
call site to justify itself if one is ever added. See
`example/reference-flow.tsx`'s `WelcomeStepView` and `DoneStepView` — both
are `StepProps<{ title: string }, unknown, RefCtx>`.

## `example/` is not production

`example/reference-flow.tsx` and `example/reference-adapter.ts` are a manual
smoke-test artifact: a minimal, runnable consumer used to sanity-check the
package end-to-end (including the in-memory adapter, which explicitly persists
nothing beyond the current session). The only sanctioned importer is the
dev-only route `src/app/(frontend)/dev/multi-step-flow/` — a developer smoke
harness, not linked from production navigation. No other production surface
should import from `example/`. Treat it as living documentation, not a
dependency.
