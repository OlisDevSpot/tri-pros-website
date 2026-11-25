Run `/stress-test-plan` on the scene camera plan before anything is built.

**Where:** worktree `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes`, branch `feat/trade-scenes-foundation`. Work from that directory. Other sessions are working in this tree at the same time (the TS3b.4a "Upgrades that follow the home" build is committing task by task, and an iPad-fixes session is committing visible-area and dock changes). So this is read-only work: no code edits, no stash, checkout, reset or restore, and no commits. The only files you may edit are the plan, the spec and the tracker lines named below, and only after the owner rules.

**What to test**
- Plan: `docs/superpowers/plans/2026-10-28-scene-camera-slide.md` (8 tasks, uncommitted).
- Spec, approved by the owner on 2026-10-28: `docs/superpowers/specs/2026-10-25-scene-camera-slide-design.md` (R103).
- Research the plan relies on: `docs/plans/2026-10-25-scene-camera-gestures-research.md`.
- Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md`, the §2 "Camera" row, R103 in §3b, and the §6 change log.
- Owner-approved mock: the studies page "Scene Camera Studies", https://claude.ai/artifact/19jf86HrHdenVH4PPbjnsL (study C, "Tap to look"; read it with the Artifact tool, not a web fetch).

**What the feature is.** The rep can slide the 3D home scene's camera (two fingers, right-drag or Shift-drag, a trackpad swipe), held inside a box around the house and yard. A double-tap or double-click on the whole home glides the camera to look at that spot. Up close, the existing part tap already leans the camera, so double-tap is off there. A Recenter chip, and the R key, appear once the rep has moved the camera and glide back to the current framing. Any framing change the app makes drops the slide. On a laptop, a trackpad swipe slides, a pinch zooms, and a mouse wheel zooms.

**Code the plan changes:**
- `src/shared/components/scene/ui/camera-rig.tsx`, `hooks/use-eased.ts`, `ui/scene-shell.tsx` (read only), `ui/rain-field.tsx`
- `src/features/trade-scenes/ui/components/home-kit/home-camera-rig.tsx`, `home-scene-canvas.tsx`, `heat-arrows.tsx`, `ui/views/trade-scene-view.tsx`
- `constants/home-geometry.ts`, `home-anchors.ts`, `scene-shortcuts.ts`, `home-scene-copy.ts`, `hooks/use-scene-shortcuts.ts`
- `scripts/verify-scene-primitives.ts`, `verify-trade-scene.ts`, `verify-trade-scene-layout.ts`

**Points I'd most like pressure on:**
1. **Task ordering and the gate.** Tasks 1–5 (the shared scene tier) are meant to run now. Tasks 6–8 wait for TS3b.4a's Task 11, which adds a crawl-space framing to `home-camera-rig.tsx`. Check that ledger (`.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/progress.md` and `task-11-brief.md`) for other overlaps, such as `home-scene-copy.ts`, `home-anchors.ts` and the verify scripts.
2. **The rig's glide model.** `useEased` gets a `restartKey`, used for Recenter. A look point becomes the glide's goal until the next framing change. Moves are detected by pointer travel instead of OrbitControls' `onStart`. Does this hold with drei 10.7.9 `OrbitControls` (three-stdlib 2.36.1), damping, the `frameloop="demand"` canvas and `useEased`'s settle logic? Are there race conditions between the part-lean framing, a look, Recenter and a user grab?
3. **Double-tap on the roof.** On the whole home, a single tap on the roof already goes up close (`HouseRoof` `onTap` → zoom). The plan relies on that first tap turning look off before the second tap's `pointerup`. Verify this against how React and zustand render, and how R3F `onClick` fires.
4. **The camera store.** It sits above the Canvas in `TradeSceneView` and is read inside the Canvas. Confirm R3F 9 bridges this context, as it does for `SceneInputsProvider`. Also confirm the store keeps camera moves off the scene inputs and the burst key.
5. **The raycast filter for a look.** The plan takes the first visible Mesh inside the box whose material isn't transparent below 0.5 opacity, and gives rain and heat arrows a no-op raycast. Are other objects missed: yard blobs, which are instanced, pins, ribbons, the sky dome, the thermal paint?
6. **The wheel classifier and the capture-phase listener.** The listener is on R3F's container, and the plan expects it to beat OrbitControls' bubble listener. Check that, plus Safari gesture events, and that a wheel over the card or dock never reaches it.
7. **The slide box numbers** (`homeSlideBox(lift)`). Do they contain every framing target: the home's wide and tall framings, every anchor in both roof forms lifted by `liftedFraming`, the part-lean framings, and TS3b.4a's under-floor or crawl framing?
8. **Conventions.** Check against this repo's conventions (CLAUDE.md, memory, `docs/codebase-conventions/`, ADRs): one component per file, constants and lib placement, comments that say why only, and reusing the existing Keycap, dock button classes and `SCENE_MOTION` rather than writing new ones.
9. **Task 8's Playwright checks.** Software WebGL is used: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. Can pixel diffs and touch taps drive these checks reliably? The owner's dev server for this worktree is on port 3002; do not restart it without asking.

**Rules:** verify every finding against the code before reporting it. If any doc, memory or comment disagrees with the code, flag it as "⚠️ Stale ref". End with a verdict and the questions only the owner can answer. Once the owner rules, amend the plan (and the spec, if a decision changes) and add a tracker change-log line. Commit nothing; the owner chose subagent-driven execution and will say "build" separately.
