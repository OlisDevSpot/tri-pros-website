#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# dispatch.sh — Structured parallel Claude Code session manager
#
# Creates isolated git worktrees for each GitHub issue, manages the full
# lifecycle from dispatch → monitor → review → PR → cleanup.
#
# Usage:  ./scripts/dispatch.sh <command> [args]
#
# ─── SYNC NOTICE ──────────────────────────────────────────────────────────────
# This script is kept in sync between:
#   - olis-v3/nextjs/tri-pros-website/scripts/dispatch.sh   (this file)
#   - olis-v3/nextjs/otautomations/scripts/dispatch.sh
# Only the CONFIG block below should differ between the two copies. Any logic,
# helper, or command change must be propagated to both files.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREE_DIR="${REPO_ROOT}/.worktrees"
DISPATCH_LOG="${WORKTREE_DIR}/.dispatch-log.json"
REPO="OlisDevSpot/tri-pros-website"
PROJECT_NUMBER=3
BASE_PORT=3000
MAX_SLOTS=3

# GitHub Projects board IDs
PROJECT_ID="PVT_kwHOCqZfGM4BSgDZ"
STATUS_FIELD_ID="PVTSSF_lAHOCqZfGM4BSgDZzhAA_t4"
STATUS_READY="9a551858"
STATUS_IN_PROGRESS="8a3f5937"
STATUS_IN_REVIEW="e461e967"

# Neon DB branching (isolates dev DB per worktree)
# Reads from .env so the script works without hardcoding secrets.
NEON_API_KEY=$(grep '^NEON_API_KEY=' "${REPO_ROOT}/.env" 2>/dev/null | cut -d= -f2-)
NEON_PROJECT_ID=$(grep '^NEON_PROJECT_ID=' "${REPO_ROOT}/.env" 2>/dev/null | cut -d= -f2-)
NEON_DEV_BRANCH_ID="br-small-sun-afns8axo"   # "development" branch — parent for worktree forks
NEON_API="https://console.neon.tech/api/v2"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────

log()     { echo -e "${BLUE}[dispatch]${NC} $*"; }
warn()    { echo -e "${YELLOW}[dispatch]${NC} $*"; }
error()   { echo -e "${RED}[dispatch]${NC} $*" >&2; }
success() { echo -e "${GREEN}[dispatch]${NC} $*"; }

# Python3 JSON helper — replaces jq (not available on this system)
pyjq() {
  python3 -c "
import json, sys
data = json.load(open('${DISPATCH_LOG}'))
$1
"
}

# Set the terminal tab title (works in VSCode integrated terminal + most emulators).
# Accepts an optional second arg: the TTY device to write to (for background loops).
set_terminal_title() {
  local tty_dev="${2:-/dev/tty}"
  printf '\033]0;%s\007' "$1" > "$tty_dev" 2>/dev/null || true
}

ensure_dispatch_dir() {
  mkdir -p "${WORKTREE_DIR}"
  if [[ ! -f "${DISPATCH_LOG}" ]]; then
    echo '[]' > "${DISPATCH_LOG}"
  fi
}

# Get the next available port (finds first unused port above BASE_PORT)
next_port() {
  pyjq "
used = {i['port'] for i in data}
for p in range(${BASE_PORT} + 1, ${BASE_PORT} + ${MAX_SLOTS} + 1):
    if p not in used:
        print(p)
        break
"
}

# Get worktree path for an issue number
worktree_path() {
  local issue_num="$1"
  echo "${WORKTREE_DIR}/issue-${issue_num}"
}

# Check if an issue is already dispatched
is_dispatched() {
  local issue_num="$1"
  pyjq "sys.exit(0 if any(i['issue'] == ${issue_num} for i in data) else 1)"
}

# Add entry to dispatch log
log_dispatch() {
  local issue_num="$1" branch="$2" port="$3" title="$4"
  python3 -c "
import json, datetime
with open('${DISPATCH_LOG}') as f: data = json.load(f)
data.append({
    'issue': ${issue_num},
    'branch': '${branch}',
    'port': ${port},
    'title': '''${title}''',
    'dispatched_at': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
    'status': 'active'
})
with open('${DISPATCH_LOG}', 'w') as f: json.dump(data, f, indent=2)
"
}

# Remove entry from dispatch log
unlog_dispatch() {
  local issue_num="$1"
  python3 -c "
import json
with open('${DISPATCH_LOG}') as f: data = json.load(f)
data = [i for i in data if i['issue'] != ${issue_num}]
with open('${DISPATCH_LOG}', 'w') as f: json.dump(data, f, indent=2)
"
}

# Read a field from the dispatch log for a given issue
dispatch_field() {
  local issue_num="$1" field="$2"
  pyjq "
for i in data:
    if i['issue'] == ${issue_num}:
        print(i['${field}'])
        break
"
}

# ── Neon DB Branch Helpers ────────────────────────────────────────────────────

neon_enabled() {
  [[ -n "${NEON_API_KEY}" && -n "${NEON_PROJECT_ID}" ]]
}

# Create a Neon branch for a worktree. Prints the connection URI.
# Args: <issue_num>
neon_create_branch() {
  local issue_num="$1"
  local branch_name="wt/issue-${issue_num}"

  if ! neon_enabled; then
    warn "Neon API key or project ID not set — skipping DB branch isolation."
    warn "All worktrees will share DATABASE_DEV_URL. Risk of schema drift!"
    return 1
  fi

  # Check if branch already exists (e.g. resuming a parked issue)
  local existing
  existing=$(curl -sf \
    -H "Authorization: Bearer ${NEON_API_KEY}" \
    "${NEON_API}/projects/${NEON_PROJECT_ID}/branches" \
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
for b in data.get('branches', []):
    if b['name'] == '${branch_name}':
        print(b['id'])
        break
" 2>/dev/null || true)

  if [[ -n "$existing" ]]; then
    log "Reusing existing Neon branch: ${branch_name} (${existing})"
    # Get connection string for existing branch
    local conn_uri
    conn_uri=$(curl -sf \
      -H "Authorization: Bearer ${NEON_API_KEY}" \
      "${NEON_API}/projects/${NEON_PROJECT_ID}/connection_uri?branch_id=${existing}&database_name=neondb&role_name=neondb_owner&pooled=true" \
      | python3 -c "import json,sys; print(json.load(sys.stdin).get('uri',''))" 2>/dev/null || true)
    if [[ -n "$conn_uri" ]]; then
      echo "$conn_uri"
      return 0
    fi
    warn "Could not get connection string for existing branch — creating fresh."
    # Delete the broken one and fall through to create
    curl -sf -X DELETE \
      -H "Authorization: Bearer ${NEON_API_KEY}" \
      "${NEON_API}/projects/${NEON_PROJECT_ID}/branches/${existing}" >/dev/null 2>&1 || true
  fi

  # Create new branch forked from dev
  local response
  response=$(curl -sf -X POST \
    -H "Authorization: Bearer ${NEON_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"branch\": {\"name\": \"${branch_name}\", \"parent_id\": \"${NEON_DEV_BRANCH_ID}\"}, \"endpoints\": [{\"type\": \"read_write\"}]}" \
    "${NEON_API}/projects/${NEON_PROJECT_ID}/branches" 2>/dev/null) || {
    warn "Failed to create Neon branch. Falling back to shared DATABASE_DEV_URL."
    return 1
  }

  local conn_uri
  conn_uri=$(echo "$response" | python3 -c "
import json, sys
data = json.load(sys.stdin)
uris = data.get('connection_uris', [])
if uris:
    print(uris[0].get('connection_uri', ''))
" 2>/dev/null || true)

  if [[ -z "$conn_uri" ]]; then
    warn "Neon branch created but no connection URI returned. Falling back to shared DATABASE_DEV_URL."
    return 1
  fi

  echo "$conn_uri"
}

# Delete a Neon branch for a worktree.
# Args: <issue_num>
neon_delete_branch() {
  local issue_num="$1"
  local branch_name="wt/issue-${issue_num}"

  if ! neon_enabled; then return 0; fi

  # Find the branch ID by name
  local branch_id
  branch_id=$(curl -sf \
    -H "Authorization: Bearer ${NEON_API_KEY}" \
    "${NEON_API}/projects/${NEON_PROJECT_ID}/branches" \
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
for b in data.get('branches', []):
    if b['name'] == '${branch_name}':
        print(b['id'])
        break
" 2>/dev/null || true)

  if [[ -z "$branch_id" ]]; then
    return 0  # Already deleted or never created
  fi

  curl -sf -X DELETE \
    -H "Authorization: Bearer ${NEON_API_KEY}" \
    "${NEON_API}/projects/${NEON_PROJECT_ID}/branches/${branch_id}" >/dev/null 2>&1 && \
    log "Deleted Neon branch: ${branch_name}" || \
    warn "Could not delete Neon branch ${branch_name} — clean up manually at console.neon.tech"
}

# List all wt/* Neon branches (for diagnostics and cleanup)
neon_list_branches() {
  if ! neon_enabled; then
    error "Neon API key or project ID not set in .env"
    return 1
  fi

  curl -sf \
    -H "Authorization: Bearer ${NEON_API_KEY}" \
    "${NEON_API}/projects/${NEON_PROJECT_ID}/branches" \
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
wt_branches = [b for b in data.get('branches', []) if b['name'].startswith('wt/')]
if not wt_branches:
    print('  No worktree branches found.')
    sys.exit(0)
for b in wt_branches:
    print(f\"  {b['name']:<25}  {b['id']}  created={b['created_at'][:10]}\")
"
}

# Delete all wt/* Neon branches that don't correspond to an active dispatch slot
neon_prune_branches() {
  if ! neon_enabled; then
    error "Neon API key or project ID not set in .env"
    return 1
  fi

  DISPATCH_LOG_FOR_PY="${DISPATCH_LOG}" python3 -c "
import json, subprocess, sys, os

# Load active dispatch slots
log_path = os.environ['DISPATCH_LOG_FOR_PY']
try:
    with open(log_path) as f:
        slots = json.load(f)
except:
    slots = []
active_issues = {s['issue'] for s in slots}

# List Neon branches
raw = subprocess.check_output([
    'curl', '-sf',
    '-H', 'Authorization: Bearer ${NEON_API_KEY}',
    '${NEON_API}/projects/${NEON_PROJECT_ID}/branches'
], text=True)
branches = json.loads(raw).get('branches', [])
wt_branches = [b for b in branches if b['name'].startswith('wt/')]

if not wt_branches:
    print('  No worktree branches to prune.')
    sys.exit(0)

orphans = []
for b in wt_branches:
    # Extract issue number from 'wt/issue-42'
    try:
        num = int(b['name'].split('-', 1)[1])
    except:
        num = -1
    if num not in active_issues:
        orphans.append(b)

if not orphans:
    print('  All worktree branches are active. Nothing to prune.')
    sys.exit(0)

print(f'  Found {len(orphans)} orphaned branch(es):')
for b in orphans:
    print(f'    {b[\"name\"]}  ({b[\"id\"]})')

for b in orphans:
    try:
        subprocess.check_output([
            'curl', '-sf', '-X', 'DELETE',
            '-H', 'Authorization: Bearer ${NEON_API_KEY}',
            '${NEON_API}/projects/${NEON_PROJECT_ID}/branches/' + b['id']
        ], text=True)
        print(f'    ✓ Deleted {b[\"name\"]}')
    except:
        print(f'    ✗ Failed to delete {b[\"name\"]}')
"
}

# ── GitHub Helpers ────────────────────────────────────────────────────────────

# Get the GitHub Projects item ID for an issue
get_project_item_id() {
  local issue_num="$1"
  local repo_owner="${REPO%/*}"
  local repo_name="${REPO#*/}"
  gh api graphql -f query="
    {
      repository(owner: \"${repo_owner}\", name: \"${repo_name}\") {
        issue(number: ${issue_num}) {
          projectItems(first: 5) {
            nodes { id }
          }
        }
      }
    }
  " 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
nodes = data.get('data',{}).get('repository',{}).get('issue',{}).get('projectItems',{}).get('nodes',[])
if nodes:
    print(nodes[0]['id'])
" 2>/dev/null || echo ""
}

# Move issue on project board
move_issue() {
  local issue_num="$1" status_id="$2"
  local item_id
  item_id=$(get_project_item_id "$issue_num")
  if [[ -z "$item_id" ]]; then
    # Issue not on board yet — add it first
    log "Adding #${issue_num} to project board..."
    gh project item-add "${PROJECT_NUMBER}" --owner "${REPO%/*}" \
      --url "https://github.com/${REPO}/issues/${issue_num}" 2>/dev/null || {
      warn "Could not add issue #${issue_num} to board"
      return 1
    }
    item_id=$(get_project_item_id "$issue_num")
  fi
  if [[ -n "$item_id" ]]; then
    gh project item-edit --project-id "${PROJECT_ID}" \
      --id "$item_id" \
      --field-id "${STATUS_FIELD_ID}" \
      --single-select-option-id "$status_id" 2>/dev/null && return 0
  fi
  warn "Could not move issue #${issue_num} on board (item not found or API error)"
}

# Parse issue JSON fields using python3 (replaces jq -r)
json_field() {
  local json="$1" field="$2"
  echo "$json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('${field}',''))"
}

json_labels() {
  local json="$1"
  echo "$json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(', '.join(l['name'] for l in d.get('labels',[])))"
}

json_body() {
  local json="$1"
  echo "$json" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('body') or 'No body provided.')"
}

# ── Tmux Helpers ──────────────────────────────────────────────────────────────
# tmux is OPTIONAL. These helpers no-op gracefully when tmux isn't installed,
# and never abort the script. Hard tmux failures surface as warnings.

tmux_session_name() { basename "${REPO_ROOT}"; }

# Window name: "WT-<branch-without-prefix>" capped at 30 chars.
# Example: branch "feat/8-fix-date-filter" → window "WT-8-fix-date-filter".
# Falls back to "WT-<num>" if the slot isn't in the dispatch log yet.
tmux_window_name() {
  local issue_num="$1"
  local branch
  branch=$(dispatch_field "$issue_num" "branch" 2>/dev/null || echo "")
  if [[ -n "$branch" ]]; then
    echo "WT-${branch#*/}" | cut -c1-30
  else
    echo "WT-${issue_num}"
  fi
}

tmux_has_session() { tmux has-session -t "=$1" 2>/dev/null; }

tmux_has_window() {
  local session="$1" window="$2"
  tmux list-windows -t "=${session}" -F '#{window_name}' 2>/dev/null \
    | grep -Fxq "${window}"
}

ensure_tmux_session() {
  local session="$1"
  if ! tmux_has_session "$session"; then
    tmux new-session -d -s "$session" -c "${REPO_ROOT}"
    tmux rename-window -t "${session}:0" "main" 2>/dev/null || true
  fi
}

# Open a slot in a tmux window. Idempotent — focuses existing window if present.
# Args: <issue_num> [no-attach]
# When called outside tmux without no-attach, this REPLACES the current shell
# with `tmux attach` (via exec). When called inside tmux, it selects the window.
open_slot_in_tmux() {
  local issue_num="$1"
  local mode="${2:-attach}"

  if ! command -v tmux >/dev/null 2>&1; then
    error "tmux is not installed. Run: sudo apt install tmux"
    return 1
  fi

  local wt_path port
  wt_path=$(worktree_path "$issue_num")
  port=$(dispatch_field "$issue_num" "port")

  local session window
  session=$(tmux_session_name)
  window=$(tmux_window_name "$issue_num")

  ensure_tmux_session "$session"

  if tmux_has_window "$session" "$window"; then
    log "Focusing existing tmux window ${BOLD}${session}:${window}${NC}"
    if [[ -n "${TMUX:-}" ]]; then
      tmux select-window -t "${session}:${window}" 2>/dev/null || true
    fi
  else
    log "Creating tmux window ${BOLD}${session}:${window}${NC} (claude + dev:${port})"
    # Window: starts in worktree, claude in left pane (~70%), dev server right (~30%)
    tmux new-window -t "$session" -n "$window" -c "$wt_path"
    tmux send-keys -t "${session}:${window}" "npx claude" C-m
    tmux split-window -t "${session}:${window}" -h -l 30% -c "$wt_path"
    tmux send-keys -t "${session}:${window}" "PORT=${port} pnpm dev" C-m
    tmux select-pane -t "${session}:${window}" -L 2>/dev/null || true
  fi

  if [[ -z "${TMUX:-}" && "$mode" == "attach" ]]; then
    log "Attaching to tmux session..."
    exec tmux attach -t "$session" \; select-window -t "${session}:${window}"
  fi
}

# Returns 0 if the slot has a live tmux window, 1 otherwise. Silent.
slot_has_tmux_window() {
  local issue_num="$1"
  command -v tmux >/dev/null 2>&1 || return 1
  local session window
  session=$(tmux_session_name)
  window=$(tmux_window_name "$issue_num")
  tmux_has_window "$session" "$window"
}

# Close the tmux window for a slot if it exists. Used by park/cleanup.
close_slot_tmux_window() {
  local issue_num="$1"
  command -v tmux >/dev/null 2>&1 || return 0
  local session window
  session=$(tmux_session_name)
  window=$(tmux_window_name "$issue_num")
  if tmux_has_window "$session" "$window"; then
    log "Closing tmux window ${session}:${window}"
    tmux kill-window -t "${session}:${window}" 2>/dev/null || true
  fi
}

# ── Loop Helpers ─────────────────────────────────────────────────────────────

# Find the next Ready + claude-labeled issue that isn't blocked.
# Returns "number|title" or empty string if none found.
find_next_ready_issue() {
  REPO_FOR_PY="${REPO}" python3 << 'PYEOF'
import os, json, subprocess, sys

REPO = os.environ["REPO_FOR_PY"]

# 1. Get open issues with claude label (small, bounded set)
try:
    raw = subprocess.check_output(
        ["gh", "issue", "list", "--repo", REPO, "--state", "open",
         "--label", "claude", "--limit", "50",
         "--json", "number,title,labels,body"],
        stderr=subprocess.DEVNULL, text=True
    )
    issues = json.loads(raw)
except Exception:
    sys.exit(0)

if not issues:
    sys.exit(0)

# 2. Check each issue's board status via targeted GraphQL (no board-wide scan)
def get_board_status(issue_num):
    try:
        raw = subprocess.check_output(
            ["gh", "issue", "view", str(issue_num), "--repo", REPO,
             "--json", "projectItems"],
            stderr=subprocess.DEVNULL, text=True
        )
        items = json.loads(raw).get("projectItems", [])
        if items:
            return items[0].get("status", {}).get("name", "")
    except Exception:
        pass
    return ""

ready_issues = [i for i in issues if get_board_status(i["number"]) == "Ready"]

if not ready_issues:
    sys.exit(0)

# 4. Check blocked status — parse body for "blocked by #N" where #N is still open
try:
    raw = subprocess.check_output(
        ["gh", "issue", "list", "--repo", REPO, "--state", "open",
         "--limit", "100", "--json", "number"],
        stderr=subprocess.DEVNULL, text=True
    )
    open_numbers = {i["number"] for i in json.loads(raw)}
except Exception:
    open_numbers = set()

import re

def is_blocked(issue):
    body = issue.get("body") or ""
    # Match patterns: "blocked by #14", "depends on #14", "requires #14"
    blockers = re.findall(r'(?:blocked\s+by|depends\s+on|requires|after)\s+#(\d+)', body, re.IGNORECASE)
    for b in blockers:
        if int(b) in open_numbers:
            return True
    return False

eligible = [i for i in ready_issues if not is_blocked(i)]

if not eligible:
    sys.exit(0)

# 5. Sort by priority (P0 > P1 > P2 > P3 > unlabeled)
priority_order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}

def sort_key(issue):
    labels = [l["name"] for l in issue.get("labels", [])]
    p = min((priority_order.get(l, 99) for l in labels), default=99)
    return (p, issue["number"])

eligible.sort(key=sort_key)
best = eligible[0]
print(f"{best['number']}|{best['title']}")
PYEOF
}

# Park an issue during the loop (non-interactive, with GitHub comment)
loop_park() {
  local issue_num="$1" reason="$2"
  local wt_path
  wt_path=$(worktree_path "$issue_num")
  local branch
  branch=$(dispatch_field "$issue_num" "branch")

  # Remove worktree, keep branch
  git -C "${REPO_ROOT}" worktree remove "${wt_path}" --force 2>/dev/null || {
    rm -rf "${wt_path}"
    git -C "${REPO_ROOT}" worktree prune
  }

  # Remove from dispatch log
  unlog_dispatch "$issue_num"

  # Comment on the issue
  gh issue comment "$issue_num" --repo "${REPO}" \
    --body "🤖 **Dispatch loop**: Parked — ${reason}
Branch \`${branch}\` preserved for manual resume." 2>/dev/null || true
}

# Clean up after a successful loop PR (non-interactive)
loop_cleanup() {
  local issue_num="$1"
  local wt_path
  wt_path=$(worktree_path "$issue_num")
  local branch
  branch=$(dispatch_field "$issue_num" "branch")

  # Remove worktree
  git -C "${REPO_ROOT}" worktree remove "${wt_path}" --force 2>/dev/null || {
    rm -rf "${wt_path}"
    git -C "${REPO_ROOT}" worktree prune
  }

  # Delete branch (it's been pushed for the PR)
  git -C "${REPO_ROOT}" branch -D "${branch}" 2>/dev/null || true

  # Delete Neon DB branch
  neon_delete_branch "$issue_num"

  # Remove from dispatch log
  unlog_dispatch "$issue_num"
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_start() {
  local issue_num="" use_tmux=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tmux) use_tmux=true; shift ;;
      *)      issue_num="$1"; shift ;;
    esac
  done

  if [[ -z "$issue_num" ]]; then
    error "Usage: dispatch start <issue-number> [--tmux]"
    echo ""
    echo "Available issues:"
    gh issue list --repo "${REPO}" --state open --limit 15 \
      --json number,title,labels \
      --template '{{range .}}  #{{.number}}  {{.title}}  {{range .labels}}[{{.name}}] {{end}}{{"\n"}}{{end}}'
    exit 1
  fi

  # Strip # prefix if provided
  issue_num="${issue_num#\#}"

  ensure_dispatch_dir

  # Check slot limit
  local active_count
  active_count=$(pyjq "print(len(data))")
  if (( active_count >= MAX_SLOTS )); then
    error "All ${MAX_SLOTS} dispatch slots are in use. Run 'dispatch status' to see them."
    error "Clean up a slot with 'dispatch cleanup <issue-number>' first."
    exit 1
  fi

  # Check if already dispatched
  if is_dispatched "$issue_num"; then
    error "Issue #${issue_num} is already dispatched."
    echo ""
    cmd_status
    exit 1
  fi

  # Fetch issue details
  local issue_json
  issue_json=$(gh issue view "$issue_num" --repo "${REPO}" --json title,body,labels 2>/dev/null) || {
    error "Issue #${issue_num} not found."
    exit 1
  }

  local title
  title=$(json_field "$issue_json" "title")
  local labels
  labels=$(json_labels "$issue_json")

  # Determine branch type from labels
  local branch_type="feat"
  if echo "$labels" | grep -qi "bug"; then
    branch_type="fix"
  elif echo "$labels" | grep -qi "refactor"; then
    branch_type="refactor"
  elif echo "$labels" | grep -qi "chore"; then
    branch_type="chore"
  fi

  # Create branch name
  local slug
  slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | cut -c1-40)
  local branch="${branch_type}/${issue_num}-${slug}"

  local wt_path
  wt_path=$(worktree_path "$issue_num")
  local port
  port=$(next_port)

  log "Dispatching issue #${issue_num}: ${BOLD}${title}${NC}"
  echo ""

  # Step 1: Create worktree
  log "Creating worktree at ${DIM}${wt_path}${NC}"
  git -C "${REPO_ROOT}" worktree add "${wt_path}" -b "${branch}" main 2>/dev/null || {
    # Branch might already exist
    git -C "${REPO_ROOT}" worktree add "${wt_path}" "${branch}" 2>/dev/null || {
      error "Failed to create worktree. Check if branch '${branch}' already exists."
      exit 1
    }
  }

  # Step 2: Symlink .env
  if [[ -f "${REPO_ROOT}/.env" ]]; then
    ln -sf "${REPO_ROOT}/.env" "${wt_path}/.env"
    log "Linked .env"
  fi

  # Step 2.5: Create isolated Neon DB branch for this worktree
  local neon_conn_uri=""
  if neon_enabled; then
    log "Creating isolated Neon DB branch for issue #${issue_num}..."
    neon_conn_uri=$(neon_create_branch "$issue_num" 2>/dev/null || true)
    if [[ -n "$neon_conn_uri" ]]; then
      # Write per-worktree .env.local (loaded by Next.js AFTER .env, overrides DATABASE_DEV_URL)
      cat > "${wt_path}/.env.local" << ENVLOCAL_EOF
# Auto-generated by dispatch — isolated Neon DB branch for issue #${issue_num}
# This file is NOT symlinked and NOT committed. It overrides .env values.
PORT=${port}
DATABASE_DEV_URL=${neon_conn_uri}
ENVLOCAL_EOF
      success "Neon branch created — db:push:dev is safe in this worktree"
    else
      # Fallback: at least write PORT to .env.local
      echo "PORT=${port}" > "${wt_path}/.env.local"
      warn "Neon branch failed — worktree shares DATABASE_DEV_URL with main. Be careful with db:push:dev!"
    fi
  else
    echo "PORT=${port}" > "${wt_path}/.env.local"
    warn "Neon not configured — worktree shares DATABASE_DEV_URL with main."
  fi

  # Step 3: Install dependencies
  log "Installing dependencies (pnpm install)..."
  (cd "${wt_path}" && pnpm install --frozen-lockfile 2>&1 | tail -1)

  # Step 3.5: Restore stash if this branch was previously parked
  local stash_match
  stash_match=$(git -C "${wt_path}" stash list 2>/dev/null | grep "dispatch-park: auto-stash for #${issue_num}" | head -1 | cut -d: -f1 || true)
  if [[ -n "$stash_match" ]]; then
    log "Restoring stashed changes from previous park..."
    git -C "${wt_path}" stash pop "$stash_match" 2>/dev/null && success "Stash restored." || warn "Stash restore had conflicts — check manually."
  fi

  # Step 4: Determine complexity for approach instructions
  local issue_body
  issue_body=$(json_body "$issue_json")

  local is_large="false"
  if echo "$labels" | grep -qi "type:feature"; then
    if echo "$labels" | grep -qiE "P0|P1"; then
      is_large="true"
    fi
  fi
  local body_length=${#issue_body}
  if (( body_length > 1500 )); then
    is_large="true"
  fi

  local approach_section
  if [[ "$is_large" == "true" ]]; then
    approach_section="## Approach — Complex Issue
BEFORE writing any code:
1. Use the superpowers:brainstorming skill (\`/brainstorm\`) to explore the problem space, clarify requirements, and design your approach.
2. Once you have a clear plan, proceed with implementation."
  else
    approach_section="## Approach — Focused Issue
This is a focused task. Jump straight into implementation — no brainstorm or plan needed."
  fi

  # Write dispatch instructions as CLAUDE.local.md (auto-loaded by Claude Code,
  # not committed since worktrees are gitignored)
  local agent_md="${wt_path}/CLAUDE.local.md"
  cat > "${agent_md}" << AGENT_EOF
# Dispatched Session — Issue #${issue_num}

**You are a dispatched Claude Code session working on a specific issue.**

## Your Assignment
- **Issue**: #${issue_num} — ${title}
- **Branch**: \`${branch}\`
- **Labels**: ${labels}
- **Port**: ${port} (use \`pnpm dev -- --port ${port}\` if you need a dev server)

${approach_section}

## Coding Rules (non-negotiable)
- ONE React component per file. No exceptions.
- No file-level constants in component files — extract to \`constants/\`.
- No helper functions in component files — extract to \`lib/\`.
- Named exports only. Never \`export default\`.
- Follow existing project patterns and import conventions.
- Read \`CLAUDE.md\` and \`memory/coding-conventions.md\` for full coding standards.
- Read \`docs/domain/ubiquitous-language.md\` for canonical domain terminology — use these terms exactly.

## Workflow Rules
1. **Stay on your branch.** Do not switch branches or touch other worktrees.
2. **Follow conventional commits**: \`${branch_type}(scope): description\`
3. **Do NOT create a PR.** The user will do that via \`dispatch pr ${issue_num}\`.
4. **Do NOT push to remote.** The user controls when to push.
5. **When blocked**: stop and explain what you need. Do not guess or work around it.

## When Done
1. Run \`pnpm lint\` and fix any errors.
2. Run \`pnpm build\` and fix any errors.
3. Review your own diff with \`git diff\` — check for unintended changes, debug logs, or leftover code.
4. Commit your work using conventional commits matching your branch type.
5. Say **"DONE — ready for review"** so the user knows you're finished.

## Dev Server
If you need to run the dev server, use port ${port} to avoid conflicts:
\`\`\`bash
pnpm dev -- --port ${port}
\`\`\`

## Issue Body
${issue_body}
AGENT_EOF

  # Step 5: Record in dispatch log
  log_dispatch "$issue_num" "$branch" "$port" "$title"

  # Step 6: Move issue on board
  log "Moving issue #${issue_num} to In Progress on board..."
  move_issue "$issue_num" "${STATUS_IN_PROGRESS}"

  echo ""
  success "Dispatched! Slot ready at: ${BOLD}${wt_path}${NC}"
  echo ""
  echo -e "  ${CYAN}To start a Claude session in this slot:${NC}"
  echo ""
  echo -e "  ${BOLD}cd ${wt_path} && claude${NC}"
  echo ""
  echo -e "  ${DIM}Claude will auto-read DISPATCH.md for its assignment.${NC}"
  echo -e "  ${DIM}Dev server port: ${port}${NC}"
  echo ""

  if [[ "$use_tmux" == "true" ]]; then
    open_slot_in_tmux "$issue_num"
  fi
}

cmd_status() {
  ensure_dispatch_dir

  local count
  count=$(pyjq "print(len(data))")

  if (( count == 0 )); then
    log "No active dispatch slots. (${MAX_SLOTS} available)"
    echo ""
    echo -e "  Start one with: ${BOLD}dispatch start <issue-number>${NC}"
    return
  fi

  echo ""
  echo -e "${BOLD}  DISPATCH BOARD${NC}  (${count}/${MAX_SLOTS} slots)"
  echo -e "  $( printf '─%.0s' {1..50} )"
  echo ""

  # Read entries via python3 and iterate
  pyjq "
for i in data:
    print(f\"{i['issue']}|{i['branch']}|{i['port']}|{i['title']}|{i['dispatched_at']}\")
" | while IFS='|' read -r issue branch port title dispatched; do
    local wt_path
    wt_path=$(worktree_path "$issue")
    local commit_count
    commit_count=$(git -C "$wt_path" rev-list --count "main..HEAD" 2>/dev/null || echo "?")
    local last_commit
    last_commit=$(git -C "$wt_path" log -1 --format='%s' 2>/dev/null || echo "no commits")

    echo -e "  ${GREEN}#${issue}${NC}  ${BOLD}${title}${NC}"
    echo -e "  ${DIM}branch:${NC}  ${branch}"
    echo -e "  ${DIM}port:${NC}    ${port}"
    echo -e "  ${DIM}commits:${NC} ${commit_count} ahead of main"
    echo -e "  ${DIM}latest:${NC}  ${last_commit}"
    echo -e "  ${DIM}path:${NC}    ${wt_path}"
    echo -e "  ${DIM}since:${NC}   ${dispatched}"
    if slot_has_tmux_window "$issue"; then
      echo -e "  ${DIM}tmux:${NC}    ${GREEN}$(tmux_session_name):$(tmux_window_name "$issue")${NC} ${DIM}(live)${NC}"
    else
      echo -e "  ${DIM}tmux:${NC}    ${DIM}(no window)${NC}"
    fi
    echo ""
  done

  echo -e "  ${DIM}Commands: dispatch review <#> | dispatch pr <#> | dispatch cleanup <#>${NC}"
  echo ""
}

cmd_review() {
  local issue_num="${1:-}"

  if [[ -z "$issue_num" ]]; then
    error "Usage: dispatch review <issue-number>"
    exit 1
  fi
  issue_num="${issue_num#\#}"
  ensure_dispatch_dir

  if ! is_dispatched "$issue_num"; then
    error "Issue #${issue_num} is not dispatched."
    exit 1
  fi

  local wt_path
  wt_path=$(worktree_path "$issue_num")

  echo ""
  echo -e "${BOLD}  REVIEW — Issue #${issue_num}${NC}"
  echo -e "  $( printf '─%.0s' {1..50} )"
  echo ""

  # Show commit log
  echo -e "  ${CYAN}Commits:${NC}"
  git -C "$wt_path" log --oneline "main..HEAD" 2>/dev/null | sed 's/^/    /' || echo "    (no commits)"
  echo ""

  # Show diff stats
  echo -e "  ${CYAN}Changed files:${NC}"
  git -C "$wt_path" diff --stat "main..HEAD" 2>/dev/null | sed 's/^/    /' || echo "    (no changes)"
  echo ""

  # Run lint
  echo -e "  ${CYAN}Running lint...${NC}"
  if (cd "$wt_path" && pnpm lint 2>&1 | tail -3 | sed 's/^/    /'); then
    echo -e "    ${GREEN}Lint passed${NC}"
  else
    echo -e "    ${RED}Lint failed${NC}"
  fi
  echo ""

  # Run build
  echo -e "  ${CYAN}Running build...${NC}"
  if (cd "$wt_path" && pnpm build 2>&1 | tail -5 | sed 's/^/    /'); then
    echo -e "    ${GREEN}Build passed${NC}"
  else
    echo -e "    ${RED}Build failed${NC}"
  fi
  echo ""

  echo -e "  ${DIM}Full diff: git -C ${wt_path} diff main..HEAD${NC}"
  echo -e "  ${DIM}Next step: dispatch pr ${issue_num}${NC}"
  echo ""
}

cmd_pr() {
  local issue_num="${1:-}"

  if [[ -z "$issue_num" ]]; then
    error "Usage: dispatch pr <issue-number>"
    exit 1
  fi
  issue_num="${issue_num#\#}"
  ensure_dispatch_dir

  if ! is_dispatched "$issue_num"; then
    error "Issue #${issue_num} is not dispatched."
    exit 1
  fi

  local wt_path
  wt_path=$(worktree_path "$issue_num")
  local branch
  branch=$(dispatch_field "$issue_num" "branch")
  local title
  title=$(dispatch_field "$issue_num" "title")

  log "Preparing PR for issue #${issue_num}..."

  # Push branch
  log "Pushing branch ${branch}..."
  git -C "$wt_path" push -u origin "${branch}" 2>&1 | tail -3

  # Build PR body from commits
  local commits
  commits=$(git -C "$wt_path" log --oneline "main..HEAD" 2>/dev/null || echo "")
  local files_changed
  files_changed=$(git -C "$wt_path" diff --stat "main..HEAD" 2>/dev/null | tail -1 || echo "")

  # Create PR
  log "Creating PR..."
  local pr_url
  pr_url=$(cd "$wt_path" && gh pr create \
    --title "${title}" \
    --body "$(cat <<PR_EOF
## Summary
Closes #${issue_num}

## Changes
$(echo "$commits" | sed 's/^/- /')

## Stats
${files_changed}

## Preview
> Vercel auto-deploys a preview for this PR. Check the deployment status below or the bot comment for the URL.

📱 **Test on mobile** — open the preview URL on your phone to QA.

## Self-Review
- [x] \`pnpm lint\` passes
- [x] \`pnpm build\` passes
- [ ] Vercel preview deployment works
- [ ] Diff reviewed for unintended changes

## Test Plan
- [ ] Verified via Vercel preview
PR_EOF
)" \
    --base main 2>&1) || {
    error "Failed to create PR."
    exit 1
  }

  # Move issue on board
  log "Moving issue #${issue_num} to In Review on board..."
  move_issue "$issue_num" "${STATUS_IN_REVIEW}"

  echo ""
  success "PR created: ${BOLD}${pr_url}${NC}"
  echo ""
  echo -e "  ${DIM}Next step: dispatch cleanup ${issue_num} (after PR merges)${NC}"
  echo ""
}

cmd_park() {
  local issue_num="${1:-}"

  if [[ -z "$issue_num" ]]; then
    error "Usage: dispatch park <issue-number>"
    exit 1
  fi
  issue_num="${issue_num#\#}"
  ensure_dispatch_dir

  if ! is_dispatched "$issue_num"; then
    error "Issue #${issue_num} is not dispatched."
    exit 1
  fi

  local wt_path
  wt_path=$(worktree_path "$issue_num")
  local branch
  branch=$(dispatch_field "$issue_num" "branch")
  local title
  title=$(dispatch_field "$issue_num" "title")

  # Check for uncommitted changes (ignoring dispatch-generated files)
  local dirty
  dirty=$(git -C "$wt_path" status --porcelain 2>/dev/null | grep -v 'CLAUDE.local.md' || true)
  if [[ -n "$dirty" ]]; then
    warn "Worktree has uncommitted changes — auto-stashing."
    echo ""
    echo "$dirty" | sed 's/^/    /'
    echo ""
    git -C "$wt_path" stash push -m "dispatch-park: auto-stash for #${issue_num}" 2>/dev/null
    success "Stashed. Will restore on next 'dispatch start ${issue_num}'."
  fi

  local commit_count
  commit_count=$(git -C "$wt_path" rev-list --count "main..HEAD" 2>/dev/null || echo "0")

  log "Parking issue #${issue_num}: ${BOLD}${title}${NC}"

  # Remove worktree but keep the branch
  git -C "${REPO_ROOT}" worktree remove "${wt_path}" --force 2>/dev/null || {
    warn "Could not remove worktree cleanly, forcing..."
    rm -rf "${wt_path}"
    git -C "${REPO_ROOT}" worktree prune
  }

  # Remove from dispatch log to free the slot
  unlog_dispatch "$issue_num"

  # Close the slot's tmux window if present
  close_slot_tmux_window "$issue_num"

  local remaining
  remaining=$(pyjq "print(len(data))")

  echo ""
  success "Parked! Slot freed. (${remaining}/${MAX_SLOTS} in use)"
  echo ""
  echo -e "  ${DIM}Branch preserved:${NC}  ${BOLD}${branch}${NC}  (${commit_count} commits ahead)"
  echo -e "  ${DIM}To resume later:${NC}   ${CYAN}dispatch start ${issue_num}${NC}"
  echo -e "  ${DIM}                   (will reuse the existing branch)${NC}"
  echo ""
}

cmd_cleanup() {
  local issue_num="${1:-}"

  if [[ -z "$issue_num" ]]; then
    error "Usage: dispatch cleanup <issue-number>"
    exit 1
  fi
  issue_num="${issue_num#\#}"
  ensure_dispatch_dir

  if ! is_dispatched "$issue_num"; then
    error "Issue #${issue_num} is not dispatched."
    exit 1
  fi

  local wt_path
  wt_path=$(worktree_path "$issue_num")
  local branch
  branch=$(dispatch_field "$issue_num" "branch")

  log "Cleaning up slot for issue #${issue_num}..."

  # Check for uncommitted changes
  if [[ -n "$(git -C "$wt_path" status --porcelain 2>/dev/null)" ]]; then
    warn "Worktree has uncommitted changes!"
    echo ""
    git -C "$wt_path" status --short | sed 's/^/    /'
    echo ""
    read -rp "  Discard changes and clean up? (y/N) " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
      log "Aborted."
      exit 0
    fi
  fi

  # Remove worktree
  git -C "${REPO_ROOT}" worktree remove "${wt_path}" --force 2>/dev/null || {
    warn "Could not remove worktree cleanly, forcing..."
    rm -rf "${wt_path}"
    git -C "${REPO_ROOT}" worktree prune
  }

  # Optionally delete branch
  read -rp "  Delete local branch '${branch}'? (y/N) " del_branch
  if [[ "$del_branch" == "y" || "$del_branch" == "Y" ]]; then
    git -C "${REPO_ROOT}" branch -D "${branch}" 2>/dev/null || true
    log "Deleted branch ${branch}"
  fi

  # Delete Neon DB branch
  neon_delete_branch "$issue_num"

  # Remove from log
  unlog_dispatch "$issue_num"

  # Close the slot's tmux window if present
  close_slot_tmux_window "$issue_num"

  local remaining
  remaining=$(pyjq "print(len(data))")
  success "Slot for #${issue_num} cleaned up. ${remaining}/${MAX_SLOTS} slots in use."
}

cmd_list() {
  ensure_dispatch_dir

  # Detect terminal width so titles only truncate when they actually overflow.
  local term_cols
  term_cols=$(tput cols 2>/dev/null || echo 100)
  local divider_width=$(( term_cols > 80 ? 80 : term_cols - 4 ))
  (( divider_width < 20 )) && divider_width=20

  echo ""
  echo -e "${BOLD}  AVAILABLE ISSUES${NC}"
  echo -e "  $( printf '─%.0s' $(seq 1 "${divider_width}") )"
  echo ""

  # Fetch issues and format cleanly with python3
  gh issue list --repo "${REPO}" --state open --limit 20 \
    --json number,title,labels | TERM_COLS="${term_cols}" python3 -c "
import json, os, sys

data = json.load(sys.stdin)
# Prefix is '  #NNNN ' (8 chars). Reserve 2-char right margin.
cols = int(os.environ.get('TERM_COLS', '100'))
title_budget = max(40, cols - 8 - 2)

# Group by priority
p_order = {'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3}

for issue in sorted(data, key=lambda i: (
    min((p_order.get(l['name'], 99) for l in i['labels']), default=99),
    i['number']
)):
    num = issue['number']
    title = issue['title']
    labels = issue['labels']

    # Extract priority and type
    priority = next((l['name'] for l in labels if l['name'].startswith('P')), '')
    area = next((l['name'].replace('area:', '') for l in labels if l['name'].startswith('area:')), '')
    itype = next((l['name'].replace('type:', '') for l in labels if l['name'].startswith('type:')), '')
    has_claude = any(l['name'] == 'claude' for l in labels)

    # Color priority
    p_colors = {'P0': '\033[0;31m', 'P1': '\033[1;33m', 'P2': '\033[0;36m', 'P3': '\033[2m'}
    p_color = p_colors.get(priority, '\033[0m')
    reset = '\033[0m'
    dim = '\033[2m'
    green = '\033[0;32m'
    bold = '\033[1m'

    # Build tag line
    tags = []
    if priority: tags.append(f'{p_color}{priority}{reset}')
    if itype:    tags.append(f'{dim}{itype}{reset}')
    if area:     tags.append(f'{dim}{area}{reset}')
    if has_claude: tags.append(f'{green}agent{reset}')
    tag_str = '  '.join(tags)

    # Only truncate when the title would actually overflow the terminal
    if len(title) > title_budget:
        title = title[:title_budget - 3] + '...'

    print(f'  {green}#{num:<4}{reset} {bold}{title}{reset}')
    print(f'        {tag_str}')
    print()
"

  # Show dispatched count
  local count
  count=$(pyjq "print(len(data))")
  echo -e "  ${DIM}${count}/${MAX_SLOTS} slots in use  |  dispatch start <#> to begin${NC}"
  echo ""
}

cmd_run() {
  local issue_num="${1:-}"

  if [[ -z "$issue_num" ]]; then
    error "Usage: dispatch run <issue-number>"
    exit 1
  fi
  issue_num="${issue_num#\#}"
  ensure_dispatch_dir

  if ! is_dispatched "$issue_num"; then
    error "Issue #${issue_num} is not dispatched. Run 'dispatch start ${issue_num}' first."
    exit 1
  fi

  local wt_path title
  wt_path=$(worktree_path "$issue_num")
  title=$(dispatch_field "$issue_num" "title")

  log "Launching Claude for issue #${issue_num}: ${BOLD}${title}${NC}"
  echo -e "  ${DIM}Claude will auto-load CLAUDE.local.md with your assignment.${NC}"
  echo ""

  cd "${wt_path}"

  if [[ -n "${TMUX:-}" ]]; then
    # Inside tmux: rename the window for clarity, no OS title-bar fight needed
    tmux rename-window "$(tmux_window_name "$issue_num")" 2>/dev/null || true
    npx claude
  else
    # Outside tmux: keep fighting Claude Code over the terminal title
    local tab_title="🤖 #${issue_num} Claude"
    local my_tty
    my_tty=$(tty)
    set_terminal_title "${tab_title}" "${my_tty}"
    (while true; do set_terminal_title "${tab_title}" "${my_tty}"; sleep 2; done) &
    local title_pid=$!
    trap "kill ${title_pid} 2>/dev/null" EXIT
    npx claude
    kill "${title_pid}" 2>/dev/null
  fi
}

cmd_dev() {
  local issue_num="${1:-}"

  if [[ -z "$issue_num" ]]; then
    error "Usage: dispatch dev <issue-number>"
    exit 1
  fi
  issue_num="${issue_num#\#}"
  ensure_dispatch_dir

  if ! is_dispatched "$issue_num"; then
    error "Issue #${issue_num} is not dispatched. Run 'dispatch start ${issue_num}' first."
    exit 1
  fi

  local wt_path port title
  wt_path=$(worktree_path "$issue_num")
  port=$(dispatch_field "$issue_num" "port")
  title=$(dispatch_field "$issue_num" "title")

  log "Starting dev server for #${issue_num}: ${BOLD}${title}${NC}"
  echo -e "  ${DIM}Port: ${port}  |  URL: http://localhost:${port}${NC}"
  echo ""

  cd "${wt_path}"

  if [[ -n "${TMUX:-}" ]]; then
    # Inside tmux: window name handles identification; just run.
    PORT="${port}" pnpm dev
  else
    local tab_title="🌐 #${issue_num} :${port}"
    local my_tty
    my_tty=$(tty)
    set_terminal_title "${tab_title}" "${my_tty}"
    (while true; do set_terminal_title "${tab_title}" "${my_tty}"; sleep 2; done) &
    local title_pid=$!
    trap "kill ${title_pid} 2>/dev/null" EXIT
    PORT="${port}" pnpm dev
    kill "${title_pid}" 2>/dev/null
  fi
}

cmd_tmux() {
  local issue_num="${1:-}"

  if [[ -z "$issue_num" ]]; then
    error "Usage: dispatch tmux <issue-number>"
    exit 1
  fi
  issue_num="${issue_num#\#}"
  ensure_dispatch_dir

  if ! is_dispatched "$issue_num"; then
    error "Issue #${issue_num} is not dispatched. Run 'dispatch start ${issue_num}' first."
    exit 1
  fi

  open_slot_in_tmux "$issue_num"
}

cmd_all() {
  if [[ $# -eq 0 ]]; then
    error "Usage: dispatch all <issue-#> [issue-#] [...]"
    echo ""
    echo "  Starts a slot for each issue, opens each in a tmux window,"
    echo "  then attaches the session (only if you're outside tmux already)."
    exit 1
  fi

  ensure_dispatch_dir

  local started=()
  for arg in "$@"; do
    local n="${arg#\#}"
    if is_dispatched "$n"; then
      warn "Issue #${n} already dispatched — will just open in tmux."
      started+=("$n")
      continue
    fi
    if cmd_start "$n"; then
      started+=("$n")
    else
      warn "Failed to start #${n} — skipping."
    fi
  done

  if [[ ${#started[@]} -eq 0 ]]; then
    error "No slots created."
    exit 1
  fi

  # Create all tmux windows without attaching mid-loop
  local n
  for n in "${started[@]}"; do
    open_slot_in_tmux "$n" "no-attach"
  done

  if [[ -z "${TMUX:-}" ]]; then
    local session first_window
    session=$(tmux_session_name)
    first_window=$(tmux_window_name "${started[0]}")
    log "Attaching to tmux session..."
    exec tmux attach -t "$session" \; select-window -t "${session}:${first_window}"
  else
    success "Created ${#started[@]} tmux window(s) in '$(tmux_session_name)'."
  fi
}

cmd_diff() {
  local issue_num="${1:-}"

  if [[ -z "$issue_num" ]]; then
    error "Usage: dispatch diff <issue-number>"
    exit 1
  fi
  issue_num="${issue_num#\#}"
  ensure_dispatch_dir

  if ! is_dispatched "$issue_num"; then
    error "Issue #${issue_num} is not dispatched."
    exit 1
  fi

  local wt_path
  wt_path=$(worktree_path "$issue_num")
  git -C "$wt_path" diff "main..HEAD"
}

cmd_loop() {
  local max_iterations=10
  local timeout_secs=900  # 15 minutes per issue

  # Parse flags
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --max)     max_iterations="$2"; shift 2 ;;
      --timeout) timeout_secs="$2"; shift 2 ;;
      *)         error "Unknown flag: $1"; exit 1 ;;
    esac
  done

  ensure_dispatch_dir

  local iteration=0
  local succeeded=0
  local failed=0
  local skipped=0
  local start_time
  start_time=$(date +%s)

  echo ""
  echo -e "${BOLD}  DISPATCH LOOP${NC}"
  echo -e "  $(printf '─%.0s' {1..50})"
  echo -e "  ${DIM}Max: ${max_iterations} issues  |  Timeout: ${timeout_secs}s each${NC}"
  echo -e "  ${DIM}Picks: Ready + claude label + not blocked${NC}"
  echo ""

  while (( iteration < max_iterations )); do
    # Find next eligible issue
    local next_issue
    next_issue=$(find_next_ready_issue)

    if [[ -z "$next_issue" ]]; then
      log "No more eligible issues in Ready queue."
      break
    fi

    local issue_num="${next_issue%%|*}"
    local issue_title="${next_issue#*|}"

    iteration=$((iteration + 1))

    echo ""
    echo -e "  ${BOLD}[$iteration/$max_iterations]${NC}  ${GREEN}#${issue_num}${NC}  ${issue_title}"
    echo -e "  $(printf '─%.0s' {1..50})"

    # Safety: skip if already dispatched
    if is_dispatched "$issue_num"; then
      warn "Issue #${issue_num} already dispatched — skipping."
      skipped=$((skipped + 1))
      continue
    fi

    # ── Start ──
    log "Setting up worktree..."
    if ! cmd_start "$issue_num" 2>&1 | tail -3; then
      warn "Failed to start #${issue_num} — skipping."
      skipped=$((skipped + 1))
      continue
    fi

    local wt_path
    wt_path=$(worktree_path "$issue_num")
    local log_file="${WORKTREE_DIR}/loop-${issue_num}.log"

    # ── Run Claude (non-interactive) ──
    log "Running Claude (-p mode, timeout: ${timeout_secs}s)..."
    log "  Log → ${DIM}${log_file}${NC}"

    local claude_exit=0
    (
      cd "${wt_path}" || exit 1
      timeout "${timeout_secs}" npx claude -p \
        "You are in a dispatch loop. Work autonomously on your assignment per CLAUDE.local.md.
When done: run pnpm lint, fix errors, run pnpm build, fix errors, then commit all work with conventional commits.
Do NOT create a PR. Do NOT push. Just commit and exit." 2>&1
    ) > "${log_file}" 2>&1 || claude_exit=$?

    # Check if Claude produced commits
    local commit_count
    commit_count=$(git -C "$wt_path" rev-list --count "main..HEAD" 2>/dev/null || echo "0")

    if (( claude_exit != 0 && commit_count == 0 )); then
      warn "Claude failed (exit ${claude_exit}) with no commits."
      loop_park "$issue_num" "Claude failed (exit ${claude_exit}), no commits produced."
      failed=$((failed + 1))
      continue
    fi

    if (( claude_exit != 0 )); then
      warn "Claude exited ${claude_exit} but made ${commit_count} commit(s) — continuing to review."
    else
      success "Claude finished (${commit_count} commits)."
    fi

    # ── Review (lint + build) ──
    log "Reviewing..."
    local lint_ok=true build_ok=true

    (cd "$wt_path" && pnpm lint 2>&1) >> "${log_file}" 2>&1 || lint_ok=false
    if [[ "$lint_ok" == "true" ]]; then
      (cd "$wt_path" && pnpm build 2>&1) >> "${log_file}" 2>&1 || build_ok=false
    fi

    if [[ "$lint_ok" != "true" || "$build_ok" != "true" ]]; then
      local reason=""
      [[ "$lint_ok" != "true" ]] && reason="lint failed"
      [[ "$build_ok" != "true" ]] && reason="${reason:+${reason} + }build failed"
      warn "Review failed: ${reason}"
      loop_park "$issue_num" "Review failed: ${reason}. Log: loop-${issue_num}.log"
      failed=$((failed + 1))
      continue
    fi

    success "Lint + build passed!"

    # ── PR ──
    log "Creating PR..."
    local pr_output
    pr_output=$(cmd_pr "$issue_num" 2>&1) || {
      warn "PR creation failed."
      loop_park "$issue_num" "PR creation failed."
      failed=$((failed + 1))
      continue
    }
    echo "$pr_output" | tail -3

    # ── Cleanup ──
    loop_cleanup "$issue_num"
    succeeded=$((succeeded + 1))
    success "Done with #${issue_num}!"
  done

  # ── Summary ──
  local elapsed=$(( $(date +%s) - start_time ))
  local minutes=$(( elapsed / 60 ))
  local seconds=$(( elapsed % 60 ))

  echo ""
  echo -e "${BOLD}  LOOP COMPLETE${NC}"
  echo -e "  $(printf '─%.0s' {1..50})"
  echo -e "  ${GREEN}✅ Succeeded:${NC}  ${succeeded}"
  echo -e "  ${RED}❌ Failed:${NC}     ${failed}"
  echo -e "  ${YELLOW}⏭  Skipped:${NC}    ${skipped}"
  echo -e "  ${DIM}Total: ${iteration}  |  Time: ${minutes}m ${seconds}s${NC}"
  echo ""

  # Return non-zero if anything failed
  (( failed > 0 )) && return 1
  return 0
}

cmd_qa() {
  local issue_num="${1:-}"

  if [[ -z "$issue_num" ]]; then
    error "Usage: dispatch qa <issue-number>"
    exit 1
  fi
  issue_num="${issue_num#\#}"
  ensure_dispatch_dir

  if ! is_dispatched "$issue_num"; then
    error "Issue #${issue_num} is not dispatched."
    exit 1
  fi

  local wt_path
  wt_path=$(worktree_path "$issue_num")
  local title
  title=$(dispatch_field "$issue_num" "title")
  local port
  port=$(dispatch_field "$issue_num" "port")

  local diff_stat
  diff_stat=$(git -C "$wt_path" diff --stat "main..HEAD" 2>/dev/null)
  local diff_content
  diff_content=$(git -C "$wt_path" diff "main..HEAD" 2>/dev/null)

  if [[ -z "$diff_content" ]]; then
    warn "No changes to QA for issue #${issue_num}."
    exit 0
  fi

  log "Generating QA plan for #${issue_num}: ${BOLD}${title}${NC}"
  echo ""

  echo "$diff_content" | npx claude -p \
    "You are a QA engineer. Generate a focused testing checklist for these code changes.

Context:
- Issue: #${issue_num} — ${title}
- Dev server: http://localhost:${port}

Rules:
- Numbered steps only, no preamble
- Each step: what to do + what to expect
- Cover: happy path, edge cases, regressions
- Be specific about URLs, clicks, and expected UI behavior
- Group by feature area if multiple areas changed

Changed files:
${diff_stat}"
}

cmd_feedback() {
  local issue_num="${1:-}"
  shift 2>/dev/null || true
  local description="$*"

  if [[ -z "$issue_num" || -z "$description" ]]; then
    error "Usage: dispatch feedback <issue-number> <description>"
    echo ""
    echo "  Examples:"
    echo "    dispatch feedback 23 'Date filter shows yesterday instead of today'"
    echo "    dispatch feedback 18 'View button opens in same tab, should be new tab'"
    exit 1
  fi
  issue_num="${issue_num#\#}"

  # Fetch original issue for context
  local issue_json
  issue_json=$(gh issue view "$issue_num" --repo "${REPO}" --json title,labels 2>/dev/null) || {
    error "Issue #${issue_num} not found."
    exit 1
  }

  local original_title
  original_title=$(json_field "$issue_json" "title")

  # Extract feature label if any
  local feature_label
  feature_label=$(echo "$issue_json" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for l in d.get('labels', []):
    if l['name'].startswith('feature:'):
        print(l['name'])
        break
" 2>/dev/null || true)

  # Build labels
  local labels="type:bug,claude"
  if [[ -n "$feature_label" ]]; then
    labels="${labels},${feature_label}"
  fi

  log "Creating feedback issue..."

  local new_issue_url
  new_issue_url=$(gh issue create --repo "${REPO}" \
    --title "Feedback: ${description}" \
    --label "${labels}" \
    --body "$(cat <<FEEDBACK_EOF
## QA Feedback

**Source issue:** #${issue_num} — ${original_title}
**Reported:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Description
${description}

## Context
This issue was discovered during QA of #${issue_num}. It should be picked up by the dispatch loop.
FEEDBACK_EOF
)" 2>&1) || {
    error "Failed to create feedback issue."
    exit 1
  }

  # Add to project board
  local new_issue_num
  new_issue_num=$(echo "$new_issue_url" | grep -oE '[0-9]+$')

  if [[ -n "$new_issue_num" ]]; then
    gh project item-add "${PROJECT_NUMBER}" --owner "${REPO%/*}" \
      --url "https://github.com/${REPO}/issues/${new_issue_num}" 2>/dev/null || true
  fi

  echo ""
  success "Created: ${BOLD}${new_issue_url}${NC}"
  echo -e "  ${DIM}Labels: ${labels}${NC}"
  echo -e "  ${DIM}Added to project board (move to Ready when confirmed)${NC}"
  echo ""
}

cmd_ready() {
  if [[ $# -eq 0 ]]; then
    error "Usage: dispatch ready <issue-#> [issue-#] [issue-#] ..."
    echo ""
    echo "  Moves one or more issues to Ready status on the project board."
    echo "  The loop only picks from Ready, so this is your approval gate."
    exit 1
  fi

  ensure_dispatch_dir
  local moved=0 failed=0

  for arg in "$@"; do
    local issue_num="${arg#\#}"

    # Verify issue exists
    local issue_title
    issue_title=$(gh issue view "$issue_num" --repo "${REPO}" --json title --template '{{.title}}' 2>/dev/null) || {
      warn "Issue #${issue_num} not found — skipping."
      failed=$((failed + 1))
      continue
    }

    # Find item ID on the board
    local item_id
    item_id=$(get_project_item_id "$issue_num")

    if [[ -z "$item_id" ]]; then
      # Issue not on board yet — add it first
      log "Adding #${issue_num} to project board..."
      gh project item-add "${PROJECT_NUMBER}" --owner "${REPO%/*}" \
        --url "https://github.com/${REPO}/issues/${issue_num}" 2>/dev/null || {
        warn "Could not add #${issue_num} to board — skipping."
        failed=$((failed + 1))
        continue
      }
      # Re-fetch item ID
      item_id=$(get_project_item_id "$issue_num")
    fi

    if [[ -z "$item_id" ]]; then
      warn "Could not find #${issue_num} on board after adding — skipping."
      failed=$((failed + 1))
      continue
    fi

    # Move to Ready (option ID from constants block at top of file)
    gh project item-edit --project-id "${PROJECT_ID}" \
      --id "$item_id" \
      --field-id "${STATUS_FIELD_ID}" \
      --single-select-option-id "${STATUS_READY}" 2>/dev/null && {
      success "#${issue_num}  ${issue_title}  → ${BOLD}Ready${NC}"
      moved=$((moved + 1))
    } || {
      warn "Failed to move #${issue_num} — skipping."
      failed=$((failed + 1))
    }
  done

  echo ""
  log "${moved} moved to Ready, ${failed} failed."
  echo ""
}

cmd_help() {
  echo ""
  echo -e "${BOLD}dispatch${NC} — AI-powered development loop manager"
  echo ""
  echo -e "${BOLD}MANUAL WORKFLOW${NC}  (one issue at a time, you drive)"
  echo ""
  echo -e "  ${GREEN}start${NC} <issue-#>     Create a slot: worktree + branch + deps + instructions"
  echo -e "    ${DIM}--tmux${NC}              ...and immediately open it in a tmux window"
  echo -e "  ${GREEN}run${NC} <issue-#>       Launch Claude interactively in the slot"
  echo -e "  ${GREEN}dev${NC} <issue-#>       Start Next.js dev server on the slot's port"
  echo -e "  ${GREEN}review${NC} <issue-#>    Run lint + build, show diff summary"
  echo -e "  ${GREEN}qa${NC} <issue-#>        Generate a QA testing checklist from the diff"
  echo -e "  ${GREEN}pr${NC} <issue-#>        Push branch, create PR, move to In Review"
  echo -e "  ${GREEN}park${NC} <issue-#>      Free the slot, keep the branch (auto-closes tmux window)"
  echo -e "  ${GREEN}cleanup${NC} <issue-#>   Remove worktree, free the slot (auto-closes tmux window)"
  echo ""
  echo -e "${BOLD}TMUX WORKFLOW${NC}  (parallel slots in one terminal session)"
  echo ""
  echo -e "  ${GREEN}tmux${NC} <issue-#>      Open or focus the slot's tmux window (claude + dev panes)"
  echo -e "  ${GREEN}all${NC} <#> [# ...]     Start slots and open them all in tmux, then attach"
  echo -e "    ${DIM}Session = repo name. Window = i<#>. Layout = claude (70%) | dev (30%).${NC}"
  echo ""
  echo -e "${BOLD}AUTOMATED LOOP${NC}  (AFK execution, Claude drives)"
  echo ""
  echo -e "  ${GREEN}ready${NC} <#> [# ...]   Move issue(s) to Ready — the loop's intake queue"
  echo -e "  ${GREEN}loop${NC} [flags]        Auto-pick Ready issues and execute them in sequence"
  echo -e "    ${DIM}--max N${NC}            Max issues to process (default: 10)"
  echo -e "    ${DIM}--timeout N${NC}        Seconds per issue (default: 900)"
  echo -e "  ${GREEN}feedback${NC} <#> <msg>  Create a feedback issue linked to source issue"
  echo ""
  echo -e "${BOLD}DATABASE ISOLATION${NC}  (Neon branch per worktree)"
  echo ""
  echo -e "  ${GREEN}neon-status${NC}         List all wt/* Neon branches"
  echo -e "  ${GREEN}neon-prune${NC}          Delete orphaned Neon branches (not in active slots)"
  echo -e "    ${DIM}Branches auto-created on start, auto-deleted on cleanup.${NC}"
  echo -e "    ${DIM}Park keeps the branch alive for resume. Prune cleans up leftovers.${NC}"
  echo ""
  echo -e "${BOLD}INFO${NC}"
  echo ""
  echo -e "  ${GREEN}status${NC}              Show all active dispatch slots"
  echo -e "  ${GREEN}list${NC}                List open GitHub issues available for dispatch"
  echo -e "  ${GREEN}diff${NC} <issue-#>      Show full git diff for a slot"
  echo -e "  ${GREEN}help${NC}                Show this help"
  echo ""
  echo -e "${BOLD}THE LOOP${NC}  (how it all connects)"
  echo ""
  echo -e "  ${DIM}1. Brainstorm${NC}  →  /brainstorm in Claude session"
  echo -e "  ${DIM}                   Outputs: PRD + grouped GitHub issues (feature:X label)${NC}"
  echo -e "  ${DIM}2. Queue${NC}       →  ${CYAN}dispatch ready 14 15 16${NC}"
  echo -e "  ${DIM}3. Execute${NC}     →  ${CYAN}dispatch loop --max 20${NC}"
  echo -e "  ${DIM}                   Auto: pick → start → claude → lint → build → PR → next${NC}"
  echo -e "  ${DIM}4. QA${NC}          →  ${CYAN}dispatch dev <#>${NC}  +  ${CYAN}dispatch qa <#>${NC}"
  echo -e "  ${DIM}5. Feedback${NC}    →  ${CYAN}dispatch feedback <#> \"description\"${NC}"
  echo -e "  ${DIM}                   Creates new issue → loop picks it up automatically${NC}"
  echo -e "  ${DIM}6. Repeat${NC}      →  Back to step 3"
  echo ""
  echo -e "  ${DIM}Max ${MAX_SLOTS} parallel slots. Worktrees in .worktrees/ (gitignored).${NC}"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    start)    cmd_start "$@" ;;
    run)      cmd_run "$@" ;;
    dev)      cmd_dev "$@" ;;
    tmux|t)   cmd_tmux "$@" ;;
    all)      cmd_all "$@" ;;
    status|s) cmd_status "$@" ;;
    review)   cmd_review "$@" ;;
    diff)     cmd_diff "$@" ;;
    pr)       cmd_pr "$@" ;;
    park)     cmd_park "$@" ;;
    cleanup)  cmd_cleanup "$@" ;;
    ready)    cmd_ready "$@" ;;
    loop)     cmd_loop "$@" ;;
    qa)       cmd_qa "$@" ;;
    feedback) cmd_feedback "$@" ;;
    neon-status) neon_list_branches ;;
    neon-prune)  neon_prune_branches ;;
    list|ls)  cmd_list "$@" ;;
    help|-h)  cmd_help "$@" ;;
    *)
      error "Unknown command: $cmd"
      cmd_help
      exit 1
      ;;
  esac
}

main "$@"
