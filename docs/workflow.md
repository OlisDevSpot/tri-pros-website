# Development Workflow — Tri Pros Remodeling

> The complete automated development pipeline. Human defines clarity, AI executes, human validates, AI iterates.

## Architecture

```
DEFINE  ──────>  EXECUTE  ──────>  VALIDATE  ──────>  QA  ──────>  SHIP
(human)          (claude)          (automated)        (human)      (human)
                                                        │
                                                        ▼
                                                    FEEDBACK ──> new issues ──> EXECUTE
```

| Layer | Tool | Mobile? |
|-------|------|---------|
| Define | Claude Web (brainstorm) + GitHub Issues | Yes |
| Queue | `dispatch ready` | Yes (GitHub Mobile) |
| Execute | `dispatch loop` (Claude Code CLI) | Terminal only |
| Validate | GitHub Actions CI (lint + build) | Auto |
| Preview | Vercel preview deploy per PR | Yes (any browser) |
| QA | Open preview URL on phone | Yes |
| Feedback | `dispatch feedback` or GitHub Mobile | Yes |
| Ship | Approve + merge PR | Yes (GitHub Mobile) |
| Deploy | Vercel auto-deploys on merge | Auto |

---

## One-Time Setup

### 1. Vercel (preview deploys + production)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import `OlisDevSpot/tri-pros-website` from GitHub
3. Framework: **Next.js** (auto-detected)
4. Environment variables: copy all from `.env` (especially `DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_BASE_URL`, etc.)
5. Deploy

Once connected, Vercel automatically:
- Deploys a **preview** for every PR branch (unique URL)
- Deploys to **production** on every merge to `main`
- Comments the preview URL on the PR
- Runs its own build check (redundant with our CI, but useful)

### 2. GitHub Actions CI (already done)

`.github/workflows/pr-checks.yml` runs lint + build on every PR. PRs can't merge without green checks.

### 3. Google OAuth (for preview URLs)

Add your Vercel preview domain pattern to Google Cloud Console:
- **Authorized redirect URIs**: add `https://*.vercel.app/api/auth/callback/google`
- This lets Google OAuth work on preview deployments

### 4. Dispatch script (already done)

`pnpm dispatch help` — see all commands.

---

## Daily Workflows

### A. Define Work (phone or desktop)

**Option 1: Brainstorm a feature** (desktop recommended)
```bash
# Start a Claude session
claude

# Use the brainstorming skill
> /brainstorm
# Claude grills you on requirements, edge cases, constraints
# Output: PRD + grouped GitHub issues with feature:X label + dependencies
```

**Option 2: Quick feedback/bug** (phone friendly)
```bash
# From terminal
pnpm dispatch feedback 23 "Date filter shows wrong results on mobile"

# Or from GitHub Mobile app:
# Create issue → add labels (type:bug, claude) → add to project board
```

**Option 3: Move existing issues to Ready** (phone or terminal)
```bash
# Terminal
pnpm dispatch ready 14 15 16 17

# Or: GitHub Mobile → Projects board → drag issues to Ready column
```

### B. Execute Work (terminal, hands-off)

**Automated loop** (fire and forget):
```bash
# Process up to 20 issues, 15 min timeout each
pnpm dispatch loop --max 20 --timeout 900

# The loop:
# 1. Picks highest-priority Ready + claude-labeled issue
# 2. Creates worktree + branch
# 3. Runs Claude non-interactively (claude -p)
# 4. Validates: lint + build
# 5. Creates PR → Vercel deploys preview
# 6. Cleans up → moves to next issue
# 7. Parks failed issues with a comment explaining why
```

**Manual mode** (you drive, for complex issues):
```bash
pnpm dispatch start 14        # Create worktree + branch
pnpm dispatch run 14          # Launch interactive Claude session
# ... Claude works, you guide ...
pnpm dispatch review 14       # Lint + build check
pnpm dispatch pr 14           # Push + create PR
pnpm dispatch cleanup 14      # Remove worktree
```

### C. QA + Ship (phone, 5 min per PR)

1. **Get notified**: GitHub sends you a notification when a PR is created
2. **Open preview**: Tap the Vercel preview URL in the PR description
3. **Test on phone**: Walk through the changes, check responsive behavior
4. **If good**: Approve + merge via GitHub Mobile
5. **If issues found**:
   ```bash
   pnpm dispatch feedback 23 "Button overlaps on mobile viewport"
   ```
   This creates a new issue → add to Ready → the loop picks it up

### D. Monitor

```bash
pnpm dispatch status           # Active worktree slots
pnpm dispatch list             # Open issues by priority
pnpm dispatch diff 14          # Full diff for a slot
pnpm dispatch qa 14            # AI-generated QA checklist from diff
```

---

## Command Reference

### Manual Workflow
| Command | What it does |
|---------|-------------|
| `dispatch start <#>` | Create worktree + branch + deps + CLAUDE.local.md |
| `dispatch run <#>` | Launch interactive Claude session in the slot |
| `dispatch dev <#>` | Start Next.js dev server on the slot's port |
| `dispatch review <#>` | Run lint + build, show diff summary |
| `dispatch qa <#>` | AI-generated QA testing checklist from diff |
| `dispatch pr <#>` | Push branch, create PR, move to In Review |
| `dispatch park <#>` | Free slot, keep branch (for blocked/paused work) |
| `dispatch cleanup <#>` | Remove worktree and free the slot |

### Automated Loop
| Command | What it does |
|---------|-------------|
| `dispatch ready <#> [# ...]` | Move issue(s) to Ready (the loop's intake queue) |
| `dispatch loop [--max N] [--timeout N]` | Auto-execute Ready issues in sequence |
| `dispatch feedback <#> <msg>` | Create feedback issue linked to source, auto-labeled |

### Info
| Command | What it does |
|---------|-------------|
| `dispatch status` | Show active dispatch slots |
| `dispatch list` | List open issues by priority |
| `dispatch diff <#>` | Full git diff for a slot |
| `dispatch help` | Show all commands |

---

## The Loop (how it all connects)

```
1. BRAINSTORM    →  /brainstorm in Claude session
                    Output: PRD + issues with feature:X label + dependencies

2. QUEUE         →  dispatch ready 14 15 16
                    Your approval gate — nothing runs without Ready status

3. EXECUTE       →  dispatch loop --max 20
                    Auto: pick → start → claude → lint → build → PR → next
                    Blocked issues are auto-skipped

4. PREVIEW       →  Vercel auto-deploys each PR
                    Unique URL per branch, works on phone

5. QA            →  Open preview URL on phone
                    dispatch qa <#> for AI-generated test checklist

6. FEEDBACK      →  dispatch feedback <#> "description"
                    Creates new issue → loop picks it up automatically

7. SHIP          →  Approve + merge PR (GitHub Mobile)
                    Vercel auto-deploys to production

8. REPEAT        →  Back to step 3 (or step 1 for new features)
```

---

## Issue Conventions

### Feature groups
When brainstorming creates multiple issues for one feature:
- All issues get a `feature:<slug>` label (e.g., `feature:proposal-editing`)
- Dependencies declared in issue body: `Blocked by #14`
- The loop auto-skips blocked issues until their blocker is closed

### Issue quality (critical for loop success)
The loop runs Claude non-interactively. Issues must be self-contained:
- Clear title describing the change
- Acceptance criteria in the body
- File paths and line numbers when possible
- Edge cases called out
- Dependencies declared

### Labels
- `claude` — eligible for automated execution (required for loop)
- `feature:<slug>` — groups related issues from one brainstorm
- `type:feature` / `type:bug` / `type:refactor` / `type:chore`
- `area:frontend` / `area:backend` / `area:sales-flow` / `area:integrations`
- `P0` (urgent) / `P1` (important) / `P2` (nice-to-have) / `P3` (backlog)

---

## Mobile Workflow Summary

| Task | App | Time |
|------|-----|------|
| Brainstorm a feature | Claude Web (browser) | 10-20 min |
| Create quick issue | GitHub Mobile | 2 min |
| Move issues to Ready | GitHub Mobile (Projects board) | 30 sec |
| QA a PR | Any browser (Vercel preview URL) | 5 min |
| Submit feedback | GitHub Mobile (comment/issue) | 1 min |
| Approve + merge PR | GitHub Mobile | 30 sec |

Everything except running the loop itself can be done from your phone.
