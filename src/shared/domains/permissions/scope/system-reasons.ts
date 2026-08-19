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
    // The bare SYSTEM_CONTEXT default — unclassified legacy privileged access.
    // Every NEW privileged call site should use systemContext(<specific reason>);
    // this variant exists only so SYSTEM_CONTEXT carries a real systemActor.
    // Retired in Phase 8 (see epic Retiring-Seams Register).
    | 'legacy:system-context'
