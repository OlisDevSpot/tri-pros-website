#!/usr/bin/env bash
# Claude Code PreToolUse hook (Bash). A `git commit` or `git -C <dir> commit`
# is gated by tsc, lint and theme:check in the checkout it commits to, so a
# lane is judged by its own code rather than by whatever the main checkout holds.
set -uo pipefail

input="$(cat)"
field() { printf '%s' "$input" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(String($1??''))" 2>/dev/null; }
cmd="$(field 'j.tool_input?.command')"
cwd="$(field 'j.cwd')"

block() {
  node -e "process.stdout.write(JSON.stringify({decision:'block',reason:process.argv[1]}))" "$1"
  exit 0
}

case "$cmd" in
  'git commit'*) dir="$cwd" ;;
  'git -C '*' commit'*)
    dir="$(printf '%s' "$cmd" | sed -E "s/^git -C ('([^']*)'|\"([^\"]*)\"|([^ ]+)) commit.*/\2\3\4/")"
    [[ "$dir" = /* ]] || dir="$cwd/$dir"
    ;;
  *) exit 0 ;;
esac

top="$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)" || exit 0

if [[ ! -d "$top/node_modules" ]]; then
  block "Pre-commit gate: $top has no node_modules. Run 'pnpm install --frozen-lockfile' there, then commit again."
fi

cd "$top" || exit 0
if ! out="$(pnpm tsc 2>&1 && pnpm lint 2>&1 && pnpm run --if-present theme:check 2>&1)"; then
  block "Pre-commit gate in $top: tsc, lint or theme:check failed. Fix the errors before committing.
$(printf '%s' "$out" | tail -n 20)"
fi
exit 0
