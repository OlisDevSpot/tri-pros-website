#!/usr/bin/env bash
# hotfix.sh — ship small fixes to production without touching the workbench.
#
# Production is origin/main. The workbench is the main checkout's `main`
# (usually far ahead and dirty). Fixes happen in a separate checkout at
# .worktrees/prod that always starts from exactly what is live.
#
# Usage: pnpm hotfix <command>   (run from the main checkout)
set -euo pipefail

# Resolve the main checkout even when invoked from inside a worktree.
MAIN_ROOT="$(cd "$(git rev-parse --path-format=absolute --git-common-dir)/.." && pwd)"
PROD="${MAIN_ROOT}/.worktrees/prod"
SYNC="${MAIN_ROOT}/.worktrees/sync"
SYNC_BRANCH="sync/origin-main"
WORKBENCH_BRANCH="main"
BACKUP_BRANCH="backup/main"
PROD_PORT=3010

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${BLUE}[hotfix]${NC} $*"; }
warn()    { echo -e "${YELLOW}[hotfix]${NC} $*"; }
error()   { echo -e "${RED}[hotfix]${NC} $*" >&2; }
success() { echo -e "${GREEN}[hotfix]${NC} $*"; }
die()     { error "$*"; exit 1; }

main_git() { git -C "$MAIN_ROOT" "$@"; }
prod_git() { git -C "$PROD" "$@"; }

confirm() {
  [[ "${HOTFIX_YES:-}" == "1" ]] && return 0
  read -r -p "$1 [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

fetch() { main_git fetch --quiet origin; }

require_prod() {
  [[ -d "$PROD" ]] || die "No prod checkout yet. Run: pnpm hotfix start"
}

prod_has_changes() { [[ -n "$(prod_git status --porcelain)" ]]; }

# Commits in the prod checkout that exist on no remote branch: shipping or
# opening a PR puts them on one, so only these would be lost by moving on.
prod_unsaved_commits() { prod_git log --oneline HEAD --not --remotes=origin; }

# The prod checkout needs the gitignored files a fresh checkout lacks.
refresh_local_files() {
  local f
  for f in .env .env.local next-env.d.ts; do
    if [[ -f "${MAIN_ROOT}/${f}" ]]; then
      cp "${MAIN_ROOT}/${f}" "${PROD}/${f}"
    fi
  done
}

cmd_start() {
  fetch
  if [[ ! -d "$PROD" ]]; then
    log "Creating the prod checkout at .worktrees/prod ..."
    main_git worktree add --detach "$PROD" origin/main >/dev/null
  else
    if prod_has_changes; then
      prod_git status --short
      die "The prod checkout has uncommitted changes (above). Commit + ship them, or: pnpm hotfix discard"
    fi
    local unsaved
    unsaved="$(prod_unsaved_commits)"
    if [[ -n "$unsaved" ]]; then
      echo "$unsaved"
      die "These commits were never shipped (above). Run: pnpm hotfix ship (or pr), or: pnpm hotfix discard"
    fi
    prod_git switch --quiet --detach origin/main
  fi
  refresh_local_files
  log "Installing dependencies ..."
  (cd "$PROD" && pnpm install --frozen-lockfile --prefer-offline --silent)
  success "Ready: .worktrees/prod is exactly what's live ($(prod_git log --oneline -1))."
  echo "  Edit there (e.g. code .worktrees/prod), then: pnpm hotfix check -> pnpm hotfix commit \"fix: ...\" -> pnpm hotfix ship"
}

cmd_status() {
  fetch
  echo -e "${BOLD}Production (origin/main):${NC} $(main_git log --oneline -1 origin/main)"
  if [[ -d "$PROD" ]]; then
    echo -e "${BOLD}Prod checkout:${NC} $(prod_git log --oneline -1)"
    local ahead
    ahead="$(prod_git rev-list --count origin/main..HEAD)"
    echo "  commits not live yet: ${ahead}"
    prod_has_changes && { echo "  uncommitted changes:"; prod_git status --short | sed 's/^/    /'; }
    prod_git merge-base --is-ancestor origin/main HEAD || warn "  production moved since this fix started; ship will ask you to rebase"
  else
    echo -e "${BOLD}Prod checkout:${NC} not created (pnpm hotfix start)"
  fi
  local counts
  counts="$(main_git rev-list --left-right --count "${WORKBENCH_BRANCH}...origin/main")"
  echo -e "${BOLD}Workbench (${WORKBENCH_BRANCH}):${NC} ${counts%%$'\t'*} ahead, ${counts##*$'\t'} behind production; $(main_git status --porcelain | wc -l) pending entries"
  local backup
  backup="$(main_git rev-parse --verify --quiet "origin/${BACKUP_BRANCH}" || true)"
  if [[ -z "$backup" ]]; then
    warn "  never backed up: pnpm hotfix backup"
  elif [[ "$backup" != "$(main_git rev-parse "$WORKBENCH_BRANCH")" ]]; then
    echo "  backup is behind the workbench by $(main_git rev-list --count "origin/${BACKUP_BRANCH}..${WORKBENCH_BRANCH}") commits (pnpm hotfix backup)"
  else
    echo "  backup is current"
  fi
}

cmd_check() {
  require_prod
  log "Type-checking and linting the prod checkout ..."
  (cd "$PROD" && pnpm tsc && pnpm lint)
  success "tsc + lint pass."
}

cmd_commit() {
  require_prod
  local message="${1:-}"
  [[ -n "$message" ]] || die "Usage: pnpm hotfix commit \"fix: what changed\""
  prod_has_changes || die "Nothing to commit in the prod checkout."
  prod_git status --short
  # Staging everything is safe here: this checkout only ever holds the fix.
  prod_git add -A
  prod_git commit --quiet -m "$message"
  success "Committed: $(prod_git log --oneline -1)"
}

# Refuses unless the fix sits directly on top of current production, so a
# push can only ever fast-forward origin/main.
ready_to_publish() {
  require_prod
  prod_has_changes && die "Uncommitted changes in the prod checkout. Commit them first: pnpm hotfix commit \"...\""
  fetch
  [[ "$(prod_git rev-list --count origin/main..HEAD)" -gt 0 ]] || die "Nothing to ship: the prod checkout has no new commits."
  if ! prod_git merge-base --is-ancestor origin/main HEAD; then
    die "Production moved since you started. Bring the fix on top of it, then retry:
  git -C .worktrees/prod rebase origin/main"
  fi
  log "Commits that will go live:"
  prod_git log --oneline origin/main..HEAD | sed 's/^/  /'
}

cmd_ship() {
  ready_to_publish
  confirm "Push these to production (origin/main)?" || die "Cancelled. Nothing pushed."
  prod_git push origin HEAD:main
  success "Shipped. Vercel is deploying production now."
  echo "  Bring it into the workbench when convenient: pnpm hotfix sync"
}

cmd_pr() {
  local slug="${1:-}"
  [[ "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "Usage: pnpm hotfix pr <short-slug>   (lowercase, dashes)"
  ready_to_publish
  local branch="fix/${slug}"
  confirm "Push to branch ${branch} and open a PR?" || die "Cancelled. Nothing pushed."
  prod_git push origin "HEAD:refs/heads/${branch}"
  (cd "$PROD" && gh pr create --base main --head "$branch" --fill)
  success "PR opened. Check the Vercel preview on it, then merge on GitHub."
  echo "  After merging: pnpm hotfix sync"
}

cmd_discard() {
  require_prod
  prod_has_changes || [[ -n "$(prod_unsaved_commits)" ]] || { log "Nothing to discard."; return 0; }
  prod_git status --short
  prod_unsaved_commits
  confirm "Set this fix aside and reset the prod checkout to production?" || die "Cancelled."
  if prod_has_changes; then
    prod_git add -A
    prod_git commit --quiet --no-verify -m "hotfix: set aside by pnpm hotfix discard"
  fi
  # A ref keeps the set-aside work recoverable instead of leaving it to the reflog.
  local ref
  ref="refs/backups/hotfix-$(date +%Y%m%d-%H%M%S)"
  prod_git update-ref "$ref" HEAD
  fetch
  prod_git switch --quiet --detach origin/main
  success "Reset to production. The set-aside work is saved at ${ref}"
  echo "  To look at it: git log -p ${ref} --not origin/main"
}

stop_on_conflicts() {
  git -C "$SYNC" diff --name-only --diff-filter=U | sed 's/^/  conflict: /'
  warn "Conflicts (above). Your workbench is untouched."
  echo "  Resolve them in .worktrees/sync, then: git -C .worktrees/sync add <files> && git -C .worktrees/sync commit --no-edit"
  echo "  Then run pnpm hotfix sync again to finish."
  exit 1
}

finish_sync() {
  if ! main_git merge-base --is-ancestor "$WORKBENCH_BRANCH" "$SYNC_BRANCH"; then
    log "The workbench has new commits since the sync started; bringing them into .worktrees/sync ..."
    git -C "$SYNC" merge --no-edit --quiet "$WORKBENCH_BRANCH" || stop_on_conflicts
  fi
  # --ff-only moves the branch only if every file it rewrites is untouched by
  # pending work; otherwise it refuses and changes nothing.
  if ! main_git merge --ff-only --quiet "$SYNC_BRANCH"; then
    die "Git refused to move the workbench (pending changes overlap the incoming files). Nothing changed.
  Commit or set aside those files, then run: pnpm hotfix sync"
  fi
  main_git worktree remove "$SYNC"
  main_git branch --quiet -d "$SYNC_BRANCH"
  success "Workbench now includes production: $(main_git log --oneline -1)"
}

cmd_sync() {
  [[ "$(main_git branch --show-current)" == "$WORKBENCH_BRANCH" ]] \
    || die "The main checkout is not on ${WORKBENCH_BRANCH}; switch back first."
  fetch

  if [[ -d "$SYNC" ]]; then
    if git -C "$SYNC" rev-parse --quiet --verify MERGE_HEAD >/dev/null; then
      git -C "$SYNC" diff --name-only --diff-filter=U | sed 's/^/  conflict: /'
      die "Still resolving in .worktrees/sync. Fix the files above, git add them, git commit, then rerun."
    fi
    main_git merge-base --is-ancestor origin/main "$SYNC_BRANCH" \
      || die ".worktrees/sync exists but does not contain production. Inspect it, or remove it: git worktree remove .worktrees/sync"
    finish_sync
    return
  fi

  if main_git merge-base --is-ancestor origin/main "$WORKBENCH_BRANCH"; then
    success "Workbench already includes production."
    return
  fi

  if main_git merge-base --is-ancestor "$WORKBENCH_BRANCH" origin/main; then
    main_git merge --ff-only --quiet origin/main \
      || die "Git refused to fast-forward (pending changes overlap the incoming files). Nothing changed."
    success "Workbench fast-forwarded to production."
    return
  fi

  # Diverged: merge in a side checkout so conflicts never mix with pending work.
  log "Merging production into a copy of the workbench at .worktrees/sync ..."
  main_git worktree add --quiet -b "$SYNC_BRANCH" "$SYNC" "$WORKBENCH_BRANCH"
  git -C "$SYNC" merge --no-edit --quiet origin/main || stop_on_conflicts
  finish_sync
}

cmd_backup() {
  [[ "$(main_git branch --show-current)" == "$WORKBENCH_BRANCH" ]] \
    || die "The main checkout is not on ${WORKBENCH_BRANCH}; switch back first."
  # No force: if the backup is not an ancestor, history was rewritten and a
  # person should look before anything on GitHub is replaced.
  main_git push --quiet origin "${WORKBENCH_BRANCH}:refs/heads/${BACKUP_BRANCH}" \
    || die "GitHub refused the backup (the workbench no longer extends the last backup). Nothing was overwritten."
  success "Backed up ${WORKBENCH_BRANCH} ($(main_git rev-parse --short "$WORKBENCH_BRANCH")) to origin/${BACKUP_BRANCH}. Production untouched."
  local pending
  pending="$(main_git status --porcelain | wc -l)"
  [[ "$pending" -gt 0 ]] && warn "${pending} uncommitted entries are NOT in this backup. Commit them to include them."
  return 0
}

cmd_dev() {
  require_prod
  log "Dev server for the prod checkout on http://localhost:${PROD_PORT}"
  cd "$PROD" && PORT="$PROD_PORT" exec pnpm dev
}

cmd_help() {
  cat <<EOF
pnpm hotfix <command>      production = origin/main, workbench = local main

  start            Put .worktrees/prod exactly on production (creates it the first time)
  dev              Run the prod checkout's dev server on :${PROD_PORT}
  check            pnpm tsc + pnpm lint in the prod checkout
  commit "msg"     Commit everything in the prod checkout
  ship             Push the fix straight to production (asks first)
  pr <slug>        Push to fix/<slug> and open a PR instead (preview first)
  discard          Set the fix aside (saved under refs/backups/) and reset to production
  sync             Bring production into the workbench without touching pending work
  backup           Push the workbench to origin/${BACKUP_BRANCH} (never deploys)
  status           Where production, the prod checkout and the workbench stand

HOTFIX_YES=1 skips the confirmation prompts.
EOF
}

case "${1:-help}" in
  start)   cmd_start ;;
  status)  cmd_status ;;
  check)   cmd_check ;;
  commit)  shift; cmd_commit "$@" ;;
  ship)    cmd_ship ;;
  pr)      shift; cmd_pr "$@" ;;
  discard) cmd_discard ;;
  sync)    cmd_sync ;;
  backup)  cmd_backup ;;
  dev)     cmd_dev ;;
  help|-h|--help) cmd_help ;;
  *) error "Unknown command: $1"; cmd_help; exit 1 ;;
esac
