# 14 — CASL library-API verification (claims behind README §L and report 08)

**Mode:** read-only research, 2026-09-09, worktree `.worktrees/issue-285` @ `b40403b6`. No `src/` edits, no git state changes, no `pnpm build/tsc/lint` on the repo. Probe scripts ran from the session scratchpad against a `node_modules` symlink into this worktree (nothing written under the repo).

**Question answered:** are the library-API claims that README §L (L1–L10) and `08-casl-playbook.md` rest on true at (1) the official docs and (2) the packages actually installed here?

**Versions that matter**

| Package | Installed here | Latest on npm (2026-09-09) | Notes |
|---|---|---|---|
| `@casl/ability` | **6.8.0** (`package.json:48` `^6.8.0`) | **7.0.1** (7.0.0 published 2026-05-21, 7.0.1 2026-07-06) | 7.0 is a breaking major (see §1 claim 1). Not required by anything in §L. |
| `@casl/react` | **not installed** (`node_modules/@casl/` holds only `ability`) | **7.0.1** (7.0.0 2026-05-21; 6.0.0 2026-04-13) | peer `@casl/ability ^4 \|\| ^5.1 \|\| ^6 \|\| ^7`, `react ^18 \|\| ^19` → installable beside 6.8.0 + React 19. |
| `@ucast/core` / `mongo` / `js` / `mongo2js` | 1.10.2 / 2.4.3 / 3.1.0 / 1.4.1 (transitive only, `node_modules/.pnpm/@ucast+*`) | — | `node_modules/@ucast` does **not** exist (pnpm, no hoist) — README C12 stands. |
| `react` / `next` / `typescript` | 19.2.4 / 15.5.9 / 5.9.3 | — | used by the render + `tsc` probes |

**Citation keys**

| Key | Meaning |
|---|---|
| `dts:<file>:<line>` | installed `node_modules/@casl/ability/dist/types/<file>` |
| `impl:<file>:<n>` | installed compiled `dist/es6m/<file>`, **n = line after splitting on `;`** (minified; same convention as report 08) |
| `ucast:<pkg>:<n>` | installed `node_modules/.pnpm/@ucast+<pkg>@<ver>/node_modules/@ucast/<pkg>/dist/es6m/index.mjs`, same `;`-split numbering |
| `docs:<page>` | CASL docs fetched through Context7 `/stalniy/casl` (`docs-src/src/content/pages/<page>/en.md`) |
| `unpkg:<pkg>@<ver>/<path>` | published file fetched from unpkg |
| `RUN` | executed this session against the installed packages; transcript in Appendix A |
| `TSC` | `tsc 5.9.3 --strict --moduleResolution bundler` against the installed `.d.ts`; transcript in Appendix B |
| `repo:<path>:<line>` | this worktree |

---

## 0. Verdict table

| # | Claim (abridged) | Verdict |
|---|---|---|
| 1 | `@casl/react` 7.0.1 exists; `AbilityProvider` / `useAbility<T>()` / `<Can>`; `createContextualCan` removed in 7.0 | **VERIFIED** (+ facts: not installed; no `'use client'`; `useAbility` throws without provider; README/Context7 drift) |
| 2 | `subject(type, row)` tags for row-condition checks; tag lost across JSON, re-apply on client | **VERIFIED** (+ also lost across superjson — the tRPC transformer — and `structuredClone`) |
| 3 | `packRules`/`unpackRules` round-trip → identical `can()` given the same `conditionsMatcher` | **VERIFIED** |
| 4 | `buildMongoQueryMatcher(instructions)` registers document operators; `operatorToConditionName` inert for the parser; `$` stripped; register unprefixed | **VERIFIED, made precise** (the option is inert on *both* sides; the split is instruction-key `$name` / AST+interpreter `name`) |
| 5 | `rulesToAST` → `null` deny-all, empty AND allow-all, tree otherwise; fields-only rule = unconditional allow | **VERIFIED** (+ 2 caveats: 6.8.0 ignores rule priority for interleaved `cannot`s — fixed in 7.0.0; `{}` conditions count as "conditioned" in `rulesToQuery`) |
| 6 | `permittedFieldsOf(..., { fieldsFrom })`; tagged row = row-aware, type string = not | **VERIFIED** (+ untagged POJO silently → `[]`) |
| 7 | `can(action, subject, fields?, conditions?)`; last-match-wins; conditionless `can` OR-merges to allow-all | **VERIFIED** |
| 8 | `.because(reason)` on the builder's return, recoverable via `ForbiddenError` | **CORRECTED** — `.because()` exists and stores `reason` on any rule, but `ForbiddenError` surfaces it **only for inverted rules**; a direct `can('manage','all').because(r)` never produces a `ForbiddenError` |
| 9 | JS matcher throws on unknown operator at instance check; type-level passes; `cannot` with unknown op — throw or fail-open? | **CORRECTED (two scenarios conflated)** — instruction-registered-but-no-interpreter → **throws** (direct and inverted); instruction-not-registered (default matcher) → parsed as a field named `$op`: direct silently false, inverted silently **fails open** |
| 10 | Typing `MongoAbility<[Action,Subject]>` with a conditions parameter so custom operators type-check | **CORRECTED** — the repo's TS2769 root cause is all-string subjects → `MongoQuery<never>` (even `{ ownerId }` fails); working 6.8.0 patterns found and type-checked (§1.10) |
| 11 | `ForbiddenError.from(ability).throwUnlessCan(action, subject, field?)` | **VERIFIED** |
| 12 | React 19 / Next 15 caveats | **Caveats confirmed** (§1.12) |

Everything in §L that is a *decision* survives. Three *mechanisms* are wrong or under-specified (claims 8, 9, 10) and two version facts are worth recording (§3).

---

## 1. Claim-by-claim evidence

### 1.1 `@casl/react` — VERIFIED

- **Existence / dates.** npm registry: versions end `…, 6.0.0, 7.0.0-rc, 7.0.0, 7.0.1`; `dist-tags.latest = 7.0.1`; `time["7.0.0"] = 2026-05-21`, `time["7.0.1"] = 2026-07-06`, `time["6.0.0"] = 2026-04-13`. Peer deps: `@casl/ability ^4.0.0 || ^5.1.0 || ^6.0.0 || ^7.0.0`, `react ^18.0.0 || ^19.0.0` (`unpkg:@casl/react@7.0.1/package.json`).
- **Installed here:** no. `ls node_modules/@casl` → `ability` only; `node_modules/.pnpm` has `@casl+ability@6.8.0` only.
- **7.0.1 API (ground truth = published `.d.ts`).**
  - `unpkg:@casl/react@7.0.1/dist/types/hooks/useAbility.d.ts:2-6`
    ```ts
    export declare function AbilityProvider<T extends AnyAbility>({ children, value }: { children: React.ReactNode; value: T }): ReactElement;
    export declare function useAbility<T extends AnyAbility>(): T;
    ```
  - `…/dist/types/Can.d.ts:3-37`: `CanProps<T>` = one of `{do,on}` / `{I,a}` / `{I,an}` / `{I,this}` (+ `field?`) & `{ not?, passThrough?, children: ReactNode | (({isAllowed, ability, reason}) => ReactNode) }`; `export declare const Can: typeof CanComponent`.
  - `…/dist/types/index.d.ts`: `export * from './Can'; export * from './hooks/useAbility'` — nothing else. `…/dist/types/factory.d.ts` → **404** (file listing: `Can.d.ts`, `index.d.ts`, `hooks/useAbility.d.ts` only).
- **`createContextualCan` removed in 7.0 — confirmed.** CHANGELOG 7.0.0 (2026-05-21), BREAKING: *"replaces `createContextualCan` with `<AbilityProvider>`, as a result `useAbility` no longer accept context parameter. `<Can>` component no longer accepts `ability` prop and instead relies on `useAbility`"* (`raw.githubusercontent.com/stalniy/casl/master/packages/casl-react/CHANGELOG.md`). The 6.0.0 types still ship `factory.d.ts` `createContextualCan<T>(Getter: Consumer<T>): FunctionComponent<BoundCanProps<T>>` and `useAbility<T>(context: React.Context<T>): T` (`unpkg:@casl/react@6.0.0/dist/types/{factory,hooks/useAbility}.d.ts`).
- **Bundle facts** (`unpkg:@casl/react@7.0.1/dist/esm/index.mjs`, 1 095 bytes): imports `createContext, createElement, useCallback, useContext, useSyncExternalStore` from `react`; **no `'use client'` directive** (`grep -c "use client"` → 0); `useAbility()` subscribes via `ability.on('updated', …)` with `ability.rules` as the snapshot and **throws** `AbilityContext is not provided. Please make sure to wrap your component tree with <AbilityProvider>.` when there is no provider; `Can` resolves the subject from `of || a || an || this || on` (undocumented `of` alias), the action from `I || do`, memoizes `relevantRuleFor(action, subject, field)` on `[ability, ability.rules, action, subject, field]`, exposes `{ isAllowed, ability, reason: rule?.reason }`.
- **RUN (React 19.2.4 + installed CASL 6.8.0 + the 7.0.1 bundle, `renderToString`):** `own-note-yes`, `type-level-yes`, `<i>true</i>` rendered; `other-note-no` and an untagged `this={{authorId:'u1'}}` rendered nothing; `useAbility` outside the provider threw the message above.
- **Doc drift to ignore.** (i) `unpkg:@casl/react@7.0.1/README.md:125` still writes `<AbilityProvider ability={ability}>`; the Quick Start (`:38`), the `.d.ts` and the bundle all use **`value`**. (ii) Context7's `docs:package/casl-react` page lists a `where` prop on `<Can>` — it does not exist in `Can.d.ts` nor in the bundle. (iii) The same page's `useAbility` "no parameters" description matches 7.x.
- **Adjacent fact — `@casl/ability` is also at 7.0.1.** CHANGELOG 7.0.0 (2026-05-21) BREAKING: `PureAbility` renamed to `Ability` (the old `Ability` class with default options is gone; use `createMongoAbility` + `MongoAbility`); `rulesToQuery` replaced by `rulesToCondition` (**`rulesToAST` is retained** — `unpkg:@casl/ability@7.0.1/dist/types/extra/rulesToCondition.d.ts:6`); `possibleRulesFor`/`rulesFor` return `readonly Rule[]`; `getDefaultErrorMessage` removed; "conditions that semantically match everything" are treated as conditionless; deps → `@ucast/mongo2js ^2.0.0`. None of this is needed for §L; `@casl/react` 7.0.1's peer range accepts the installed 6.8.0, so **add `@casl/react` without touching `@casl/ability`**.

### 1.2 `subject()` — VERIFIED

- `dts:utils.d.ts:4` `setSubjectType<T extends string, U>(type: T, object: U): U & ForcedSubject<T>`, exported as `subject` (`dts:index.d.ts:13`). `impl:index.mjs:4-5`: `Object.defineProperty(obj, '__caslSubjectType__', { value: type })` (non-enumerable, non-writable, non-configurable), throws `Trying to cast object to subject type X but previously it was casted to Y` on a different re-tag. Default detection `impl:index.mjs:9-10`: tag if present, else `constructor.modelName || constructor.name`.
- `docs:guide/subject-type-detection` ("subject helper": *"attaches a hidden, non-configurable, and non-enumerable property called `__caslSubjectType__`"*; "Use subject Helper for DTOs": `ability.can('read', subject('Article', article))`); `docs:api/casl-ability#subject`, `#detectSubjectType`.
- **RUN T1:** same object returned; `Object.keys` = `["id","authorId"]`; `JSON.stringify` drops the tag; **superjson** (the tRPC transformer, `repo:src/trpc/init.ts:13`, `src/trpc/query-client.ts:26,36`) round-trip drops it (`{"json":{"id":"c1","ownerId":"u1"}}`); `structuredClone` drops it; `can('update', subject('CustomerNote', row))` = true, same row after JSON = **false, no throw** (`detectSubjectType` → `"Object"`), re-tagged after JSON = true; re-tag with another type throws.
- Consequence recorded in L10 ("re-applied after JSON boundaries") is right and slightly under-scoped: every tRPC response (superjson) and every RSC→client prop boundary (React Flight serialises own enumerable keys — inferred from the JSON/superjson/structuredClone results, not executed) loses the tag.

### 1.3 `packRules` / `unpackRules` — VERIFIED

- `dts:extra/packRules.d.ts:30-32`: `packRules(rules, packSubject?)`, `unpackRules(rules, unpackSubject?)`; `PackRule` tuple `[action, subject, conditions|0, inverted 1|0, fields|0, reason]` (`:3-28`). `impl:extra/index.mjs:10-16` trims trailing falsy slots; unpack yields `action`/`subject` as arrays and explicit `inverted: false`.
- `docs:api/casl-ability-extra#packRules` ("reduces serialized rules size in 2 times… Don't use result returned by packRules directly, its format is not public"), `#unpackRules` (`ability.update(unpackRules(token.rules))`), `docs:cookbook/cache-rules`.
- **RUN T2:** server ability (scalar rule, fields+conditions rule, inverted rule with `.because`, operator-bearing rule) → `packRules` → `JSON` wire → `unpackRules` → `createMongoAbility(unpacked, { conditionsMatcher: sameMatcher })`: identical `can()` on type, own row, other row, and per-field (`age` true / `name` false) for `read|update|delete`; identical `rulesToAST` on the operator-bearing rule (`DocumentCondition(participatesViaMeeting)`); `reason` survives. A raw `JSON.parse(JSON.stringify(ability.rules))` hydration works too.
- The "same `conditionsMatcher`" proviso is load-bearing: with the default matcher the operator-bearing rules degrade as described in §1.9(b).

### 1.4 `buildMongoQueryMatcher`, `operatorToConditionName`, `$` stripping — VERIFIED, made precise

- **API.** `dts:matchers/conditions.d.ts:32-33` `buildMongoQueryMatcher: (...args: Partial<Parameters<typeof createFactory>>) => ConditionsMatcher<MongoQuery>`; `impl:index.mjs:78` `(i, e, s) => createFactory({...defaultInstructions, ...i}, {...defaultInterpreters, ...e}, s)`. mongo2js `createFactory(instructions, interpreters, options?)` (`ucast:mongo2js types/factory.d.ts:21-23`).
- **Where the option goes.** `ucast:mongo2js:8` `function p(r,c,f){ const s = new MongoQueryParser(r); const i = createJsInterpreter(c, Object.assign({compare: m}, f)) …}` — the third argument reaches **only** `createJsInterpreter`. `ucast:mongo:9` `class MongoQueryParser extends ObjectQueryParser { constructor(e){ super(e, { defaultOperatorName: "$eq", operatorToConditionName: e => e.slice(1) }) } }` — hard-coded. `ucast:core:14` `name: this.u.operatorToConditionName(r)` is where the instruction name is derived. And the JS interpreter does not read `operatorToConditionName` either: `ucast:core:31` `createInterpreter` reads `options.getInterpreterName` (default = `condition.operator`). So the option is **inert on both sides**, not merely "forwarded to the interpreter".
- **RUN T3(c):** `buildMongoQueryMatcher({ $participatesViaMeeting }, { participatesViaMeeting: () => true }, { operatorToConditionName: op => op })` → `ast.operator === 'participatesViaMeeting'` (still stripped); interpreter keyed `$participatesViaMeeting` → `Unable to interpret "participatesViaMeeting" condition…`; `getInterpreterName: n => '$' + n.operator` **does** remap the lookup (so that is the real knob if one ever wanted `$`-keyed interpreters); an instruction registered **without** `$` (`participatesViaMeeting`) becomes operator `articipatesViaMeeting` — `slice(1)` is a blind first-character strip.
- **Precise statement of "register unprefixed":** instruction key = `$name` (it must equal the literal key written in `can()` conditions); emitted AST `operator`, interpreter key, and this repo's `SCOPE_OPERATOR_NAMES` = `name`. `repo:src/shared/domains/permissions/scope/conditions-matcher.ts:41-49` does exactly this (`[`$${name}`, { type: 'document' }]`); its comment block (`:23-36`) is accurate. A `{ type: 'document' }` instruction with no `parse` uses ucast's default document parser `ucast:core:13` `document: (t, r) => new DocumentCondition(t.name, r)` — RUN T3(a) confirms `DocumentCondition(participatesViaMeeting) = {via, userId}`.
- Docs: `docs:advanced/customize-ability` "Extend conditions with custom operators" — `buildMongoQueryMatcher({ $nor }, { nor })` shows the same `$`/no-`$` split; `docs:api/casl-ability#buildMongoQueryMatcher`.

### 1.5 `rulesToAST` contract; fields-only rule = unconditional allow — VERIFIED, two caveats

- `dts:extra/rulesToQuery.d.ts:10-11`; `docs:api/casl-ability-extra#rulesToAST` ("`null` if user is not allowed… otherwise returns AST"), `#rulesToQuery`.
- Algorithm `impl:extra/index.mjs:30-45` (`rulesToQuery` then `rulesToAST` over it), iterating `rulesFor(action, subjectType)` newest→oldest: direct+conditions → `$or`; inverted+conditions → `$and`; **direct with `!rule.conditions` → return `{}`/`{$and}` immediately**; inverted without conditions → `break`; empty `$or` → `null`. Only `conditions` is consulted — `fields` never is, so a fields-only rule is "no conditions". `rulesToAST`: `null` → `null`; no `$and` → `$or ? buildOr($or) : buildAnd([])`; else `buildAnd([...not(inverted), buildOr($or)])`.
- **RUN T4:** no rules → `null`; `can('read','X')` → `CompoundCondition(and, [])`; **`can('update','Customer',['age'])` → `CompoundCondition(and, [])`, `rulesToQuery` → `{}`**; `can(…,['age'],{ownerId})` → `FieldCondition(eq, ownerId)`; two conditioned rules → `or[…]`; conditioned + conditionless → `and([])`; `manage all` → `and([])`; `can; cannot(cond)` → `not[…]`; `can(cond); cannot(cond)` → `and[not[…], eq]`. Also: with `can('update','Customer',['age'])` beside `can('update','Customer',{ownerId:'u1'})`, an instance check on another owner's row is **true** for no-field and for `age`, false for `name` — i.e. the fields-only rule really does grant the verb on every row (L8's hazard, confirmed at runtime, not just in the AST).
- **Caveat A — 6.8.0 `rulesToAST` ignores rule priority for interleaved inverted rules.** RUN (`priority.mjs`): `can{a:1}; cannot{b:2}; can{c:3}` → runtime `can('read', subject('X',{c:3,b:2}))` = **true** (newest `can` matches first) but `rulesToAST` = `and[not[eq(b,2)], or[eq(c,3), eq(a,1)]]`, which **excludes** that row. Direction: over-restrictive only (every `cannot` is ANDed regardless of age; a conditionless direct rule still short-circuits correctly). Fixed upstream in 7.0.0 by PR #1193 (*"ensure that rulesToQuery and rulesToAST generate condition that respect rule priority"*, `rulesToCondition` flattens the switch/case). Dormant as long as `cannot` rules are appended **after** every `can` for the same action/subject — already the playbook rule (`08 §1.7, §7.4`) — so the D3 audit should enforce ordering, not just "no conditionless beside conditioned".
- **Caveat B — empty `{}` conditions.** RUN: `can('read','X',{})` → `rulesToQuery` `{"$or":[{}]}` (treated as conditioned), `rulesToAST` `and([])`, instance check true. 7.0.0 normalises `{}` to "no conditions". The D3 grep for conditionless mutation rules must also treat `conditions: {}` as conditionless.

### 1.6 `permittedFieldsOf` — VERIFIED

- `dts:extra/permittedFieldsOf.d.ts:6-9` `permittedFieldsOf(ability, action, subject: Parameters<T['can']>[1], { fieldsFrom: (rule) => string[] }): string[]`. `impl:extra/index.mjs:17-25`: `detectSubjectType(subject)` → `possibleRulesFor(action, type)` → walk oldest→newest → `if (rule.matchesConditions(subject))` add (direct) / delete (inverted) `fieldsFrom(rule)`.
- `docs:api/casl-ability-extra#permittedFieldsOf` (express example with `fieldsFrom: rule => rule.fields || [/* all fields */]`).
- **RUN T5** (`can('update','Customer',['age','name'],{ownerId:'u1'}); can('update','Customer',['notes'])`, `ALL` = 6 columns): type string → `[age,name,notes]` (conditioned rules count — `matchesConditions('Customer')` returns `!inverted`, `impl:index.mjs:29-31`); `subject('Customer',{ownerId:'u1'})` → `[age,name,notes]`; other owner → `[notes]`; **untagged POJO → `[]`** (silent); `can('update','Customer'); cannot('update','Customer',['secret'])` with `fieldsFrom` returning `ALL` → 5 fields; with `fieldsFrom: r => r.fields || []` → `[]` (a conditionless rule contributes nothing unless `fieldsFrom` supplies the full list).

### 1.7 Builder signature, precedence, OR-merge — VERIFIED

- `dts:AbilityBuilder.d.ts:18-24`: two overloads, `(action | action[], subject | subject[], fields?: F | F[], conditions?)` and `(action, subject, conditions?)`, both returning `RuleBuilder<T>`. `impl:index.mjs:84-89`: third arg is `fields` iff array/string, else `conditions`; fourth arg, if present, is `conditions`.
- Precedence: `impl:index.mjs:70-76` `relevantRuleFor` returns the first rule of `rulesFor(...)` whose `matchesConditions(subject)` holds; `rulesFor` is ordered by priority (newest first). `docs:guide/intro` "Inverted rules" (place `cannot` after `can`), "Rules" (same action/subject OR-ed).
- **RUN T6/T7:** raw rule `{action:'update',subject:'Customer',fields:['age'],conditions:{ownerId:'u1'}}`; `cannot(private) ; can(owner)` → own private row **allowed** (cannot overridden); `can(owner) ; cannot(private)` → **denied**; `can(owner) ; can()` → other owner's row allowed and AST `and([])`.

### 1.8 `.because(reason)` and `ForbiddenError` — CORRECTED (mechanism)

- **What exists (6.8.0).** `dts:AbilityBuilder.d.ts:6-10` `class RuleBuilder<T> { _rule: RawRuleOf<T>; because(reason: string): this }`; `can`/`cannot` return it (`:21-24`). `impl:index.mjs:79-80` sets `rule.reason`. `dts:RawRule.d.ts:7-8` `reason?: string` ("explains the reason of why rule does not allow to do something"). `dts:Rule.d.ts:18` `readonly reason`. Stored for **direct and inverted** rules alike (RUN T7: `can('manage','all').because('job:gcal-sync')` → `rules[0].reason === 'job:gcal-sync'`, `relevantRuleFor('read','Customer').reason === 'job:gcal-sync'`, survives `packRules` in the 6th slot).
- **What `ForbiddenError` does with it.** `impl:index.mjs:101-108` `unlessCan(action, subject, field)`: `rule = relevantRuleFor(...)`; **`if (rule && !rule.inverted) return;`** — a matching *direct* rule yields no error at all; otherwise `message = setMessage ?? rule?.reason ?? defaultMessage`. So the reason reaches `ForbiddenError.message` **only when the relevant rule is inverted**. `docs:advanced/debugging-testing`: *"forbidden reasons do not support direct rules"*; `docs:guide/intro` "Forbidden reasons" shows `.because()` on `cannot(...)` only.
- **RUN T7:** `ForbiddenError.from(manageAllAbility).throwUnlessCan('delete','Customer')` → not thrown; `cannot('read','X',{archived:true}).because('archived rows hidden')` → `ForbiddenError: archived rows hidden`, `action=read subjectType=X`; no matching rule → default `Cannot execute "read" on "X"`, `field` populated.
- **Correction for L7:** `.because(reason)` is the right place to *store* the audit reason on a system rule set, but the retrieval path is `ability.rules[i].reason` / `ability.relevantRuleFor(action, subject)?.reason` (or the `reason` exposed by `<Can>`'s render prop), **not** `ForbiddenError` — a `manage all` ability never denies, so it never throws. (Under 7.x semantics this is unchanged.)

### 1.9 Unknown-operator behaviour of the JS matcher — CORRECTED (two scenarios)

Source: `impl:index.mjs:27-31` (`Rule` compiles its matcher lazily on first `matchesConditions`/`ast`; `matchesConditions(x)` returns `!inverted` for `undefined`/type arguments **before** compiling anything); `ucast:core:30` `Unable to interpret "<op>" condition. Did you forget to register interpreter for it?`; `ucast:core:28-29` (unknown top-level key with a non-operator value → `parseField(key, '$eq', value)`).

| Scenario | Config | Type-level `can` | Instance check, direct rule | Instance check, `cannot` rule | `rulesToAST` |
|---|---|---|---|---|---|
| **(a)** instruction registered, **no JS interpreter** — this repo's server matcher today (`conditions-matcher.ts:37-39` registers none) | `buildMongoQueryMatcher({ $op: {type:'document'} })` | passes (conditions ignored) | **THROWS** | **THROWS** (fail-closed by exception) | `DocumentCondition(op)` |
| **(b)** instruction **not** registered — a client hydrating the same rules on the default matcher | `createMongoAbility(rules)` | passes | silently **false** (fail closed) | silently unmatched → **fails OPEN** | `FieldCondition(eq, '$op')` (a field literally named `$op`) |

- **RUN T3/T8:** (a) `ab.can('read', subject('Customer',{id}))` → throws for the direct rule and for the `cannot` rule; type-level true in both; a **newer** matching rule short-circuits before the throwing one (`relevantRuleFor` returns the first match), a newer non-matching rule does not. (b) direct → `false`, no throw; `can('read','Customer') ; cannot('read','Customer',{ $op })` → instance check **true** (the exclusion never matches). Under (b) the server-side adapter is still safe: the emitted `FieldCondition` names a column `$participatesViaMeeting` that `columnOf` throws on.
- **Correction for L10.** L10 says *"an instance check throws, and a `cannot` with an unknown operator fails open"* — the first half is scenario (a), the second is scenario (b). Under L10's own decision (one shared matcher module on both sides) **both server and client are in (a): they throw, and never fail open**. The consequence L10 did not draw: on the client, `useAbility().can('read', subject('Customer', row))` or `<Can I="read" this={row}>` for an agent **throws** as soon as an operator-bearing `read` rule is reached (operator rules are exactly the `read` rules the guard permits). Either extend guard (a) to "no *instance* `read` checks on the client for subjects whose rules carry operators" or take escape hatch (b) — register JS interpreters (via the same shared module, 2nd argument of `buildMongoQueryMatcher`) that read pre-computed facts selected beside the row. Fail-open only occurs if the client ever hydrates rules on a matcher that lacks the instructions — exactly what the shared module prevents.

### 1.10 Typing conditions on `MongoAbility` — CORRECTED (root cause + working pattern)

- **Declared shapes.** `dts:Ability.d.ts:15` `interface MongoAbility<A extends AbilityTuple = AbilityTuple, C extends MongoQuery = MongoQuery> extends PureAbility<A, C>`; `:20-21` `createMongoAbility<T extends AnyMongoAbility = MongoAbility>(rules?, options?)` / `createMongoAbility<A, C>(rules?, options?)`; `dts:PureAbility.d.ts:11` `type CreateAbility<T> = (rules?, options?) => T`. Builder conditions type: `dts:AbilityBuilder.d.ts:12` `InstanceOf<T, S>` (for a string `S`: the tagged instance member of the subject union whose tag is `S`; **`never` if the union has no instance members**), `:13` `ConditionsOf<T, I> = ProduceGeneric<Generics<T>['conditions'], I>` with `dts:hkt.d.ts:15` `ProduceGeneric<T, U> = T extends Container<any> ? (Unpack<T> & Generic<U>)['produce'] : T` — i.e. if `C` carries the hkt `Container` brand it is re-instantiated per subject instance type, otherwise it is used verbatim. `dts:matchers/conditions.d.ts:28-31` `MongoQuery<T> = BuildMongoQuery<MergeUnion<T>, { toplevel: {}; field: Pick<DefaultOperators['field'], keyof defaultInstructions> }> & Container<MongoQueryFactory>` — **no top-level slot for custom operators**.
- **TSC results (5.9.3, installed 6.8.0):**

| Variant | Setup | `{ ownerId }` | `{ $participatesViaMeeting: {...} }` | typo key / bad payload | Verdict |
|---|---|---|---|---|---|
| V1 | `MongoAbility<[A, S]>`, **all-string** `S` | **TS2769** (`MongoQuery<never>` — value `string` not assignable) | TS2769 | — | This is the repo's original TS2769 (`epic:243`): all-string subjects make `InstanceOf` = `never`, so **even scalar conditions fail**; the custom operator was not the only cause |
| V2 | repo's `AppConditions` union (`repo:types.ts:51-61`) | OK | OK | `bogusColumn: 1` errors only because `MongoQuery<never>` rejects the *value*; a string value would pass | compiles; weak |
| V3 | instance-typed `S = 'Customer' \| (Row & ForcedSubject<'Customer'>)`, default `C` (README C8 as written) | OK, key-checked | **TS2769** | `bogusColumn` errors | C8 alone breaks operator-bearing rules |
| V4/V5 | `MongoQuery<T> & { $op?: … }` re-branded with `hkt.Container` | TS2589 "excessively deep" | — | — | do not nest CASL's own branded `MongoQuery` |
| **V6** | hand-rolled query type + hkt brand + `MongoAbility` (below) | OK, key-checked | OK, payload typed | `via: 'nope'` **errors**, `bogusColumn` **errors** | **works** |
| V7 | same as V6 with `PureAbility<[A,S], AppConditions>` | OK | OK | errors | works |
| **V8** | default `C`, per-call explicit instance generic (`docs:advanced/typescript` "Defining Nested Fields", `can<FlatUser>(…)`) | OK | OK | errors | **works**, per call |

- **V6 (recommended) — verified shape:**
  ```ts
  import type { MongoAbility, ForcedSubject, MongoQueryFieldOperators, hkt } from '@casl/ability'
  type CustomerRow = Pick<typeof customers.$inferSelect, 'id' | 'ownerId' | 'age'>
  type AppSubject = 'Customer' | (CustomerRow & ForcedSubject<'Customer'>) | /* …other subjects… */
  type Participation = { via: 'customerId' | 'meetingId' | 'projectId' | 'self', userId: string }
  type FieldQuery<T> = { [K in keyof T]?: T[K] | null | MongoQueryFieldOperators<T[K]> }
  type AppQuery<T> = FieldQuery<T> & { $participatesViaMeeting?: Participation, $inDerivedPipeline?: readonly string[] }
  interface AppQueryFactory extends hkt.GenericFactory { produce: AppQuery<this[0]> }
  export type AppConditions = AppQuery<Record<PropertyKey, unknown>> & hkt.Container<AppQueryFactory>
  export type AppAbility = MongoAbility<[AppAction, AppSubject], AppConditions>
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)
  can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId } })   // typed payload
  can('update', 'Customer', ['age'], { ownerId: userId })                                // fields + conditions
  const ability: AppAbility = build({ conditionsMatcher })
  ```
  Uses only `@casl/ability` exports (`MongoQueryFieldOperators` is re-exported at `dts:matchers/conditions.d.ts:35`; `hkt` at `dts:index.d.ts:7,12`), so README C12 (no direct `@ucast/*` dep) holds. It is the same construction CASL uses for its own `MongoQuery` (`dts:matchers/conditions.d.ts:22-31`). Subjects that stay plain strings (feature gates like `'Dashboard'`) keep working because `InstanceOf` falls back to `AnyObject` only when the union has *some* tagged member.
- **V8 (fallback) — verified shape:** `type WithOps<T> = T & { $participatesViaMeeting?: Participation }` and `can<WithOps<CustomerRow & ForcedSubject<'Customer'>>>('read', 'Customer', { $participatesViaMeeting: … })` on each operator-bearing call, default `MongoQuery` elsewhere.
- The docs' own custom-conditions snippet (`docs:advanced/customize-ability` "Restrict MongoDB Operators", `type AppAbility = MongoAbility<Abilities, RestrictedMongoQuery>`) is not valid TypeScript as printed (a generic alias used without arguments, a stray `}`) and needs `@ucast/mongo2js` as a direct import — do not copy it.

### 1.11 `ForbiddenError.from(ability).throwUnlessCan(action, subject, field?)` — VERIFIED

`dts:ForbiddenError.d.ts:16` `static from<U>(ability: U): ForbiddenError<U>`; `:19` `throwUnlessCan(...args: Parameters<T['can']>): void` (= `(action, subject, field?)`, `dts:types.d.ts:20`); `:20` `unlessCan(...): this | undefined` (returns instead of throwing); `:15,18` `setDefaultMessage`, `setMessage`; instance fields `ability, action, subject, field?, subjectType`. `docs:guide/intro` "Check Permissions and Handle Forbidden Errors". RUN T7 as in §1.8. (7.0.0 only removes the unrelated `getDefaultErrorMessage` export.)

### 1.12 React 19 / Next.js 15 App Router caveats — confirmed

1. **`@casl/react` must be consumed from a `'use client'` module.** The 7.0.1 bundle has no `'use client'` directive and calls `createContext`/`useContext`/`useSyncExternalStore`; a Server Component that imports `AbilityProvider`, `Can` or `useAbility` fails at render. The `ClientAbilityProvider` wrapper in `08 §5.3` is the right shape; it is the only place the package is imported. (Docs silent; bundle inspection + Next.js RSC rules.)
2. **`useAbility()` throws without a provider** (RUN). The repo's current `repo:src/shared/domains/permissions/hooks.ts:16-18` returns a deny-all default from `AbilityContext` (`context.ts:13`) — swapping to `@casl/react` changes "not yet provided" from *deny* to *throw*, which matters for any tree rendered outside the provider (bearer page, error boundaries, `hasMounted`-style shells).
3. **`subject()` tagging inside Server Components before serialisation is wasted.** The tag is non-enumerable and is lost across JSON, superjson (tRPC) and `structuredClone` (RUN), and therefore across RSC→client props (React Flight walks own enumerable keys — inferred). Tag at the consumer, or ship a discriminator and use `build({ detectSubjectType: o => o.__typename })` (`docs:guide/subject-type-detection`) in the shared options module so client and server detect identically.
4. **`subject()` mutates.** `Object.defineProperty` on a frozen object throws; re-tagging a cached object (React `cache()`, TanStack cache) with a *different* type throws; same type is a no-op. Never tag shared constants.
5. **Rules must be JSON-safe when shipped.** `Date` conditions become strings (`08 §6.3`); bake ids as strings (already L7).
6. **Hook deps:** depend on `ability.rules`, not `ability` (`unpkg:@casl/react@7.0.1/README.md` "useAbility usage within hooks").
7. **Version pairing:** keep `@casl/ability` 6.8.0; add `@casl/react` 7.0.1 (peer-compatible, RUN-verified together). Do not upgrade `@casl/ability` to 7.x inside this epic: `rulesToQuery` disappears, `PureAbility` is renamed, `rulesFor` becomes `readonly`, and the `rulesToAST` priority semantics change (§1.5 caveat A) — all of which touch the adapter and the D3 audit.

---

## 2. Verified minimal shapes (6.8.0 + `@casl/react` 7.0.1)

**(a) Build an ability — `AbilityBuilder` + `createMongoAbility` + `conditionsMatcher`** (`docs:advanced/customize-ability`; `dts:AbilityBuilder.d.ts:25-31`; `repo:abilities.ts:83-88` already does this)
```ts
import { AbilityBuilder, createMongoAbility, buildMongoQueryMatcher } from '@casl/ability'
// shared options module — imported by BOTH the server builder and the client provider
export const conditionsMatcher = buildMongoQueryMatcher(
  { $participatesViaMeeting: { type: 'document' }, $inDerivedPipeline: { type: 'document' } },   // instruction keys keep the `$`
  { /* optional JS interpreters, keyed WITHOUT `$`: participatesViaMeeting: (node, row) => … */ },
)
export function defineAbilitiesFor(user: PermissionUser | null): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility)
  if (user?.role === 'agent') {
    can('read', 'Customer', { $participatesViaMeeting: { via: 'customerId', userId: user.id } })
    can('update', 'Customer', ['age'], { $participatesViaMeeting: { via: 'customerId', userId: user.id } })
    cannot('delete', 'Customer').because('agents never delete customers')     // cannot AFTER can; reason only surfaces on inverted rules
  }
  return build({ conditionsMatcher })
}
export const systemAbility = (reason: SystemReason) => {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)
  can('manage', 'all').because(reason)          // stored on rules[0].reason — read it back via relevantRuleFor(...)?.reason
  return build({ conditionsMatcher })
}
```

**(b) `rulesToAST`** (`dts:extra/rulesToQuery.d.ts:11`; `docs:api/casl-ability-extra#rulesToAST`; `repo:scope/compile-scope.ts:9`)
```ts
import { rulesToAST } from '@casl/ability/extra'
const ast = rulesToAST(ability, action, spec.caslSubject)   // subject TYPE, never an instance
if (ast === null) return sql`false`                          // forbidden → fail closed
if (ast.operator === 'and' && Array.isArray(ast.value) && ast.value.length === 0) return undefined   // unconditional → no WHERE
return interpret(ast, table)                                 // FieldCondition(eq|ne|in|nin…) / CompoundCondition(and|or|not) / DocumentCondition(<op>)
```

**(c) `permittedFieldsOf`** (`dts:extra/permittedFieldsOf.d.ts:9`; `docs:api/casl-ability-extra#permittedFieldsOf`)
```ts
import { permittedFieldsOf } from '@casl/ability/extra'
import { subject } from '@casl/ability'
const ALL_FIELDS = Object.keys(getTableColumns(customers))
const allowed = permittedFieldsOf(ability, 'update', subject('Customer', row), {   // tagged ROW → row-aware; 'Customer' → "at least one row"
  fieldsFrom: rule => rule.fields || ALL_FIELDS,                                    // MUST supply the full list for field-less rules
})
const changes = pick(input, allowed)
```

**(d) `packRules` / `unpackRules` round trip** (`dts:extra/packRules.d.ts:30-32`; `docs:cookbook/cache-rules`)
```ts
// server (RSC layout / route)
import { packRules } from '@casl/ability/extra'
const packed = packRules(ability.rules)                       // string subjects → no packSubject needed; transport-only format
// client
import { unpackRules } from '@casl/ability/extra'
import { createMongoAbility } from '@casl/ability'
const ability = createMongoAbility<AppAbility>(unpackRules(packed), { conditionsMatcher })   // SAME matcher module as (a)
```

**(e) `@casl/react` 7.0.1 provider / hook / `<Can>`** (`unpkg:@casl/react@7.0.1/dist/types/*`; README Quick Start)
```tsx
'use client'
import { AbilityProvider, Can, useAbility } from '@casl/react'
export function ClientAbilityProvider({ packed, children }: { packed: PackRule<RawRuleOf<AppAbility>>[], children: React.ReactNode }) {
  const ability = useMemo(() => createMongoAbility<AppAbility>(unpackRules(packed), { conditionsMatcher }), [packed])
  return <AbilityProvider value={ability}>{children}</AbilityProvider>       // prop is `value` (README's `ability=` is drift)
}
export const useAppAbility = () => useAbility<AppAbility>()                  // throws if rendered outside the provider
// usage
<Can I="update" this={subject('CustomerNote', note)} field="body">…</Can>    // instance check; `a`/`an` for type checks; `not`, `passThrough`, render-prop {isAllowed, ability, reason}
```

**(f) `subject()`** (`dts:utils.d.ts:4`; `docs:guide/subject-type-detection`)
```ts
import { subject } from '@casl/ability'
ability.can('update', subject('CustomerNote', row))          // row is a Drizzle row or a DTO that came over tRPC (re-tag after superjson/JSON)
ForbiddenError.from(ability).throwUnlessCan('update', subject('CustomerNote', row), 'body')
```

---

## 3. Corrections that change a decision's *mechanism* (README §L)

| Entry | Stated mechanism | At the real API | Decision impact |
|---|---|---|---|
| **L7** | `.because(reason)` "keeps the audit trail recoverable through `ForbiddenError` without a wrapper (verified on 6.8.0)" | `.because()` exists and stores `reason` on the raw rule, but `ForbiddenError` only reports `reason` for **inverted** rules; a `manage all` ability never throws (§1.8) | Decision (reason on the rule, no wrapper) **stands**. Retrieval = `ability.rules[0].reason` / `relevantRuleFor(action, subject)?.reason`; log it at `systemContext(reason)` construction if an audit line is wanted. |
| **L8** | `rulesToAST` returns unconditional allow for a fields-only rule | **Verified** — and the runtime `can()` grants the verb on every row too (§1.5). Two added facts: 6.8.0 `rulesToAST` ANDs every conditioned `cannot` regardless of rule age (over-restrictive; fixed 7.0.0 #1193); `conditions: {}` counts as "conditioned" in `rulesToQuery` | Decision (mutation WHERE = `toWhere(action) AND toWhere('read')`) **stands**. D3's audit should additionally (i) require `cannot` rules to be appended last per action/subject and (ii) treat `{}` as conditionless. |
| **L10** | "an instance check throws, and a `cannot` with an unknown operator fails open" | Two different matcher configurations (§1.9). With the decided shared matcher module both sides **throw**; fail-open needs a client *without* the instructions | Decision (ship `packRules`, `@casl/react` 7.0.1, `subject()`, boot-assert guard) **stands**; `@casl/react` 7.0.1 API/peer range verified. Add to guard (a): no client *instance* `read` checks on operator-bearing subjects, **or** register JS interpreters (escape hatch (b)) in the shared module. Provider must be in a `'use client'` file; `useAbility` throws without it (§1.12). "Re-tag after JSON" also means after superjson/tRPC. |
| **L3** | `bearerActor` rules `can('update', S, [allowlist], { id })`; conditionless `read Proposal` deleted because it OR-merges | Both verified (§1.7) | none |
| **C8** (§C) | type conditions per subject via `Pick<typeof customers.$inferSelect, …>` | With instance-typed subjects the default `MongoQuery` **rejects** custom top-level operators (TSC V3); the hkt-branded `AppConditions` in §1.10 V6 (or per-call V8) is required | Mechanism changes; intent unchanged. |
| **C12** (§C) | no `@ucast/core` unless `instanceof` dispatch is adopted | `node_modules/@ucast` absent — confirmed; V6 needs no ucast import | none |
| Versions | README/08 cite `@casl/ability ^6.8.0 → 6.8.0`, `@casl/react` 7.0.1 latest | Both correct; **`@casl/ability` 7.0.1 also exists** (breaking) — stay on 6.8.0 for this epic | none; note recorded to prevent an accidental `pnpm up` |

L1, L2, L4, L5, L6, L9 make no library-API claims beyond those above.

---

## Appendix A — RUN transcript (abridged; `node v24.14.1`, installed `@casl/ability@6.8.0`, ucast 1.4.1/2.4.3/3.1.0/1.10.2)

```
--- T1 subject() tagging
same object true · enumerable keys ["id","authorId"] · JSON {"id":"n1","authorId":"u1"} · descriptor enumerable false
can update tagged true · can update JSON-roundtrip (untagged) false · re-tagged after JSON true · detectSubjectType(untagged) Object
retag other type throws: Trying to cast object to subject type Other but previously it was casted to CustomerNote · structuredClone keeps tag? false
--- T3/T8 custom operator + unknown-op behaviour   ($participatesViaMeeting = { type:'document' }, no interpreter)
(a) AST DocumentCondition(participatesViaMeeting)={"via":"self","userId":"u1"} · type-level can true
(a) instance can THROWS  Unable to interpret "participatesViaMeeting" condition. Did you forget to register interpreter for it?
(a) cannot-rule instance can THROWS (same) · cannot-rule type-level can true
(a) newer matching rule shadows throwing older → true · newer NON-matching then older throwing → THROWS
(b) default matcher: type-level true · instance can false (no throw) · AST FieldCondition(eq,$participatesViaMeeting) · cannot w/ unregistered op: instance can true  (fail-open)
(c) operatorToConditionName passed → AST op participatesViaMeeting · interpreter keyed WITH $ → THROWS · getInterpreterName remaps lookup → true
(c) instruction key w/o $ → THROWS Unable to interpret "articipatesViaMeeting" condition
--- T4 rulesToAST
deny-all null · conditionless can and([]) · FIELDS-only can and([]) · FIELDS-only rulesToQuery {} · fields+conditions eq(ownerId) · cond OR cond or[eq(b),eq(a)]
cond + conditionless and([]) · manage all and([]) · can then cannot(cond) not[eq(archived)] · can(cond) then cannot(cond) and[not[eq(archived)], eq(ownerId)]
--- priority (6.8.0)   can{a:1}; cannot{b:2}; can{c:3}
instance can {c:3,b:2} true · instance can {a:1,b:2} false · rulesToQuery {"$or":[{c:3},{a:1}],"$and":[{b:2}]}
rulesToAST and[not[eq(b,2)], or[eq(c,3), eq(a,1)]]   ← excludes {c:3,b:2} that can() allows
fields-only beside conditioned → AST and([]) · can update other row (no field) true · field age other row true · field name other row false
can(read,X,{}) → AST and([]) · rulesToQuery {"$or":[{}]} · can instance true
--- T5 permittedFieldsOf
type string [age,name,notes] · own row (tagged) [age,name,notes] · other row (tagged) [notes] · untagged POJO [] · conditionless+cannot(fieldsFrom ALL) [id,ownerId,age,name,notes] · w/o fieldsFrom fallback []
--- T6/T7 builder, precedence, because()
raw {"action":"update","subject":"Customer","fields":["age"],"conditions":{"ownerId":"u1"}} · because() function · after because … "reason":"own rows only"
system rules [{"action":"manage","subject":"all","reason":"job:gcal-sync"}] · relevantRuleFor(read,Customer).reason job:gcal-sync · ForbiddenError on manage-all: not thrown
inverted because → ForbiddenError: archived rows hidden | action=read subjectType=X · unlessCan returns error true · no rule: Cannot execute "read" on "X" | field=title
cannot-before-can true · can-before-cannot false · conditionless OR-merge → any row true
--- T2 packRules / unpackRules
packed [["read","Customer",{"ownerId":"u1"}],["update","Customer",{"ownerId":"u1"},0,"age"],["delete","Customer",{"locked":true},1,0,"locked"],["read","Meeting",{"$participatesViaMeeting":{…}}]]
unpacked[1] {"inverted":false,"action":["update"],"subject":["Customer"],"conditions":{"ownerId":"u1"},"fields":["age"]}
identical can() results (same matcher) true · client update field age own true · name own false · client AST read Meeting DocumentCondition(participatesViaMeeting) · reason survives pack
--- T12 superjson (tRPC transformer)
round-trip keeps tag false · serialized {"json":{"id":"c1","ownerId":"u1"}}
--- react-smoke (React 19.2.4 + @casl/react@7.0.1 bundle)
render: own-note-yes<!-- -->type-level-yes<i>true</i> · useAbility w/o provider throws: AbilityContext is not provided. Please make sure to wrap your component tree with <AbilityProvider>.
```

## Appendix B — TSC transcript (abridged; `tsc 5.9.3 --strict --moduleResolution bundler`)

```
V1 all-string subjects, MongoAbility<[A,S]>            : {ownerId:'u1'} → TS2769 (conditions?: MongoQuery<never>) ; {$participatesViaMeeting} → TS2769 ; fields+conditions → TS2322
V2 repo AppConditions union                            : scalar OK · custom op OK · {bogusColumn:1} → TS2769 (value-type accident)
V3 Row&ForcedSubject subjects, default C               : {ownerId} OK · {bogusColumn} → TS2769 · {$participatesViaMeeting} → TS2769 ("does not exist in type MongoQuery<CustomerRow & ForcedSubject<"Customer">>")
V4/V5 MongoQuery<T> & {…} + Container                  : TS2589 Type instantiation is excessively deep and possibly infinite
V6 FieldQuery<T>&{$op} + hkt.Container, MongoAbility   : scalar OK · custom op OK · via:'nope' → TS2769 (expected) · {bogusColumn} → TS2769 (expected) · fields+conditions OK · build() typed OK
V7 same with PureAbility                               : identical to V6
V8 default C + can<WithOps<Row&ForcedSubject>>(…)       : scalar OK · custom op OK · via:'nope' → TS2769 (expected) · {bogusColumn} → TS2769 (expected)
```
