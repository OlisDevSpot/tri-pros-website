// The closed, namespaced catalog of every place we run an UNRESTRICTED
// (scope-bypassing) actor/context. Adding a variant is a deliberate,
// reviewable act — the union IS the audit surface for the single most
// dangerous actor in the system. Each variant's comment states WHY the
// bypass is safe (trusted signature verified upstream, super-admin gate, a
// server-derived id from an already-authorized read, etc.).
// see docs/plans/2026-08-10-casl-scope-compiler-epic.md (Actor-seam conventions §4)
export type SystemReason
  // A server-derived id from an already scope-authorized read (transitive write).
  = | 'derived:contract-age-from-token-proposal'
