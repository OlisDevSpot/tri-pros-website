# Editing-pattern library — short-form Meta/IG Reels ads (2026)

Research-backed (2026-07-09, parallel web research; sources at bottom). Frame math @30fps.
Tags: [V] verified · [C] single-vendor claim, directional · [I] our engineering parameterization.

## Governing numbers

- **3-second rule** [V Meta]: attention AND key message/branding inside 3s (frames 0–90).
- **Hook rate** (3s views ÷ impressions): median ≈28%, good >30%, top ≈45%; <25% = kill the hook [V]. Winning hooks decay ~37% after ~7 days — rotate [V].
- Swipe-away decisions cluster at 2–3s; 50–60% of drop-off is inside 3s [V].

## Hook patterns (frames 0–90) — pick ONE per variant

| Pattern | Construction | Remotion | Params [I] |
|---|---|---|---|
| **Cold open** (result-first) | best 60–90f of b-roll at frame 0, cut in MID-action (trim ≥15f off clip head) | trivial | first clip 60–90f |
| **Inverted reveal** (after-first) — THE remodeling hook | AFTER + curiosity text → hard cut to BEFORE → transformation | trivial | AFTER 0–60, text pops f6, cut at f60 + bass hit |
| **Pattern interrupt** | reversed clip / 2× burst / extreme punch-in (150% crop) / hard grade at f0 | trivial–transform | interrupt 20–45f max, then resolve |
| **Text-punch** | 1–2-line bold claim slammed over motion | spring | enter f4–8, spring damping 12 stiffness 200, scale .85→1 overshoot ~1.05, 2f white flash + thud SFX |
| **In-medias-res** | VO starts mid-clause at f0; J-cut audio 5–10f before visual | trivial | — |
| **Freeze-frame open** | hold 20–30f w/ title + slow 110% push, release with riser peak | trivial | — |
| **Match-cut open** | old faucet framed center → new faucet same framing (force-align via crop/scale) | transform | cut f45–75; hide misalignment w/ 2f flash or 4f whip |

Hook testing protocol [V]: 3–5 hook variants vs ONE constant body+CTA; isolate the variable.

## Pacing / retention

- **Cut rhythm** [V]: visual change every 2–4s; micro-interrupt (cut/zoom/text/SFX) every 2–3s for ads. Never >120f without SOME change. Montage shots 15–30f; burst runs 8–15f/shot for 4–8 beats max [C 3.3× completion — directional].
- **J-cut** (audio leads picture 8–15f) / **L-cut** (VO continues over next picture) — the UGC-ad spine: continuous VO as L-cut over b-roll; J-cut the CTA VO in 10–15f early. Trivial (offset Audio sequences).
- **Punch-in** [V]: instant scale jump on same shot; ≤110–120% (quality). HARD = 1.00→1.12 in 1 frame on beat; SOFT = →1.10 over 4f ease-out. Alternate back to 1.0, don't compound. Pairs w/ stressed VO word.
- **Jump cuts**: trim dead time within a shot; alternate 100%/108% scale per segment so it reads intentional.
- **Speed ramp** (time-remap / per-Sequence playbackRate): 2.5× travel → ramp to 0.5× over 8f at hero detail → hold 15–20f → snap back.
- **Beat-sync** [V]: cuts on DOWNBEATS, not every beat. At 120BPM: beat = 15f, bar = 60f. Dissolves start 2 beats before a downbeat, complete ON it. **Free beat grid: prompt sonilo with an explicit BPM** ("120 BPM") and snap Sequence boundaries to the 15f grid [I].
- **Visual chapters** [V]: 2–4 distinct looks (hook→proof→offer); each boundary = transition + SFX + new text style = a re-hook. Macro re-hook every 5–8s.
- **Loop-close** [V]: final 20–30f reuse the opening shot (soft loop) with CTA overlay persisting — replays before the viewer decides to stop.

## Captions / typography

- **Placement 2026** [V]: Meta unified 9:16 safe zone = **top 14% / bottom 35% / sides 6%** (1080×1920 → text band Y≈270–1248). Lower-third is the UI graveyard. Hook text upper-middle (Y≈270–600); running captions just-below-center (Y≈1100–1248); CTA centered Y≈960. Keep extra ~120px clear at right-middle (like/share rail). Validate with Ads Manager "Safe Zone Guardrail". Out-of-zone text ≈22% lower completion [C].
- **Pop-in captions** (hook): per-word spring (damping 10, stiffness 220), scale 0→1 overshoot ~1.08, 1–2f stagger.
- **Karaoke captions** (body) [C 12–25% watch-time lift]: static line ≤6 words/page, active word color-swap + scale 1→1.12 over 3f. Needs word timestamps — forced alignment or estimate from TTS word count.
- **Emphasis styling**: max 1 emphasized word per line — brand color + ~1.15–1.25× scale; always emphasize numbers/prices. Our props syntax: `*word*` in caption text → brand-blue + scale.

## Transitions (pick ONE accent style per ad [V])

- **Hard cut** — the default; 80%+ of all transitions.
- **Flash/luma flash** — white overlay 0→1→0 over 4–6f, peak ON the cut frame. For beat drops/reveals. Trivial.
- **Whip pan** — outgoing translate X 0→−120% over 6–8f w/ directional blur (SVG feGaussianBlur X-only), incoming mirrored; ALWAYS + whoosh. Chapter boundaries only.
- **Zoom punch-through** — outgoing 1→1.6 w/ blur, incoming 1.3→1; 8–10f. Easy to do badly, keep short.
- **Directional wipe** — animated clip-path; good as before/after slider (native to remodeling); 12–18f + 4px divider line.
- **Match dissolve** — 12–18f opacity cross between matched compositions; the transformation beat.
- ❌ Star/iris wipes (infomercial), glitch/RGB-split packs (the #1 "editor showing off" cringe [V]). Inconsistent transition styles in one ad reads amateur.

## Emphasis accents + SFX

One audio beat + one visual beat = ONE perceived event. Align SFX transient to the exact cut frame (±1f) [V].

- **Punch zoom on beat** — hard 1f scale 1.00→1.10–1.15 on downbeats.
- **Screen shake** — 8–12f decaying random translate ±6–10px (reseed every 2–3f); impact moments.
- **Flash frame** — 1–3 white frames at the hit.
- **Color pop** — hold saturate(0.2) → snap to full over 2–4f on the reveal. Global trivial; regional needs mask.
- **Slow-then-snap** — 0.5× for 10–20f into the hit → instantly 1.5–2× out.
- **SFX grammar** [V]: **whoosh** = motion/transition · **riser** = build, peak EXACTLY on the reveal frame (start 30–60f before) · **boom/hit** = the landing. Classic: riser → cut → boom(+flash+punch). Click/pop on hook caption words only. Voice always leads the mix; whooshes high-freq, rumbles low.
- SFX library is AI-generated (seed_audio): whoosh-short(~6f), whoosh-long(~12f), riser-1s, riser-2s, boom, click, pop, ding.

## Structure templates (DR ads)

**Hook → Body(=evidence, not a second intro) → CTA** [V]. Reels sweet spot 15–30s.

**20s / 600f [I]:** Hook (inverted reveal + pop captions) 0–90 · Problem/BEFORE + pain line 90–180 (punch-in on damage) · Proof montage 180–420 (beat-synced 45–60f cuts, karaoke captions, L-cut VO) · Offer card 420–510 (color pop + boom) · CTA 510–600 (explicit instruction, arrow to Meta button, soft loop).

**30s / 900f [I]:** Hook 0–90 · re-hook/problem 90–180 · proof A 180–420 · **mid-roll re-hook ~f420** (whip/flash + new claim card) · proof B (credibility) 420–660 · offer 660–780 · CTA 780–900.

CTA endings do 4 jobs [V]: instruct · restate offer visually · reduce doubt (license/guarantee) · urgency ("5 spots" is built-in). Lo-fi/UGC beats studio ~84% for prospecting [V]; a $40k+ remodel may justify polish — test both.

## Glossary (speak editor)

hook rate · hold rate · cold open · in-medias-res · pattern interrupt · inverted reveal · text-punch · freeze frame · hard cut · jump cut · punch-in · J-cut (audio leads) · L-cut (audio lingers) · split edit · speed ramp · whip pan · match cut · match dissolve · montage · beat-sync · downbeat · visual chapter · re-hook · seamless/soft loop · karaoke captions · pop-in captions · kinetic typography · safe zone (14/35/6) · lower-third (avoid) · luma flash · flash frame · wipe · object wipe/portal · color pop · screen shake · whoosh · riser · boom/braam · transient · b-roll · UGC · CTA · DR · forced alignment · time remap · Ken Burns

## Remotion implementability

- **Trivial**: hard cuts, cold/inverted/in-medias-res opens, J/L cuts, jump cuts, dissolves, flash frames, freeze, loop-close, global color pop, chapter theming.
- **Spring+transform**: punch-ins, text pops, karaoke/pop-in captions, shake, zoom transition, match-cut alignment, Ken Burns.
- **Mask/SVG filter**: whip pan, wipes/slider reveals, underline draw-ons, regional color pop. (Object-wipe/portal: needs tracking — deprioritized.)
- **Time-remap**: speed ramps, slow-then-snap, reversed hooks.
- **SFX assets**: generate via seed_audio, align transients to cut frames.

## Key sources

Meta 3s rule + safe-zone help (facebook.com/business); safe zones: billo.app, behaviour.digital, blog.adnabu.com, withblip.com, 1clickreport.com; DR structure: sovran.ai (hook-body-cta, endings), curtishowland.substack.com ($100M Meta); hooks: motionapp.com, opus.pro, influencers-time.com, chaplinai.pro; pacing: virvid.ai, air.io, bsquarevisuals.com; techniques: soundstripe.com (J/L, risers), studiobinder.com (match cuts), firecut.ai (jump cuts), nikon.co.uk (pace); transitions: descript.com, insideeditors.com, shortgenius.com; captions: opus.pro, blitzcutai.com, trymypost.com, vidno.ai, aividgenie.com; beat-sync: bitcut.app, beat2cut.com; SFX: krotos.studio, pixflow.net, flexclip.com; loops: slidycreator.com, joyspace.ai; remodeling ads: zeely.ai, hookagency.com.

Caveats: safe-zone %s are industry reconstructions (validate in Ads Manager); the 3.3×/12–25%/22%/89% figures are single-vendor claims; all frame parameterizations are our recommendations.
