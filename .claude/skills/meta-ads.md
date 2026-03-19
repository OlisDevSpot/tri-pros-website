---
name: meta-ads
description: Run Meta Marketing API scripts for Tri Pros Remodeling. Use when the user asks to create a campaign, pull ad performance, pause or activate an ad, or manage Meta ads in any way.
---

# Meta Ads Skill — Tri Pros Remodeling

You are operating the Meta Ads CLI for Tri Pros Remodeling.
All commands run via: `pnpm meta <command>` from the project root.

## Available Commands

| Command | What it does | How to invoke |
|---|---|---|
| `pnpm meta verify` | Smoke test all credentials | "verify meta credentials" |
| `pnpm meta performance [preset]` | Pull campaign stats (default: last_7d) | "pull performance", "show me this month's stats" |
| `pnpm meta manage-ad` | Interactive: pause or activate an ad | "pause ad X", "activate my ads" |
| `pnpm meta create-campaign` | Interactive wizard: full campaign creation | "create a campaign", "set up a new ad" |

## Date Presets for Performance

`today`, `yesterday`, `last_7d`, `last_14d`, `last_28d`, `last_30d`, `last_month`, `this_month`

Example: `pnpm meta performance this_month`

## Credentials

Stored in `.env.meta` at project root. Never committed (covered by `.gitignore`).
If credentials fail, run `pnpm meta verify` first to diagnose.

## After Mutating Operations

After `create-campaign` or `manage-ad` runs, the script prints an `ADS MANAGER URL` at the end of its output.
Open that URL in the browser using Playwright to visually confirm the change.

## Rules

- All campaigns are created PAUSED — never activate without explicit user instruction
- Always run `pnpm meta verify` if an API call throws an auth error before retrying
- Never expose credentials in output — they stay in `.env.meta`
