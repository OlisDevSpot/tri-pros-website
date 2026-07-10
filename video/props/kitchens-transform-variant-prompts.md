# Kitchens funnel transform — prompt variations (2026-07-09)

Six Seedance 2.0 morph variations from the approved funnel aspirational pair
(`public/funnels/kitchens/before-1.webp` → `after-1.webp`, both 4k-upscaled
first). Shared brief: fast-moving construction-site feel — worker silhouettes
in fast motion giving the illusion the kitchen is BUILT, not conjured.
Shared constraints in every prompt: locked static camera · room/window
geometry fixed · ends exactly on the finished kitchen, crew gone.

Model: `seedance_2_0 --duration 8 --resolution 1080p --aspect_ratio 9:16
--generate_audio false` (~72cr each).

Status: ALL SIX PENDING OLIVER'S PICK — after selection, delete losing rows
and losing clips; winners' prompts become the house transform recipes.

| # | Clip file (`video/public/clips/`) | Mechanic |
|---|---|---|
| v1 | `kitchens-funnel-transform-v1-crew-timelapse.mp4` | Straight construction time-lapse, motion-blurred crew |
| v2 | `kitchens-funnel-transform-v2-ghost-crew.mp4` | Long-exposure translucent worker light-trails |
| v3 | `kitchens-funnel-transform-v3-demo-rebuild.mp4` | Two acts: demolition first, then the rebuild races |
| v4 | `kitchens-funnel-transform-v4-dust-reveal.mp4` | Work half-hidden in haze; dust settles to reveal |
| v5 | `kitchens-funnel-transform-v5-stop-motion.mp4` | Stop-motion piece-by-piece assembly, hyperlapse crew |
| v6 | `kitchens-funnel-transform-v6-day-cycles.mp4` | Day/night light sweeps, each cycle further along |

## v1 — crew-timelapse

> Construction time-lapse inside this exact kitchen: blurred silhouettes of construction workers in hard hats rush through the frame at high speed carrying materials and tools, the renovation progresses in fast-forward — old finishes strip away, new cabinets, the marble waterfall island and appliances assemble stage by stage until the finished kitchen is complete. Locked-off static camera on a tripod, no camera movement, room geometry, window and skylight positions stay perfectly fixed. Heavy motion blur on the workers, crisp sharp architecture. Ends exactly on the pristine finished kitchen, workers gone.

## v2 — ghost-crew

> Long-exposure renovation time-lapse: semi-transparent ghostly streaks of construction workers flow through this kitchen like light trails, dozens of overlapping translucent worker figures moving at high speed while the room transforms beneath their motion — surfaces, cabinetry and the stone island materialize progressively. Static tripod camera, zero camera movement, the architecture stays razor sharp and fixed while only the ghost crew blurs. The worker trails dissolve away in the final second as the finished kitchen settles into place, clean and empty.

## v3 — demo-rebuild

> Two-act construction time-lapse from a locked static camera: first the old kitchen is demolished in fast motion — cabinet doors come off, counters are carried out, debris swept away by fast-moving worker silhouettes kicking up light dust — then the rebuild races forward: new flooring, paint, shaker cabinets, the marble waterfall island and brass fixtures installed by blurred crews, until the pristine finished kitchen stands complete and empty. No camera movement at all, window and ceiling geometry locked in place the entire time.

## v4 — dust-reveal

> Renovation time-lapse shrouded in soft construction haze: fine dust hangs in the air as fast-moving worker silhouettes hammer, lift, and install throughout this kitchen, their dark shapes flickering through the fog while the transformation happens half-hidden behind the haze. In the final two seconds the dust settles and the air clears, revealing the immaculate finished kitchen in sharp bright detail, crew gone. Locked static tripod camera, no camera movement, room and window geometry perfectly fixed.

## v5 — stop-motion

> Stop-motion style renovation: this kitchen rebuilds itself piece by piece in snappy increments — flooring planks click in row by row, shaker cabinets pop onto the walls one by one, the marble waterfall island slides together slab by slab, pendant lights drop into place — while construction worker silhouettes jump between positions frame to frame like a hyperlapse crew, never standing still. Playful staccato rhythm, locked static camera, architecture and window geometry fixed, ends on the complete pristine finished kitchen with the crew vanished.

## v6 — day-cycles

> Multi-day construction time-lapse from a locked tripod: sunlight sweeps across this kitchen as whole days pass in seconds — shadows rotate across the floor, the window light pulses from cool morning to warm dusk again and again — while fast-forward construction worker silhouettes flicker through the space, each light cycle leaving the renovation further along: demo, then cabinets, then the marble island, then finishes. A final steady golden-hour light lands on the finished kitchen, crew gone. Absolutely no camera movement, room geometry fixed throughout.

## QA notes (frame check at 4s, 2026-07-09)

- All six: no photoreal faces — silhouettes blurred or turned away. ✅
- ⚠️ v1: the words "camera on a tripod" made Seedance render a LITERAL
  tripod into the scene (bottom-left). Prompt-writing lesson for all future
  transforms: say "locked-off static shot, no camera movement" — never name
  physical camera equipment.
- Mid-morph states are believable construction progress in all six
  (stripped island carcass, debris, lumber on counters, peeling wallpaper,
  hanging pendant wire) — the "built, not conjured" brief is landing.

## Meta note

Worker silhouettes are AI-generated humans. They are motion-blurred
silhouettes, not photoreal faces — menu-level "AI Info" self-declaration
still applies (as it already does for these ads); the prominent-overlay rule
is only for photoreal AI humans with visible faces, which these prompts
explicitly avoid. If any output renders a clear recognizable face, reject it.
