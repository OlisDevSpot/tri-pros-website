# Kitchens funnel transform — HOUSE PROMPTS (winners of the 2026-07-09 six-way test)

Oliver tested six Seedance 2.0 morph mechanics from the approved funnel
aspirational pair (`public/funnels/kitchens/before-1.webp` → `after-1.webp`,
both 4k-upscaled first) and picked TWO winners. These are now the house
transform recipes for every trade: **demo-rebuild** (primary — in the
kitchens reel) and **day-cycles** (rotation alternate — use for the next
creative variant to fight hook fatigue). Losing variants (crew-timelapse,
ghost-crew, dust-reveal, stop-motion) were deleted; do not regenerate them.

Shared brief that made these work: fast-moving construction-site feel —
worker silhouettes in fast motion giving the illusion the kitchen is BUILT,
not conjured. Shared constraints in every prompt: locked static shot ·
room/window geometry fixed · ends exactly on the finished kitchen, crew gone.

Model: `seedance_2_0 --duration 8 --resolution 1080p --aspect_ratio 9:16
--generate_audio false` (~72cr each).

| Winner | Clip file (`video/public/clips/`) | Mechanic |
|---|---|---|
| demo-rebuild (primary) | `kitchens-funnel-transform-v3-demo-rebuild.mp4` (also promoted to `kitchens-funnel-transform.mp4`, the reel's slot) | Two acts: demolition first, then the rebuild races |
| day-cycles (alternate) | `kitchens-funnel-transform-v6-day-cycles.mp4` | Day/night light sweeps, each cycle further along |

## demo-rebuild — primary house prompt

> Two-act construction time-lapse from a locked static camera: first the old kitchen is demolished in fast motion — cabinet doors come off, counters are carried out, debris swept away by fast-moving worker silhouettes kicking up light dust — then the rebuild races forward: new flooring, paint, shaker cabinets, the marble waterfall island and brass fixtures installed by blurred crews, until the pristine finished kitchen stands complete and empty. No camera movement at all, window and ceiling geometry locked in place the entire time.

For other trades/rooms: swap the demolition and install nouns for the room
("vanity", "tile surround", "freestanding tub" for bathrooms), keep the
two-act structure, the "fast-moving worker silhouettes", and every camera/
geometry constraint verbatim.

## day-cycles — rotation alternate

> Multi-day construction time-lapse from a locked tripod: sunlight sweeps across this kitchen as whole days pass in seconds — shadows rotate across the floor, the window light pulses from cool morning to warm dusk again and again — while fast-forward construction worker silhouettes flicker through the space, each light cycle leaving the renovation further along: demo, then cabinets, then the marble island, then finishes. A final steady golden-hour light lands on the finished kitchen, crew gone. Absolutely no camera movement, room geometry fixed throughout.

⚠️ When reusing: replace "locked tripod" with "locked-off static shot" —
see prompt-writing lesson below (this prompt predates the lesson; v6's
output happened to stay clean, but don't tempt it).

## Prompt-writing lessons (from the losing four + QA)

- NEVER name physical camera equipment ("tripod", "camera") — v1 rendered a
  literal tripod into the scene. Say "locked-off static shot, no camera
  movement".
- All six passed the no-photoreal-faces check because every prompt said
  "silhouettes" + motion blur — keep that wording; if any output renders a
  clear recognizable face, reject it.
- Mid-morph believability comes from naming real jobsite states (debris
  carried out, lumber on counters, stripped island carcass) — keep concrete
  construction nouns in the prompt.

## Meta note

Worker silhouettes are AI-generated humans. They are motion-blurred
silhouettes, not photoreal faces — menu-level "AI Info" self-declaration
still applies (as it already does for these ads); the prominent-overlay rule
is only for photoreal AI humans with visible faces, which these prompts
explicitly avoid.
