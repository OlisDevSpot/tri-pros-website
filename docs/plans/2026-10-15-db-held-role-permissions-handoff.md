# Handoff: rules held in the database, edited per role (brainstorm)

You're starting a brainstorm with the owner. Use superpowers:brainstorming. No code, and no plan, until the owner approves a design.

## The idea, in the owner's words (2026-10-15)

"An admin dashboard for setting permissions and persisting these rules per role. The idea is to allow these to not live in code, but in the db, so that an admin could revoke or grant permissions on the fly."

It came up while ruling Q8 #14 in the permissions epic (#285). The ruling was: dispatchers may not create customers now, but that isn't ruled "never", because the owner may grant it later. Today a grant like that needs a code change and a deploy.

## Where

- Worktree `.worktrees/issue-285`, branch `refactor/285-refactor-permissions-casl-scope-compiler`. It's the home of the permissions epic. Read its `CLAUDE.local.md` first.
- Production runs the same engine: the owner's 2026-10-12 release shipped units 1–3. The branch adds unit 4 part 1 on top.

## What exists today (verify against the code before you quote it)

- **Rules are typed code, one file per role:** `src/shared/domains/permissions/rules/`. The files are `agent.ts`, `dispatcher.ts`, `super-admin.ts`, `homeowner.ts`, `user.ts`, `bearer.ts` (the proposal share link) and `system.ts`. They're built with `defineRules((can, cannot) => …)`.
- **Roles:** `userRoles` in `src/shared/constants/enums/user.ts` (`user`, `homeowner`, `agent`, `super-admin`, `dispatcher`). A user holds one role.
- **What the types enforce:** each rule's subject, action, field list and condition is checked against the entity's server spec. Conditions may only use a spec's `conditionColumns` or a named read operator (`operators.ts`: `$participatesViaMeeting`, `$inDerivedPipeline`). The proof is `type-checks/must-not-compile.ts`.
- **What runs when the rules load:** `rules/check-rules.ts` asserts three facts the types can't see. A `can` must not come after a `cannot`. A bare rule must not sit beside a conditioned one. No role may be empty.
- **Rules become SQL:** conditions compile to Drizzle filters (`permit(ctx, action, spec)` gives `.sql` / `.probe`). A mutation's reach is its action rules AND the read rules (D-15). Read field lists project the row (D-29).
- **The client gets the same rules:** the server sends them and `@casl/react` builds the ability, so the UI hides what the role can't do (`Can`, action configs with `permission: [action, subject, field?]`).
- **Not role rules:** system work runs under named reasons (`systemContext('<kind>:<name>')`); open topic N1 asks how those names should scale. A share link carries its own rule set. Neither is a role, so neither belongs in an admin screen.

## Forces the design has to answer

1. **Type safety.** Rules in the database lose the compile-time checks above, so the checks have to move into runtime validation. Decide what an admin is allowed to express:
   - toggling grants that already exist in code?
   - choosing from a closed catalogue of named permissions?
   - free rules?
2. **Conditions belong to the system, not the admin.** "Own rows", "participates via a meeting" and "a draft only" are business invariants with SQL bodies. A natural cut is to keep conditions and operators in code and let the database switch named capabilities on or off per role. The admin never authors a condition.
3. **Floors that must hold whatever is stored.** Super-admin can't lock itself out. The share link and system reasons can't be edited. Some `cannot`s may be non-negotiable, such as the dispatcher's `flowStateJSON`, which carries pricing. Decide which are floors.
4. **When a change takes effect.** Abilities are built once per request and seeded to the client. "On the fly" means the next request; decide how cache invalidation and the client refresh work.
5. **Audit.** Who granted what, and when.
6. **Per role, per user, or both?** The owner said per role.
7. **Fit with the epic.** It must not undo units 3–4, where rules are the only permission source. Decide whether this arrives before or after unit 6 deletes the legacy engine, and what the lint wall (unit 5) means for it.

## Read first

1. `docs/superpowers/specs/2026-10-05-permissions-structure-design.md`: §5 rules, §6 enforcement.
2. `docs/plans/2026-08-10-casl-scope-compiler-epic.md`: §0.3 (DB1 is this topic), §2.1 decisions D-15, D-29, D-33, D-34 and D-35.
3. The rule files listed above, plus `abilities.ts`, `ability-from-rules.ts`, `operators.ts` and `check-rules.ts`.

## Hard rules

- Never print phones, emails, tokens or ids.
- No DB writes for testing.
- New names (tables, subjects, terms) need the owner's agreement. Check `CONTEXT.md` first.
