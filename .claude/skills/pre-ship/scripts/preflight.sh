#!/usr/bin/env bash
# Read-only facts about what a push of local main would ship. Changes nothing.
# Usage: bash .claude/skills/pre-ship/scripts/preflight.sh [base=origin/main] [head=main]
set -uo pipefail
BASE=${1:-origin/main}
HEAD_REF=${2:-main}
cd "$(git rev-parse --show-toplevel)" || exit 1
git fetch origin -q

section() { printf '\n== %s\n' "$1"; }

section "Range $BASE..$HEAD_REF"
echo "ahead: $(git rev-list --count "$BASE..$HEAD_REF")  behind: $(git rev-list --count "$HEAD_REF..$BASE")"
git diff --shortstat "$BASE..$HEAD_REF"
echo "merges in range:"; git log --merges --oneline "$BASE..$HEAD_REF" | sed 's/^/  /'

section "Staged index (must be empty before committing anything)"
git diff --cached --stat | tail -1
[ -z "$(git diff --cached --name-only)" ] && echo "  clean"

section "Working tree"
git status --short

section "Commits by scope (oldest first)"
git log --reverse --no-merges --format='%h %s' "$BASE..$HEAD_REF" \
  | sed -E 's/^([0-9a-f]+) ([a-z]+)(\(([^)]*)\))?!?:.*/\4/' | sort | uniq -c | sort -rn

section "Files by area"
git diff --name-only "$BASE..$HEAD_REF" | awk -F/ '{ if ($1=="src") print $2"/"$3; else print $1 }' \
  | sort | uniq -c | sort -rn | head -40

section "DB schema / migrations (non-empty = db:push:prod must land BEFORE the push)"
git diff --stat "$BASE..$HEAD_REF" -- src/shared/db drizzle | tail -3

section "Config (next/vercel/middleware/env schema)"
git diff --stat "$BASE..$HEAD_REF" -- 'next.config.*' vercel.json 'middleware.ts' 'src/middleware.ts' src/shared/config | tail -5

section "Env vars read for the first time in the range"
git diff "$BASE..$HEAD_REF" -- src | grep -E '^\+' | grep -oE 'process\.env\.[A-Z_0-9]+' | sort -u > /tmp/preship-new.$$
git diff "$BASE..$HEAD_REF" -- src | grep -E '^-' | grep -oE 'process\.env\.[A-Z_0-9]+' | sort -u > /tmp/preship-old.$$
comm -23 /tmp/preship-new.$$ /tmp/preship-old.$$ | sed 's/^/  /'; rm -f /tmp/preship-new.$$ /tmp/preship-old.$$

section "Dependencies"
git diff "$BASE..$HEAD_REF" -- package.json | grep -E '^[+-] ' | sed 's/^/  /'

section "Added lines that look like secrets"
git diff "$BASE..$HEAD_REF" | grep -E '^\+' \
  | grep -nE 'sk_live|sk-[A-Za-z0-9]{20}|AKIA[0-9A-Z]{16}|postgres(ql)?://[^ ]*:[^ ]*@|-----BEGIN [A-Z ]*PRIVATE KEY' | head

section "Added console.log/debug, TODO/FIXME in src"
git diff "$BASE..$HEAD_REF" -- src | grep -E '^\+' | grep -nE 'console\.(log|debug)|TODO|FIXME|XXX|HACK|debugger' | head

section "Local-timezone formatting added in src (Vercel runs in UTC)"
git diff "$BASE..$HEAD_REF" -- src | grep -E '^\+' \
  | grep -nE 'toLocale(Date|Time)?String\(|new Intl\.DateTimeFormat\(|\b(isToday|isSameDay|getHours|getDate)\(' \
  | grep -v timeZone | head -15
