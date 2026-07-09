# SFX palette & visible editing accents — short-form ads (2026)

Research-backed (2026-07-09; sources at bottom). Companion to
[editing-patterns.md](./editing-patterns.md). Tags: ✅ verified · 🔶 taste-consensus/inferred.

## The palette (tasteful for premium local-service DR ads)

| Sound | Use moment | Level vs VO | Verdict |
|---|---|---|---|
| Short airy whoosh/swish (0.3–0.6s, no bass tail) | transitions, card slide-ins, camera moves | ~50% of VO | ✅ the #1 workhorse; long cinematic whooshes read trailer-y |
| Soft dry pop / cheek pop | text pop-ins, value props, checkmark landings | quiet, crisp | ✅ THE UGC value-prop sound |
| UI click / select click | checkmark rows, comparisons, pointing | very quiet | ✅ "keep quiet and crisp" |
| Camera shutter (single, dry, mechanical) | before→after reveal, freeze-frame, portfolio stills | medium — it IS the event | ✅ perfect for a remodeler; pair with 4–6f white flash |
| Soft bell ding / notification chime | final checkmark, offer line | medium-quiet | ✅ max 1–2 per ad |
| Riser/uplifter (1–1.5s, cuts off clean ON the cut) | build INTO reveal/CTA | swells to just under VO | ✅ the pro replacement for a boom |
| Soft low thud (felt, muffled, no reverb) | end-card logo/CTA landing | brief peak, under VO transient | ✅ only as a restrained thump — NEVER a cinematic boom |
| Keyboard typing burst | typewriter caption reveals | quiet | ✅ when synced per-character |
| Soft coin/chime | savings mention | medium | 🔶 borderline salesy — soft variant only |
| ❌ Vine boom, airhorn, record scratch/vinyl stop, "bruh"/meme soundboard, glitch, tape-stop | — | — | avoid: meme register, wrong for premium remodeling |

UGC-ad mapping ✅: cheek pop→value props · click→comparisons · ding→notification moments · whoosh→transitions · magic shimmer→wow beat · soft coin→pricing.

## Sources & licenses (for PAID Meta ads)

- **Pixabay SFX** ✅ SAFE (Content License: commercial, no attribution) — best free catalog.
- **Mixkit** ✅ SAFE — license explicitly names "Social Media and Online Marketing ads".
- **Freesound** ✅ SAFE only with `license:"Creative Commons 0"` filter; CC-BY-NC forbidden in ads.
- **YouTube Audio Library** ❌ NOT safe off-platform.
- **Uppbeat** ⚠️ treat as unsafe for pure DR ads (their agreement excludes paid product-promo distribution).
- **Epidemic Pro** / **Artlist Music & SFX Pro** ✅ safe paid options; Artlist has the cleanest ad language.
- **AI-generated (seed_audio)** ✅ competitive with mid/upper-tier stock for UI sounds/whooshes IF prompted for character, not category: "single soft dry mouth pop, no reverb, 200ms" — never "impact/boom" (produces over-reverbed cinematic slams; this caused our rejected boom). Library sounds win on recognizability — the popular sound IS the familiar one.

## Visible-but-professional accent numbers (@30fps)

- **Static punch-in**: 100→**120%** instantly (0 frames), alternate 100/120 across cuts. (1.10 = invisible; that's slow-push territory.)
- **Fast animated push-in** (word emphasis): 100→**115% over ~4f**, ease-out.
- **Slow push** (luxury feel): 8–15% growth across the whole 2–4s shot.
- **Axis-shift cut**: cut + scale 2nd clip +15% + reposition off-center — reads as a second camera.
- **Zoom-out reveal**: start 150% → 100% over ~10f — for the after-shot.
- **White flash cut**: 4–8f total for ads, peak ON the cut; pair with shutter for before→after.
- **B-roll flash**: exactly 3f of a detail shot mid-sentence.
- **Caption pop**: scale 0→120–130% overshoot at ~4f → settle 100% by ~10f.
- **Speed ramps**: 0.5×–2×, max 2–3 per video, always curved, whoosh/riser synced.
- **Budget**: one primary motion device (zoom) + 1–2 complementary accents; 3–5 punches per 20s, always ON meaning (VO stress/beat/cut). Meta register: TikTok timing, Facebook restraint.
- 🔶 The "feels edited, can't name it" law: every accent lands on a beat AND carries a matched sound. Punch+click = intentional; silent punch = error; sound without visual = noise.

## Mixing rules ✅

- VO is king: peaks ≈ −6…−3 dB; whole ad ≈ −14 LUFS.
- Music ≥ −6 dB under VO while speaking (duck −10 dB for the pro "wrap").
- SFX: −20 dB (clicks/pops) … −10 dB (shutter/ding/hits); library SFX start at ~50% volume.
- High-pass VO below 100 Hz; keep accent SFX out of 2–5 kHz while VO speaks (small sounds beat booms structurally).
- 🔶 5–8 SFX events per 20–25s ad; >10 audibly clutters. One sound per visual event; never two SFX on one frame; never a sound with no visible cause. Repeated elements (checkmark rows): one click each, vary pitch/volume slightly.
- Final check on a **phone speaker**.

## Starter kit (mapped to the ShowcaseReel)

1. soft dry pop — hook text pop-in (Pixabay "mouth pop")
2. bubble pop — 2nd text-pop variant (Mixkit)
3. UI click ×3 ascending — checkmark rows, −20 dB (Pixabay "click")
4. soft ding — final checkmark / offer line (Mixkit "correct answer tone")
5. short airy swish — crew-card slide-in (Pixabay "swish")
6. transition whoosh w/ low tail — big scene changes (Mixkit)
7. camera shutter — before→after flash-cut (Pixabay "camera shutter")
8. riser 1–1.5s hard-stop — into reveal/CTA (Pixabay "riser whoosh")
9. soft low thud — end-card landing, −12 dB (Mixkit "deep impact", trimmed)
10. typing burst — optional typewriter terms (Pixabay)

Workflow: download WAV → normalize to −12 dBFS peak → trim silence to transient →
store in `video/public/audio/sfx/` with the license URL recorded per file.

## Key sources

Pixabay license/blog · Mixkit license · Freesound FAQ · TheMusicase + TierMusic (YT
library off-platform) · Uppbeat user agreement · Epidemic/Artlist pricing+license
comparisons (red11media, fluxnote) · Krotos/Soundstripe/WeVideo/Kukarella (mixing
levels) · TokCount micro-cut transitions (accent numbers) · OpusClip auto-zoom ·
Cutsio text-bounce · Shotcut white-flash · Scenith speed ramping · CapCut SFX tool ·
FlexClip transition SFX · Know Your Meme (vine boom) · whatplugin/aiproductivity
(ElevenLabs SFX quality benchmark).
