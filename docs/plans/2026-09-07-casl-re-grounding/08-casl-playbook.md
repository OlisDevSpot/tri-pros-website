# 08 — CASL playbook for this app (ability-only, compute-once-per-route)

**Decision context (user-ruled 2026-09-08):** CASL is the single source of truth for permissions. The `Actor` tagged union (`user | token | system`) is DROPPED; the principal IS the ability (built from the session user, for an anonymous share-token bearer, or for a system job). The ability is computed ONCE per route (tRPC procedure / React UI / `route.ts`) and every downstream check — verb, field, row (Drizzle WHERE) — derives from that one instance.

**Mode:** read-only research. No `src/` edits, no git state changes, no `pnpm build/tsc/lint`. Written 2026-09-08.

**Sources & verification method (every claim cites one of these):**

| Key | What | Where |
|---|---|---|
| `docs:<page>` | CASL official docs, fetched via Context7 (`/stalniy/casl`). `<page>` = path under `docs-src/src/content/pages/`, e.g. `docs:guide/intro`, `docs:api/casl-ability`, `docs:api/casl-ability-extra`, `docs:advanced/ability-to-database-query`, `docs:advanced/customize-ability`, `docs:cookbook/cache-rules`. Package READMEs cite as `docs:packages/casl-react/README`, etc. | Context7 |
| `dts:<file>:<line>` | **Installed** `@casl/ability@6.8.0` type declarations — the signature ground truth for THIS app | `node_modules/@casl/ability/dist/types/<file>` |
| `ucast:<pkg>/<file>:<line>` | Installed ucast declarations/READMEs resolved through pnpm (`@ucast/core@1.10.2`, `@ucast/mongo@2.4.3`, `@ucast/js@3.1.0`, `@ucast/mongo2js@1.4.1`) | `node_modules/.pnpm/@ucast+<pkg>@<ver>/node_modules/@ucast/<pkg>/…` |
| `impl:<file>:<line>` | Installed **compiled** source (`dist/es6m/index.mjs`, `dist/es6m/extra/index.mjs`), line numbers after splitting on `;` (minified) — cited only where the `.d.ts` is silent on behaviour | same package |
| `VERIFIED` | Ran against the installed packages with `node -e` (no files written); abridged transcript in Appendix A | this session |
| `ref:<file>:<line>` | `WebDevSimplified/casl-crash-course` @ `e113223d` (2025-10-01), `@casl/ability ^6.7.3`, `drizzle-orm ^0.44.5`, `next 15.5.4` | `<scratchpad>/casl-crash-course/` |
| `@casl/react` | NOT installed here. Signatures fetched from unpkg for `7.0.1` (latest, 2026-09), `6.0.0`, `5.0.1`, `4.0.0` | unpkg |

**Installed here** (`package.json` + `pnpm-lock`): `@casl/ability ^6.8.0` → 6.8.0 (depends on `@ucast/mongo2js ^1.3.0` → 1.4.1), `drizzle-orm ^0.45.1`, `@trpc/server ^11.4.1`, `next 15.5.9`, `react ^19`. **No `@casl/react`, no direct `@ucast/*` dependency** — `@ucast/core` is only reachable transitively (the reference repo imports it directly at `ref:src/lib/permissions/drizzleAdapter.ts:5`; if we do the same we must add `@ucast/core` as a direct dependency, pnpm will not hoist it).

**Where docs are silent** (explicit, so nobody invents): no dedicated "anonymous/guest" recipe (§1.5); no "system / service-account / background job" principal (§1.6); no Next.js / tRPC / RSC recipe (§6); no Drizzle adapter (§3.5); no explicit "custom operators must be registered on the client too" sentence (§4.5, inferred + VERIFIED); no typed binding helper for `<Can>` in `@casl/react` 7 (§5.4); no cache-invalidation guidance beyond LRU-by-user-id (§6.3).

---

## 1. Defining abilities per principal

### 1.1 Exact API (installed 6.8.0)

```ts
// dts:AbilityBuilder.d.ts:25-32
class AbilityBuilder<T extends AnyAbility> {
  rules: RawRuleOf<T>[];                 // the raw JSON rules accumulated so far
  can: AddRule<T>;                       // (action | action[], subject | subject[], fields?: F | F[], conditions?) => RuleBuilder
  cannot: AddRule<T>;                    //  …or (action, subject, conditions?)            — dts:AbilityBuilder.d.ts:18-24
  build: (options?: AbilityOptionsOf<T>) => T;
  constructor(AbilityType: AbilityFactory<T>); // pass createMongoAbility (or an Ability class)
}
// RuleBuilder (return of can/cannot): .because(reason: string): this   — dts:AbilityBuilder.d.ts:6-10

// dts:Ability.d.ts:15-21
interface MongoAbility<A extends AbilityTuple = AbilityTuple, C extends MongoQuery = MongoQuery> extends PureAbility<A, C> {}
function createMongoAbility<T extends AnyMongoAbility = MongoAbility>(rules?: RawRuleOf<T>[], options?: AbilityOptionsOf<T>): T;
function createMongoAbility<A extends AbilityTuple = AbilityTuple, C extends MongoQuery = MongoQuery>(rules?: RawRuleFrom<A, C>[], options?: AbilityOptions<A, C>): MongoAbility<A, C>;

// dts:AbilityBuilder.d.ts:34-36 — sugar; ALWAYS uses createMongoAbility (impl:index.mjs:166), cannot take a custom factory
function defineAbility<T extends AnyMongoAbility = MongoAbility>(define: (can, cannot) => void | Promise<void>, options?: AbilityOptionsOf<T>): T | Promise<T>;

// dts:RawRule.d.ts:2-17 — the serializable rule shape
interface SubjectRawRule<A extends string, S extends SubjectType, C> {
  action: A | A[]; subject: S | S[]; fields?: string | string[]; conditions?: C; inverted?: boolean; reason?: string;
}

// dts:RuleIndex.d.ts:5-9 — build()/createMongoAbility options
interface RuleIndexOptions<A, C> extends Partial<RuleOptions<C>> {   // RuleOptions: conditionsMatcher?, fieldMatcher?, resolveAction (dts:Rule.d.ts:4-8)
  detectSubjectType?(subject): ExtractSubjectType<…>;
  anyAction?: string;        // default 'manage'  (impl:index.mjs:72)
  anySubjectType?: string;   // default 'all'     (impl:index.mjs:73)
}
```

`Ability` (the class) is **deprecated** in favour of `createMongoAbility` + `MongoAbility` (`dts:Ability.d.ts:6-9`).

### 1.2 Typing: `MongoAbility<[Action, Subject]>`, `InferSubjects`, `ForcedSubject`

```ts
// dts:types.d.ts:12-14, 21, 25-34
type AbilityTuple<X extends string = string, Y extends Subject = Subject> = [X, Y];
type ExtractSubjectType<S extends Subject> = Extract<S, SubjectType> | TagName<S>;
type InferSubjects<T, IncludeTagName extends boolean = false> =
  T | (T extends AnyClass<infer I> ? I | (IncludeTagName extends true ? …Name… : never) : TagName<T>);
interface ForcedSubject<T> { readonly __caslSubjectType__: T }
type TaggedInterface<T extends string> = ForcedSubject<T> | { readonly kind: T } | { readonly __typename: T };
```

Documented TS recipe for string-typed subjects + POJO instances (`docs:cookbook/roles-with-persisted-permissions`):

```ts
import { createMongoAbility, MongoAbility, RawRuleOf, ForcedSubject } from '@casl/ability';

export const actions  = ['manage', 'create', 'read', 'update', 'delete'] as const;
export const subjects = ['Article', 'all'] as const;
export type Abilities = [
  typeof actions[number],
  typeof subjects[number] | ForcedSubject<Exclude<typeof subjects[number], 'all'>>
];
export type AppAbility = MongoAbility<Abilities>;
export const createAbility = (rules: RawRuleOf<AppAbility>[]) => createMongoAbility<AppAbility>(rules);
```

Drizzle-flavoured variant (reference repo, `ref:src/lib/permissions/getUserPermissions.ts:5-10`): the instance side of the union is `Pick<typeof todo.$inferSelect, 'public' | 'userId'> | 'Todo'`. The builder's `conditions` argument is then typed as `MongoQuery<instance>` (`dts:AbilityBuilder.d.ts:12-13,18-19`: `ConditionsOf<T, I> = ProduceGeneric<Generics<T>['conditions'], I>`), so `can('read', 'Todo', { userId: user.id })` is key-checked against the Drizzle row type. Dot-path keys are not typed unless you widen the instance type (`ucast:mongo2js/README.md:157-176` shows the `'address.city'` intersection trick).

⚠️ **TS tag ≠ runtime tag.** `TaggedInterface` accepts `{ kind: 'Todo' }` / `{ __typename: 'Todo' }` at the type level (`dts:types.d.ts:29-33`), but the default runtime detector only reads `__caslSubjectType__` (set by `subject()`) or `constructor.modelName || constructor.name` (`impl:index.mjs:8-10`; `docs:api/casl-ability#detectSubjectType`). A `kind` field does nothing at runtime unless you pass `detectSubjectType: o => o.kind` (`docs:guide/subject-type-detection`, `__typename` example). See §7.2.

### 1.3 Baking user-specific values into conditions, and why

```ts
// docs:packages/casl-ability/README (verbatim)
function defineAbilitiesFor(user) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);
  can('read', 'BlogPost');
  can('manage', 'BlogPost', { author: user.id });                 // user id BAKED IN
  cannot('delete', 'BlogPost', { createdAt: { $lt: Date.now() - 24 * 60 * 60 * 1000 } });
  return build();
}
```

Why the docs bake `user.id` into conditions rather than closing over `user`:
- Conditions are a MongoDB-query subset **because** that is a JSON-like, closure-free language that evaluates against plain JS objects (`docs:guide/conditions-in-depth` "MongoDB and its query language").
- The resulting rules are plain JSON: `createMongoAbility([{ action, subject, conditions }])` "when receiving permissions over the network" (`docs:guide/define-rules` "Create Ability with JSON Rules"); `packRules(defineRulesFor(user))` goes into a JWT and the client does `ability.update(unpackRules(token.rules))` (`docs:cookbook/cache-rules`, `docs:api/casl-ability-extra#packRules`).
- A function-based `conditionsMatcher` is explicitly "not recommended if you need to serialize rules or convert them to database queries" (`docs:advanced/customize-ability` "Custom conditions matcher implementation").
- `rulesToQuery` / `rulesToAST` read `rule.conditions` / `rule.ast` only (`impl:extra/index.mjs:30-45`) — the WHERE clause can only see what was baked in.
- `rulesToFields(ability, 'create', 'Todo')` even harvests those baked scalars as defaults for new objects (`docs:api/casl-ability-extra#rulesToFields`; VERIFIED → `{ userId: 'u1', public: true }`).

**Consequence for our design:** the ability is self-contained; nothing downstream needs `user` — verb checks, field checks, and the Drizzle WHERE all derive from the rules alone. That is exactly what makes "compute once, pass the ability" sound. **User ids belong in conditions** (`{ ownerId: user.id }`, `{ assignedTo: { $in: teamIds } }`), never in closures or a side-channel `ctx.user` consulted by the DAL.

### 1.4 Role-per-`switch` vs `defineAbility`

- `defineAbility((can, cannot) => …)` is for static/global abilities (`docs:guide/define-rules`); it is sugar over `AbilityBuilder` + `createMongoAbility` and cannot take a custom factory (`dts:AbilityBuilder.d.ts:34-36`, `impl:index.mjs:166`).
- Per-user: `new AbilityBuilder(createMongoAbility)` inside `defineAbilityFor(user)` with `if (user.isAdmin) … else …` (`docs:guide/define-rules` "Define Conditional Rules with AbilityBuilder").
- Role table: `rolePermissions[user.role](user, builder)` with an explicit throw for unknown roles (`docs:cookbook/roles-with-static-permissions`):

```ts
export function defineAbilityFor(user: User): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  if (typeof rolePermissions[user.role] === 'function') rolePermissions[user.role](user, builder);
  else throw new Error(`Trying to use unknown role "${user.role}"`);
  return builder.build();
}
```

- Split `defineRulesFor(user) → rules` from `defineAbilityFor(user) → createMongoAbility(rules)` when rules need I/O or must be cached/serialized (`docs:cookbook/cache-rules` "Define CASL Rules and Abilities"; `docs:advanced/debugging-testing` — "test the rule distribution logic, not ability checks").

### 1.5 The anonymous / guest ability

Docs have no named "guest" recipe. Documented mechanics: an ability with **no rules forbids everything** — `ability.update([])` "forbids everything" (`docs:guide/intro`), `createMongoAbility([])` (VERIFIED: `can('read','Todo') === false`, `rulesToAST === null`). Reference repo pattern: `getUserPermissions(user | undefined)` grants the public baseline unconditionally and the rest inside `if (user != null)` (`ref:src/lib/permissions/getUserPermissions.ts:12-35`).

For a **share-token bearer** (anonymous, but scoped to specific rows), the docs' JWT cookbook is the closest analogue: rules are minted server-side and the request-side ability is simply `createMongoAbility(rules)` from the verified token payload (`docs:cookbook/cache-rules` "Provide Ability Middleware (JWT Payload)"). A token-bearer ability is therefore just: `can('read', 'Proposal', { id: token.proposalId })` (+ whatever fields), built from the token row — no special principal type.

### 1.6 A "system" / service ability

Docs are silent on service accounts, cron jobs, or server-to-server callers. The documented superuser idiom is `can('manage', 'all')` — "read-write access to everything" (`docs:guide/define-rules`), refinable with `cannot('delete', 'all')` after it (`docs:guide/intro` "Define Manage All Except Delete"). VERIFIED for query generation: `can('manage','all')` → `rulesToQuery === {}` and `rulesToAST === CompoundCondition('and', [])` (unconditional); adding `cannot('delete','all')` → `rulesToQuery(…,'delete','Todo') === null` and `can('delete','Todo') === false`.

**Recommendation grounded in the docs:** represent the system caller as a `createMongoAbility([{ action: 'manage', subject: 'all' }])` instance (optionally narrowed with `cannot` rules per job), so the DAL never needs a `system` branch: the WHERE compiler sees an unconditional rule and emits no filter (§3.2).

### 1.7 Rule precedence, `manage`/`all`, and the OR-merge hazard

- **Same action+subject rules are OR-ed** (`docs:guide/define-rules` "Rules"); AND is expressed with inverted rules; logical `$and/$or/$nor/$not` are deliberately not condition operators (`docs:guide/conditions-in-depth` "Why logical query operators are not included"). All keys inside one conditions object are AND-ed (same page).
- **Later-defined wins.** `can` returns the first matching rule of `rulesFor(action, type, field)`, which is ordered most-recently-defined first (`impl:index.mjs:132-138`; `docs:guide/intro` "Inverted rules": "place `cannot` after `can`"). VERIFIED: `cannot('read','Todo',{private:true}); can('read','Todo',{userId:'u1'})` → `can('read', subject('Todo',{userId:'u1',private:true})) === true` (the cannot is overridden); the reverse order → `false`.
- `manage` = any action, `all` = any subject (`docs:guide/intro` "Basics"); renameable via `anyAction`/`anySubjectType` (`dts:RuleIndex.d.ts:7-8`). `possibleRulesFor(action, type)` merges the `(action,type)`, `(manage,type)`, `(action,all)`, `(manage,all)` buckets by priority (`impl:index.mjs:102-111`). Aliases: `createAliasResolver({ modify: ['update','delete'] })` → `build({ resolveAction })` (`docs:guide/define-aliases`); aliasing `manage` throws (`impl:index.mjs:19-28`).
- **OR-merge hazard.** A conditionless direct rule beside conditioned ones makes the whole (action, subject) unconditional: VERIFIED `can('read','Todo',{userId:'u1'}); can('read','Todo')` → `rulesToQuery === {}`, `rulesToAST === and([])`, `can('read','Todo') === true`. The reference repo relies on this deliberately for admins (`ref:src/lib/permissions/getUserPermissions.ts:22,28`). Accidental version: a role branch that adds `can('read','Customer')` next to an agent's `{ assignedTo: user.id }` rule silently removes the row filter. Mitigation in the docs' spirit: keep the conditionless grant in an explicit admin branch, and assert in tests via `rulesToQuery` (see §7.12).

---

## 2. Checking

### 2.1 Signatures

```ts
// dts:PureAbility.d.ts:12-16 ; CanParameters = (action, subject, field?) — dts:types.d.ts:20
class PureAbility<A, C> extends RuleIndex<A, C> {
  can(...args: CanParameters<A>): boolean;
  relevantRuleFor(...args: CanParameters<A>): Rule<A, C> | null;
  cannot(...args: CanParameters<A>): boolean;          // === !can  (impl:index.mjs:138)
}
// dts:RuleIndex.d.ts:59-65
get rules(): RawRuleFrom<A, C>[];
update(rules: RawRuleFrom<A, C>[]): this;
possibleRulesFor(action, subjectType): Rule[];          // 2nd arg MUST be a type (string/class) — throws otherwise (impl:index.mjs:102)
rulesFor(action, subjectType, field?): Rule[];
actionsFor(subjectType): string[];
on('update' | 'updated', handler): Unsubscribe;

// dts:utils.d.ts:4 ; exported as `subject` (dts:index.d.ts:13) ; docs:api/casl-ability#subject
function setSubjectType<T extends string, U extends Record<PropertyKey, any>>(type: T, object: U): U & ForcedSubject<T>;
```

### 2.2 Type check vs instance check

```ts
// docs:guide/intro "Define Basic Article Read Permission" / "Checking logic"
const ability = defineAbility(can => { can('read', 'Article', { published: true }) });
ability.can('read', new Article({ published: true })); // instance: "can I read THIS article?"
ability.can('read', 'Article');                        // type:     "can I read ANY article?" → true
```

Docs: a type check "is useful for early failure during creation flows, but requires a final check on the actual subject before API or database requests" (`docs:guide/intro` "Checking logic"). Mechanically, for a type argument a conditioned **direct** rule matches and a conditioned **inverted** rule does not (`impl:index.mjs:56-57`: `if (!object || isSubjectType(object)) return !this.inverted`). VERIFIED: with `can('delete','Todo',{userId:'u1',public:false}); cannot('delete','Todo',{locked:true})`, `can('delete','Todo') === true`.

### 2.3 Plain objects need `subject()`

```ts
// docs:guide/subject-type-detection "Use subject Helper for DTOs"
import { subject } from '@casl/ability';
ability.can('read', subject('Article', article));
```

VERIFIED runtime facts (`impl:index.mjs:3-6`):
- `subject()` **mutates and returns the same object** by defining a non-enumerable `__caslSubjectType__`; `Object.keys` and `JSON.stringify` do not show it (so the tag is lost across tRPC/JSON — the client must re-tag).
- Re-tagging the same object with a different type **throws** `Trying to cast object to subject type X but previously it was casted to Y`.
- Checking an untagged POJO does **not** throw: `detectSubjectType` returns `"Object"`, no rules match, result `false`. Silent false → an easy-to-miss bug (§7.1).

Alternative when DTOs carry a discriminator: `build({ detectSubjectType: o => o.__typename })` (`docs:guide/subject-type-detection`; option typed at `dts:RuleIndex.d.ts:6`). For class subjects cast `object.constructor as ExtractSubjectType<Subjects>` (same page).

### 2.4 Field checks

```ts
// docs:guide/restricting-fields "Check Field Permissions on Subject Instance vs. Type"
ability.can('update', ownArticle, 'title');     // true
ability.can('update', anotherArticle, 'title'); // false
ability.can('update', 'Article', 'title');      // true! — "at least one article"
```

VERIFIED extra semantics: a field-less check ignores field restrictions — with only `can('update','Todo',['title','complete'],{userId:'u1'})`, `can('update','Todo') === true` and `can('update', subject('Todo',{userId:'u1'}), 'secret') === false`. (`impl:index.mjs:59-60`: `matchesField(undefined)` → `!inverted`.) Field patterns: `'address.*'` matches one level, `'address.**'` any depth (`docs:guide/restricting-fields`; `fieldPatternMatcher` `dts:matchers/field.d.ts`). `fields: []` throws at rule construction (`impl:index.mjs:43`).

### 2.5 `ForbiddenError`

```ts
// dts:ForbiddenError.d.ts:8-21
class ForbiddenError<T extends AnyAbility> extends Error {
  readonly ability: T; action; subject; field?: string; subjectType: string;
  static setDefaultMessage(messageOrFn: string | ((error: ForbiddenError<AnyAbility>) => string)): void;
  static from<U extends AnyAbility>(ability: U): ForbiddenError<U>;
  setMessage(message: string): this;
  throwUnlessCan(...args: Parameters<T['can']>): void;
  unlessCan(...args: Parameters<T['can']>): this | undefined;   // returns the error instead of throwing
}
```

Message precedence (`impl:index.mjs:183-184`): `setMessage(...)` > matched inverted rule's `reason` > default `Cannot execute "${action}" on "${subjectType}"` (`impl:index.mjs:169`; override globally with `ForbiddenError.setDefaultMessage(err => …)` — `docs:api/casl-ability` "Set Default ForbiddenError Message"). VERIFIED: with `cannot('delete','Todo',{locked:true}).because('Locked todos are immutable')`, `throwUnlessCan('delete', subject('Todo',{…locked:true}))` throws `ForbiddenError` with `message === 'Locked todos are immutable'`, `action === 'delete'`, `subjectType === 'Todo'`; when **no** rule matches at all the message is the default (no reason available — `reason` only lives on inverted rules, `docs:advanced/debugging-testing`). Catch with `instanceof ForbiddenError` (`docs:guide/intro` "Forbidden reasons").

`relevantRuleFor(...)` returns the internal `Rule` (with `.conditions`, `.fields`, `.reason`, `.inverted`, `.origin` = the raw rule, `.ast`) or `null` (`dts:Rule.d.ts:13-25`; `docs:api/casl-ability#relevantRuleFor`).

### 2.6 `permittedFieldsOf`

```ts
// dts:extra/permittedFieldsOf.d.ts:6-9
interface PermittedFieldsOptions<T> { fieldsFrom: (rule: RuleOf<T>) => string[] }
function permittedFieldsOf<T extends AnyAbility>(ability: T, action, subject: Parameters<T['can']>[1], options: PermittedFieldsOptions<T>): string[];

// docs:api/casl-ability-extra#permittedFieldsOf (express example)
const updatableFields = permittedFieldsOf(ability, 'update', 'Article', {
  fieldsFrom: rule => rule.fields || [/* list of all fields for Article */]
});
const changes = pick(req.body, updatableFields);
```

Semantics (`impl:extra/index.mjs:17-25`): walks `possibleRulesFor(action, type)` oldest→newest, `fieldsFrom(rule)` is **added** for direct rules and **removed** for inverted rules, so a later `cannot(...,['secret'])` subtracts. `fieldsFrom` MUST supply the full field list for rules without `fields`, otherwise a conditionless rule contributes nothing. Instance vs type: with a type, conditioned direct rules count ("at least one"); with an instance only rules whose conditions match count — VERIFIED: `['title','complete']` for the type, `[]` for another user's row. `AccessibleFields` (`dts:extra/permittedFieldsOf.d.ts:14-27`) is the helper class for building an `accessibleFieldsBy(ability, action).ofType(T)` / `.of(instance)`.

---

## 3. Query generation

### 3.1 Signatures

```ts
// dts:extra/rulesToQuery.d.ts:5-11
type RuleToQueryConverter<T, R = object> = (rule: RuleOf<T>) => R;
interface AbilityQuery<T = object> { $or?: T[]; $and?: T[] }
function rulesToQuery<T extends AnyAbility, R = object>(ability: T, action, subjectType: ExtractSubjectType<…>, convert: RuleToQueryConverter<T, R>): AbilityQuery<R> | null;
function rulesToAST<T extends AnyAbility>(ability: T, action, subjectType: ExtractSubjectType<…>): Condition | null;   // Condition from @ucast/mongo2js (= @ucast/core)
// dts:extra/rulesToFields.d.ts:6
function rulesToFields<T extends PureAbility<any, AnyObject>>(ability: T, action, subjectType): AnyObject;
```

Both take a **subject type**, never an instance (they call `rulesFor(action, subjectType)`; `impl:extra/index.mjs:32,41`).

### 3.2 The `null` / `{}` contract (docs + VERIFIED)

Docs: `rulesToQuery` "returns `null` if user is not allowed to run specified `action` on specified `subjectType`, otherwise an object of optional `$and` and `$or` fields. `$and` contains results of transformation from inverted rules and `$or` contains results of direct rules" (`docs:api/casl-ability-extra#rulesToQuery`); `rulesToAST` likewise returns `null` when forbidden (`#rulesToAST`).

Algorithm (`impl:extra/index.mjs:30-39`), iterating `rulesFor(...)` newest→oldest:

| Rule encountered | Effect |
|---|---|
| direct, with conditions | `convert(rule)` pushed to `$or` |
| inverted, with conditions | `convert(rule)` pushed to `$and` (converter must negate — docs' Sequelize example: `rule.inverted ? { $not: rule.conditions } : rule.conditions`, `docs:advanced/ability-to-database-query`) |
| **direct, no conditions** | return immediately: `{}` (unconditional) or `{ $and: [...] }` (unconditional minus exclusions collected so far) |
| **inverted, no conditions** | `break` — older rules are dead; whatever was collected after it decides |
| loop ends with empty `$or` | `null` (forbidden) |

VERIFIED outputs: `{ "$or": [{userId:'u1'},{public:true}] }`; conditionless direct → `{}`; no rules → `null`; `can('manage','all'); cannot('delete','all')` → `null` for `delete`; `can(cond); cannot('read','Proj')` → `null`; `cannot('read','Proj'); can(cond)` → `{ $or: [cond] }` (the older conditionless cannot is discarded).

`rulesToAST` (`impl:extra/index.mjs:40-45`) uses `rule.ast` (throws `Ability rule … does not have "ast" property` if a rule was built with a function matcher), wraps inverted rules as `new CompoundCondition('not', [ast])`, then returns `buildAnd([...inverted, buildOr(direct)])`. **Unconditional therefore surfaces as `CompoundCondition('and', [])`** (VERIFIED), single conditions collapse to the bare node (`buildAnd`/`buildOr` optimisation — `ucast:mongo/README.md:62-87`).

VERIFIED AST shapes (operator names have the `$` stripped — `ucast:mongo/README.md:89`):

```
can('read','Todo',{public:true}); can('read','Todo',{userId:'u1'})
  → CompoundCondition(or)[ FieldCondition(eq, userId, 'u1'), FieldCondition(eq, public, true) ]
can('delete','Todo',{userId:'u1',public:false}); cannot('delete','Todo',{locked:true})
  → CompoundCondition(and)[ CompoundCondition(not)[ FieldCondition(eq, locked, true) ], FieldCondition(eq, userId,'u1'), FieldCondition(eq, public,false) ]
can('read','Device',{ id: { $in: ['d1','d2'] } })          → FieldCondition(in, id, ['d1','d2'])   // NOT 'within'
can('read','Proj',{ 'meta.ownerId':'u1', status:{$ne:'archived'}, tags:{$in:['a','b']} })
  → CompoundCondition(and)[ FieldCondition(eq,'meta.ownerId','u1'), FieldCondition(ne,status,'archived'), FieldCondition(in,tags,[…]) ]
can('read','Proj'); cannot('read','Proj',{archived:true})   → CompoundCondition(not)[ FieldCondition(eq, archived, true) ]
```

### 3.3 ucast node shapes

```ts
// ucast:core/dist/types/Condition.d.ts:6-24
abstract class Condition<T = unknown> { readonly operator: string; readonly value: T; get notes(); addNote(note) }
class DocumentCondition<T> extends Condition<T> {}                          // whole-row test, no field
class CompoundCondition<T extends Condition = Condition> extends DocumentCondition<T[]> { constructor(operator: string, conditions: T[]) }
const ITSELF = "__itself__";
class FieldCondition<T = unknown> extends Condition<T> { readonly field: string | typeof ITSELF; constructor(operator, field, value) }
const NULL_CONDITION: DocumentCondition<null>;
// ucast:core/dist/types/builder.d.ts — buildAnd(conditions), buildOr(conditions)
```

Default operator vocabulary produced by `createMongoAbility`'s parser (`impl:index.mjs:138`): `eq ne lt lte gt gte in nin all size regex elemMatch exists` + compound `and` (multi-key objects) + `not` (only from inverted rules via `rulesToAST`). **Not** in the defaults: `$not`, `$nor`, `$or`, `$and`, `$where`, `$mod` — they parse as ordinary field names and never match (consistent with `docs:guide/conditions-in-depth`; the `MongoQuery` type even declares `toplevel: {}`, `dts:matchers/conditions.d.ts:28-31`).

### 3.4 How the official adapters wrap it

- `@casl/prisma`: `accessibleBy(ability, action = 'read').ofType('Post')` returns a `WhereInput` "aggregated from permission rules"; when nothing is accessible it returns "an empty condition that … causes the query to fail closed" (needs `createCaslExtension()`), i.e. it does **not** throw (`docs:packages/casl-prisma/README` "Finding Accessible Records"; older form `accessibleBy(ability).Post`, `docs:package/casl-prisma`). Internally it is an AST pipeline: `createTranslatorFactory(parser.parse, interpretPrismaQuery)` (`packages/casl-prisma/src/prisma/prismaQuery.ts` via Context7) with a `createJsInterpreter({...})` map of operator→function (`interpretPrismaQuery.ts`).
- `@casl/mongoose`: `Model.accessibleBy(ability, action?)` throws `ForbiddenError` when forbidden and additionally injects `__forbiddenByCasl__: 1` (`docs:packages/casl-mongoose/README` "Accessible Records plugin").
- Generic "custom database" recipe: `rulesToQuery(ability, action, subject, ruleToX)` + `if (query === null) return []` (`docs:advanced/ability-to-database-query`, Sequelize example).

### 3.5 Drizzle (docs silent — reference-repo approach, corrected)

The reference repo walks `rulesToAST` with `instanceof` on `CompoundCondition` / `FieldCondition` (`ref:src/lib/permissions/drizzleAdapter.ts:14-51`), supporting only `and`, `or`, `eq`. Two contract deviations to fix in ours:

1. `ref:…:16` maps `ast == null` → `undefined` (**no WHERE = every row**). The docs' contract is `null` ⇒ forbidden ⇒ return nothing (`docs:advanced/ability-to-database-query`; prisma "fail closed"). The reference is only safe because every caller pre-checks `can(action, 'Todo')` (`ref:src/dal/todos/queries.ts:24`, `ref:src/dal/users/queries.ts:12`).
2. `and([])` (unconditional) must map to `undefined`/no filter — drizzle's `and()` with no args already returns `undefined`, so `ref:…:60-65` handles it by accident; make it explicit.

Playbook shape (operator names are the AST names: `in`, not `within`):

```ts
import { rulesToAST } from '@casl/ability/extra';
import { CompoundCondition, FieldCondition, type Condition } from '@ucast/core';   // add @ucast/core as a direct dep
import { and, or, not, eq, ne, inArray, notInArray, sql, type SQL } from 'drizzle-orm';

export function abilityWhere(ability: AppAbility, action: AppAction, subject: AppSubjectName, table: PgTable): SQL | undefined {
  const ast = rulesToAST(ability, action, subject);
  if (ast === null) return sql`false`;                       // forbidden: fail closed, never "no WHERE"
  return toSql(ast, table);                                  // and([]) → and() → undefined → unconditional
}
function toSql(c: Condition, table: PgTable): SQL | undefined {
  if (c instanceof CompoundCondition) {
    const parts = c.value.map(x => toSql(x, table));
    switch (c.operator) { case 'and': return and(...parts); case 'or': return or(...parts); case 'not': return not(and(...parts)!); }
    throw new Error(`Unsupported compound operator ${c.operator}`);
  }
  if (c instanceof FieldCondition) {
    const col = columnFor(table, c.field);                   // throw on unknown / dotted fields you don't map
    switch (c.operator) {
      case 'eq': return c.value === null ? isNull(col) : eq(col, c.value);
      case 'ne': return ne(col, c.value);
      case 'in': return inArray(col, c.value as unknown[]);
      case 'nin': return notInArray(col, c.value as unknown[]);
      /* add lt/lte/gt/gte/regex/exists/custom ops as the rule vocabulary grows */
    }
    throw new Error(`Unsupported field operator ${c.operator}`);
  }
  throw new Error(`Unsupported condition ${c.constructor.name}(${c.operator})`);
}
```

Throwing on unknown operators (as the reference does at `ref:…:31-35,44-48`) is the correct fail-closed default.

---

## 4. Custom operators

### 4.1 API

```ts
// dts:matchers/conditions.d.ts:32-34
const buildMongoQueryMatcher: (...args: Partial<Parameters<typeof createFactory>>) => ConditionsMatcher<MongoQuery>;  // merges with defaults (impl:index.mjs:140)
const mongoQueryMatcher: Filter;                                                                                        // the default
// ucast:mongo2js/dist/types/factory.d.ts:21-23
function createFactory<T extends Record<string, ParsingInstruction>, I extends Record<string, JsInterpreter<any>>, P extends { forPrimitives?: true }>(instructions: T, interpreters: I, options?: Partial<FactoryOptions> & P): FilterType<P>;
// ucast:core/dist/types/types.d.ts:9-25
interface ParsingInstruction<T = unknown, Context extends {} = {}> {
  type: string;                                              // 'field' | 'document' | 'compound'
  validate?(instruction: Named<this>, value: T): void;       // throw on bad values
  parse?(instruction: Named<this>, value: T, context: ParsingContext<Context>): Condition;   // default: FieldCondition(name, field, value) for 'field'
}
interface FieldInstruction<T, C extends FieldParsingContext = FieldParsingContext> extends ParsingInstruction<T, C> { type: 'field' }   // context has .field
interface DocumentInstruction<T, C> { type: 'document' }
interface CompoundInstruction<T, C> { type: 'compound' }
// ucast:js/dist/types/types.d.ts:6
type JsInterpreter<N extends Condition, Value = any> = (node: N, value: Value, context: { interpret, get, compare }) => boolean;
```

### 4.2 Documented examples

```ts
// docs:advanced/customize-ability — extend with $nor (verbatim)
import { createMongoAbility, AbilityBuilder, buildMongoQueryMatcher } from '@casl/ability';
import { $nor, nor } from '@ucast/mongo2js';
const conditionsMatcher = buildMongoQueryMatcher({ $nor }, { nor });
export default function defineAbilityFor(user: any) {
  const { can, build } = new AbilityBuilder(createMongoAbility);
  can('read', 'Article', { $nor: [{ private: true }, { authorId: user.id }] });
  return build({ conditionsMatcher });
}

// docs:advanced/customize-ability — RESTRICT to $eq/$in (smaller client bundle) — use createFactory, not buildMongoQueryMatcher
import { $in, within, $eq, eq, createFactory, BuildMongoQuery } from '@ucast/mongo2js';
type RestrictedMongoQuery<T> = BuildMongoQuery<T, Pick<MongoQueryFieldOperators, '$eq' | '$in'>>;
const conditionsMatcher: ConditionsMatcher<RestrictedMongoQuery> = createFactory({ $in, $eq }, { in: within, eq });
type AppAbility = MongoAbility<Abilities, RestrictedMongoQuery>;
```

Field-level op = instruction of `type: 'field'` + interpreter that reads via `get(object, condition.field)` (mandatory for dot-notation support — `ucast:js/README.md:115-132`). Document-level op = `type: 'document'` with a `parse` returning `new DocumentCondition(instruction.name, …)` (`ucast:mongo/README.md:91-151`, `ucast:mongo2js/README.md:72-122` `$jsonSchema`).

### 4.3 VERIFIED against 6.8.0

```ts
const $startsWith = { type: 'field', validate(_i, v) { if (typeof v !== 'string') throw new Error('$startsWith expects string'); } };
const startsWith = (node, object, { get }) => String(get(object, node.field) ?? '').startsWith(node.value);
const $ownedBy   = { type: 'document', parse: (i, v) => new DocumentCondition(i.name, v) };
const ownedBy    = (node, object) => object.userId === node.value;
const conditionsMatcher = buildMongoQueryMatcher({ $startsWith, $ownedBy }, { startsWith, ownedBy });
can('read', 'Todo', { title: { $startsWith: 'A' } });   // field-level: nested under the field
can('read', 'Todo', { $ownedBy: 'u1' });                 // document-level: top-level key
build({ conditionsMatcher });
```

- Checks: `Alpha` → true, `Beta` (other owner) → false, owned → true.
- `rulesToAST` → `CompoundCondition(or)[ DocumentCondition('ownedBy', value 'u1', field undefined), FieldCondition('startsWith', 'title', 'A') ]` — custom ops appear under their `$`-less name and your Drizzle walker must implement them (or throw).

### 4.4 Naming constraints (VERIFIED)

The parser strips the **first character** of the instruction key to get the AST operator / interpreter key (`ucast:mongo/README.md:89` "parser removes `$` prefix"). VERIFIED: an instruction registered as `myop` (no `$`) fails at check time with `Unable to interpret "yop" condition. Did you forget to register interpreter for it?`. So: instruction key `$foo`, interpreter key `foo`, AST `operator === 'foo'`. Also `in` is registered as interpreter `within` in the defaults because `in` is a reserved word (`ucast:js/README.md:48`) but the AST operator is still `in`.

### 4.5 Client caveat (docs silent as a sentence; VERIFIED behaviour)

If the client hydrates rules containing `$startsWith` **without** the custom matcher, the default parser treats `{ $startsWith: 'A' }` as a literal `eq` value: `can(...)` silently returns `false` — fail-closed for `can` rules but **fail-open for `cannot` rules** (the exclusion stops matching). The docs frame custom matchers as something you build on the frontend too (restricting operators "can help reduce frontend bundle size", `docs:advanced/customize-ability`). Rule for us: `conditionsMatcher` (and `detectSubjectType`) live in ONE shared module imported by both `createServerAbility` and the client `AbilityProvider` wrapper.

---

## 5. Client / server sharing

### 5.1 Serialize / hydrate

```ts
// dts:extra/packRules.d.ts:29-32 ; docs:api/casl-ability-extra#packRules / #unpackRules
function packRules<T extends RawRule<any, any>>(rules: T[], packSubject?: (type: T['subject']) => string): PackRule<T>[];
function unpackRules<T extends RawRule<any, any>>(rules: PackRule<T>[], unpackSubject?: (type: string) => T['subject']): T[];
```

- `ability.rules` (`dts:RuleIndex.d.ts:59`) is the raw JSON array — VERIFIED round-trip `createMongoAbility(JSON.parse(JSON.stringify(ability.rules)))` reproduces checks.
- `packRules` halves the size (docs); "Don't use result returned by packRules directly, its format is not public and may change" (`docs:api/casl-ability-extra#packRules`). VERIFIED shape today: `["update","Todo",{"userId":"u1"},0,"title,complete"]`, `["delete","Todo",{"locked":true},1,0,"Locked todos are immutable"]`. `unpackRules` yields `action`/`subject` as arrays and explicit `inverted:false` — fine for `createMongoAbility`.
- Documented server→client pattern (`docs:cookbook/cache-rules`): server `jwt.sign({ rules: packRules(defineRulesFor(user)) })`; client `ability.update(unpackRules(token.rules))`. `update(rules)` **replaces** all rules and emits `update`/`updated` (`docs:api/casl-ability#update`); `ability.on('updated', h)` returns an unsubscribe (`docs:guide/intro` "Subscribe to Ability Rule Updates").
- Class subject types need `packSubject`/`unpackSubject`; string subjects (ours) do not.

### 5.2 `@casl/react` — current API is 7.0.1 (fetched from unpkg; NOT what Context7 shows for `useAbility`)

```ts
// @casl/react@7.0.1 dist/types/hooks/useAbility.d.ts:2-6
function AbilityProvider<T extends AnyAbility>({ children, value }: { children: React.ReactNode; value: T }): ReactElement;
function useAbility<T extends AnyAbility>(): T;
// @casl/react@7.0.1 dist/types/Can.d.ts:3-37
type CanProps<T> = ({ do: A; on: S; field? } | { I: A; a: SubjectType; field? } | { I: A; an: SubjectType; field? } | { I: A; this: Instance; field? })
                 & { not?: boolean; passThrough?: boolean; children: ReactNode | ((exposes: { isAllowed: boolean; ability: T; reason: string | undefined }) => ReactNode) };
const Can: <T extends AnyAbility>(props: CanProps<T>) => React.ReactNode;
```

- Peer deps 7.0.1: `@casl/ability ^4 || ^5.1 || ^6 || ^7`, `react ^18 || ^19` — compatible with our 6.8.0 + React 19.
- `<Can>` "reads the current `Ability` instance from `AbilityProvider`, re-renders when rules change, and memoizes the relevant rule lookup" (`docs:packages/casl-react/README`). Use `ability.rules` in hook deps: `useMemo(() => getPosts(ability), [ability.rules])` (same README).
- ⚠️ README drift: one snippet writes `<AbilityProvider ability={ability}>`; the `.d.ts` and Quick Start say **`value`**. Trust the `.d.ts`.
- ⚠️ Context7's `docs:package/casl-react` page lists a `where` prop — it does not exist in 7.0.1's `Can.d.ts`.
- **Legacy API** (`createContextualCan`, `useAbility(context)`) exists in 4.0.0 → 6.0.0 (`factory.d.ts`: `createContextualCan<T>(Getter: React.Consumer<T>): FunctionComponent<BoundCanProps<T>>`; `hooks/useAbility.d.ts`: `useAbility<T>(context: React.Context<T>): T`) and was **removed in 7.0.0** (no `factory.d.ts` in 7.0.1's file listing). If a tutorial shows `createContextualCan(AbilityContext.Consumer)`, it targets ≤6.

Typed binding: docs silent for 7.x (the old `createContextualCan<AppAbility>` was the typed hook). Use the generics directly: `export const useAppAbility = () => useAbility<AppAbility>()`; for `<Can>` the generic cannot be inferred from props — either accept `AnyAbility` typing in JSX or wrap: `export const AppCan = (p: CanProps<AppAbility>) => <Can {...p} />`.

### 5.3 "Defined once on the server, shipped to the client" (Next.js App Router — docs silent; composed from documented pieces)

```tsx
// server (RSC layout / route): build ONCE
const ability = defineAbilityFor(session?.user ?? null);            // §1
const rules = ability.rules;                                          // plain JSON (dts:RuleIndex.d.ts:59)
return <ClientAbilityProvider rules={rules}>{children}</ClientAbilityProvider>;

// client
'use client';
import { AbilityProvider } from '@casl/react';
import { createMongoAbility } from '@casl/ability';
import { conditionsMatcher, detectSubjectType } from '@/shared/domains/permissions/ability-options';   // SAME module as the server (§4.5)
export function ClientAbilityProvider({ rules, children }) {
  const ability = useMemo(() => createMongoAbility<AppAbility>(rules, { conditionsMatcher, detectSubjectType }), [rules]);
  return <AbilityProvider value={ability}>{children}</AbilityProvider>;
}
```

Client checks on DTOs that came over JSON must re-tag: `ability.can('update', subject('Proposal', dto), 'price')` — the server-side `subject()` tag is non-enumerable and lost in transit (§2.3). A `detectSubjectType` keyed on a `__typename`/`kind` field the API includes avoids per-callsite tagging (`docs:guide/subject-type-detection`).

---

## 6. Per-request ability in servers

### 6.1 What the docs show (Express — the only server recipe in the docs)

```ts
// docs:cookbook/cache-rules — three documented variants of one middleware
export async function provideAbility(req, res, next) {
  // (a) LRU cache of ability INSTANCES keyed by user id
  if (ABILITIES_CACHE.has(req.user.id)) req.ability = ABILITIES_CACHE.get(req.user.id);
  else { req.ability = await defineAbilityFor(req.user); ABILITIES_CACHE.set(req.user.id, req.ability); }
  // (b) rules cached in the session:  rules = req.session.abilityRules ??= await defineRulesFor(req.user); req.ability = createMongoAbility(rules)
  // (c) rules inside the JWT:        const { rules } = jwt.verify(token, secret); req.ability = createMongoAbility(rules)
  next();
}
app.use(provideAbility);
```

Docs silent on Next.js, tRPC, RSC, GraphQL context. Mapping the documented shape onto our stack is mechanical: the one place `req.ability` is assigned becomes (i) tRPC `createContext` → `ctx.ability`, (ii) the RSC layout that renders `ClientAbilityProvider` (§5.3), (iii) the first line of a `route.ts` handler. Everything below takes `ability`, never `user`.

### 6.2 Cost model (why per-request construction is fine)

`createMongoAbility(rules)` only indexes rules; each rule's conditions matcher is compiled lazily on first `matchesConditions`/`ast` access (`impl:index.mjs:54-55`). The expensive part is only I/O inside `defineRulesFor` (docs' `getDevicesOf(user)` example) — cache the **rules** (variants b/c), not the request.

### 6.3 Caching caveats (docs silent beyond the LRU example; derived from verified mechanics)

- The LRU variant caches a mutable **instance**; `ability.update()` anywhere would leak across requests. Prefer caching `rules` and building a fresh instance per request.
- Conditions with baked timestamps (`createdAt: { $lt: Date.now() - … }`, `docs:packages/casl-ability/README`) go stale if rules are cached; keep time-relative rules out of cached rule sets or key the cache by time bucket.
- `Date` values survive in-memory but not JSON (`{ $lt: Date }` becomes a string) — normalise to ISO/epoch before shipping rules.

---

## 7. Anti-patterns & gotchas

1. **Untagged POJOs silently fail.** `ability.can('read', row)` on a Drizzle row returns `false` (type detected as `"Object"`), it does not throw — VERIFIED. Always `subject('Todo', row)` or configure `detectSubjectType` (`docs:api/casl-ability#subject`, `#detectSubjectType`).
2. **`subject()` mutates.** It adds a hidden property to the object you pass and throws if the object was already tagged with a different type — VERIFIED (`impl:index.mjs:4-5`). Don't tag shared/cached objects with different types; don't rely on the tag after JSON.
3. **Mutating `ability.rules` is a no-op.** VERIFIED: `ability.rules.push({action:'manage',subject:'all'})` grows the array but `can('delete','Anything')` stays `false` (the index is not rebuilt). Only `update(rules)` changes behaviour (`docs:api/casl-ability#update`).
4. **Order of `cannot`.** Inverted rules must come after the direct rules they restrict (`docs:guide/intro` "Inverted rules" + VERIFIED §1.7). In role tables, append global `cannot`s **last**.
5. **Inverted rules with conditions are invisible to type-level checks** (§2.2) — `can('delete','Todo')` is `true` even when every real row is locked. Gate UI on instances, and re-check the instance server-side before mutating ("requires a final check on the actual subject", `docs:guide/intro`).
6. **Field rules don't restrict field-less checks** (§2.4). To enforce "only these fields", use `permittedFieldsOf` + `pick`, or check each incoming field (`ref:src/lib/permissions/todos.ts:51-53` does `Object.keys(data).every(field => can('update', subject('Todo', todo), field))`).
7. **Field patterns**: `*` excludes dots, `**` includes them (`docs:guide/restricting-fields`); `fields: []` throws (`impl:index.mjs:43`).
8. **`reason` only on inverted rules** (`docs:advanced/debugging-testing`); when no rule matches, `ForbiddenError.message` is the default string — customise via `setDefaultMessage` if the UI needs it (§2.5).
9. **`ForcedSubject` / `TaggedInterface` are compile-time only** (§1.2) — pair them with `subject()` or `detectSubjectType`.
10. **No logical operators inside conditions.** `$and/$or/$nor/$not/$where/$mod` are not in the default instruction set (`impl:index.mjs:138`) and parse as field names → never match. Express OR with multiple `can`, AND-NOT with `cannot` (`docs:guide/conditions-in-depth`). Add `$nor`/`$not` only via `buildMongoQueryMatcher` and then implement them in the Drizzle walker too.
11. **Custom `conditionsMatcher` functions** (non-Mongo) break serialization AND `rulesToAST` (throws on missing `ast`, `impl:extra/index.mjs:40`); the docs advise against them when you need queries (`docs:advanced/customize-ability`).
12. **OR-merge hazard** (§1.7): a conditionless `can` next to conditioned `can`s removes the row filter. Test rule sets with `rulesToQuery(ability, action, type, r => r.conditions)` and assert `!== {}` for non-admin roles.
13. **`possibleRulesFor`/`rulesFor`/`rulesToAST`/`rulesToQuery` want a subject TYPE**; passing an instance throws (`impl:index.mjs:102`).
14. **`packRules` output is not a public format** (`docs:api/casl-ability-extra#packRules`) — persist raw rules, pack only for transport.
15. **`defineAbility` cannot take a custom factory** and **`Ability` class is deprecated** (§1.1) — use `AbilityBuilder(createMongoAbility)` + `MongoAbility` interface everywhere.
16. **`@casl/react` ≤6 vs 7** (§5.2): `createContextualCan`/`useAbility(ctx)` are gone in 7; `AbilityProvider value=`.

---

## 8. Reference-repo cross-check (`casl-crash-course` @ `e113223d`)

| § | What the reference does | Where | Matches docs? |
|---|---|---|---|
| 1 | `AbilityBuilder<MongoAbility<Permission>>(createMongoAbility)`; `Permission` = tuple union with `Pick<$inferSelect,…> \| 'Todo'` subjects; guest baseline `read Todo {public:true}` outside `if (user)`, user rules bake `user.id`, admin adds conditionless `read Todo` + field rule `update Todo ['complete'] {public:true}`; `build()` with no options | `ref:src/lib/permissions/getUserPermissions.ts:5-35` | ✅ docs pattern (`guide/define-rules`, `cookbook/roles-with-persisted-permissions` typing). Note it deliberately uses the OR-merge (`:22,28`) for admins. No `cannot` rules, no `.because()`, no system ability, no `anyAction` customisation. |
| 2 | Instance checks always via `subject('Todo', todo)`; per-field update check loops `Object.keys(data)`; type checks for "can create at all" | `ref:src/lib/permissions/todos.ts:17,31,48-53,78-85`; `ref:src/dal/users/queries.ts:30` | ✅ matches `guide/subject-type-detection` and `guide/restricting-fields`. Does **not** use `ForbiddenError` — throws its own `UnauthorizedError` (`ref:src/dal/errors.ts:8-13`) after a boolean `can`; no `permittedFieldsOf`, no `relevantRuleFor`. |
| 3 | `rulesToAST(ability, action, subject)` walked with `instanceof CompoundCondition/FieldCondition`; supports `and`/`or`/`eq` only; throws on other operators; `null` → `undefined` | `ref:src/lib/permissions/drizzleAdapter.ts:14-72` | ⚠️ AST walk itself is sound (docs' AST approach is only exemplified for Prisma). **Deviation:** `null` (forbidden) → `undefined` (no WHERE) is fail-open (`:16`), only safe because callers pre-check `can(action, type)` (`ref:src/dal/todos/queries.ts:24`, `ref:src/dal/users/queries.ts:12`). Docs contract: `null` ⇒ no rows. Also `getUserTodos` ANDs an extra `eq(todo.userId, user.id)` outside CASL (`ref:src/dal/todos/queries.ts:14-17`) — a second source of truth the ability-only design should avoid. `getUsersWithTodoCount` filters rows in memory with `subject('User', {...u})` instead of a WHERE (`ref:src/dal/users/queries.ts:30`). |
| 4 | No custom operators; imports `@ucast/core` directly (declared? `package.json` lists only `@casl/ability` — works there because npm hoists; **pnpm will not**) | `ref:src/lib/permissions/drizzleAdapter.ts:5`, `ref:package.json:17` | n/a — add `@ucast/core` explicitly in ours. |
| 5 | No `@casl/react`, no rule shipping. The client header **recomputes** the ability from the better-auth session (`getUserPermissions(session?.user)` in a `'use client'` component) — isomorphic definition function instead of serialized rules | `ref:src/components/header.tsx:7,33` | ⚠️ Works only because rules need no server-side I/O; diverges from the docs' "ship rules" pattern (`cookbook/cache-rules`). For us (share-token abilities, DB-derived scopes) rules must be shipped (§5.3). |
| 6 | **No compute-once.** Every `canXxx` helper and `drizzleWhere` call rebuilds the ability (`getUserPermissions(user)` inside each function; `canUpdateTodo` rebuilds it per field); pages call `getCurrentUser()` and DAL functions call it again | `ref:src/lib/permissions/todos.ts:14,17,28,…`; `ref:src/lib/permissions/drizzleAdapter.ts:14`; `ref:src/app/(app)/page.tsx:24-25`, `ref:src/dal/todos/queries.ts:10,22` | ❌ Opposite of the docs' `req.ability` middleware (`cookbook/cache-rules`) and of our compute-once rule. Cheap there (pure function), but structurally it passes `user` everywhere — exactly the `Actor`-style plumbing we are removing. |
| 7 | Avoids the POJO trap (always `subject()`); no field-pattern use; no `update()`/rule mutation; no `ForbiddenError` reasons | — | ✅ nothing contradicts the docs; simply narrower. |

---

## 9. Decision-relevant conclusions (for the "no Actor, ability-only, compute-once" design)

1. **Every principal is a rule set.** Session user → `defineRulesFor(user)` (§1.3/1.4); anonymous share-token bearer → `createMongoAbility(rulesMintedFromToken)` (§1.5, docs JWT variant); system job → `createMongoAbility([{ action: 'manage', subject: 'all' }])` optionally narrowed by `cannot` (§1.6, docs `manage all` idiom). No branch in the DAL needs to know which it was — the WHERE compiler sees `and([])` for omni and `null` for forbidden (§3.2).
2. **User ids live in conditions**, not closures/context: that is what makes the ability serializable (`packRules`), query-convertible (`rulesToAST` reads only `conditions`), and testable in isolation (§1.3).
3. **One options module** (`conditionsMatcher`, `detectSubjectType`) shared by server and client; custom operators unknown to the client silently disable `cannot` rules (§4.5).
4. **`null` ⇒ `sql\`false\``, `and([])` ⇒ no WHERE** in the Drizzle walker; never `undefined` for `null` (§3.5).
5. **Type-level `can` is a pre-flight only**; final authority is the instance check or the WHERE (§2.2, §7.5).
6. **`@casl/react` 7.0.1** (`AbilityProvider value=`, `useAbility<T>()`, `<Can>`) is the API to adopt; `createContextualCan` is pre-7 (§5.2).

---

## Appendix A — VERIFIED transcript (abridged; `node --input-type=module -e` against the installed 6.8.0 / ucast 1.4.1, nothing written)

```
rules (raw)      [{"action":"read","subject":"Todo","conditions":{"public":true}},{"action":"read","subject":"Todo","conditions":{"userId":"u1"}},
                  {"action":"update","subject":"Todo","fields":["title","complete"],"conditions":{"userId":"u1"}},
                  {"action":"delete","subject":"Todo","conditions":{"userId":"u1","public":false}},
                  {"action":"delete","inverted":true,"subject":"Todo","conditions":{"locked":true},"reason":"Locked todos are immutable"},
                  {"action":"read","subject":"Device","conditions":{"id":{"$in":["d1","d2"]}}}]
packRules        [["read","Todo",{"public":true}],["read","Todo",{"userId":"u1"}],["update","Todo",{"userId":"u1"},0,"title,complete"],
                  ["delete","Todo",{"userId":"u1","public":false}],["delete","Todo",{"locked":true},1,0,"Locked todos are immutable"],["read","Device",{"id":{"$in":["d1","d2"]}}]]
rulesToAST read Todo        CompoundCondition(or)[ FieldCondition(eq,userId,"u1"), FieldCondition(eq,public,true) ]
rulesToAST delete Todo      CompoundCondition(and)[ CompoundCondition(not)[FieldCondition(eq,locked,true)], FieldCondition(eq,userId,"u1"), FieldCondition(eq,public,false) ]
rulesToAST read Device      FieldCondition(in,id,["d1","d2"])
rulesToAST create Todo      null
rulesToQuery read Todo      {"$or":[{"userId":"u1"},{"public":true}]}      rulesToQuery create Todo  null
conditionless beside conditioned:   rulesToQuery {}   rulesToAST CompoundCondition(and, value=[])
can('manage','all'):                can create Anything true   rulesToAST read Todo and([])   rulesToQuery {}
manage all + cannot delete all:     rulesToQuery delete Todo null   can delete Todo false
createMongoAbility([]):             can read Todo false   rulesToAST null
cannot-before-can  {userId:u1,private:true} → true      can-before-cannot → false
subject(): same object true · enumerable keys [userId,public] · hidden __caslSubjectType__ "Todo" · JSON {"userId":"u1","public":true}
re-tag with other type → throws "Trying to cast object to subject type Other but previously it was casted to Todo"
can read plain obj w/o subject(): false (no throw)
field checks: update Todo 'title' (type) true · update Todo (no field) true · other user's todo 'title' false · own todo 'secret' false
permittedFieldsOf update Todo (type) [title,complete] · (instance, other user) []
ForbiddenError w/ reason: name ForbiddenError | "Locked todos are immutable" | action delete subjectType Todo field undefined
ForbiddenError default: Cannot execute "create" on "Todo" · setMessage: custom msg
rulesToFields read Todo {"userId":"u1","public":true}
hydrated client (JSON round-trip of ability.rules) can read own todo: true
ability.rules.push({manage,all}) → rules length 7, can delete Anything false (index not rebuilt)
--- custom ops ---
$startsWith/$ownedBy via buildMongoQueryMatcher: Alpha true · Beta false · owned true
rulesToAST → CompoundCondition(or)[ DocumentCondition(ownedBy, field=undefined, "u1"), FieldCondition(startsWith, title, "A") ]
client without matcher: can read Alpha → false (silent)
instruction named `myop` (no $) → Error: Unable to interpret "yop" condition. Did you forget to register interpreter for it?
dotted/ne/in AST → and[ eq(meta.ownerId,"u1"), ne(status,"archived"), in(tags,[a,b]) ]
can(all)+cannot(cond) → CompoundCondition(not)[ eq(archived,true) ]
can(cond) then cannot(no cond) → AST null, can read type false
cannot(no cond) then can(cond) → AST eq(ownerId,"u1"), can read type true
```
