#!/usr/bin/env bash
# Entry point of the GitHub Action. Everything arrives through environment variables
# (never interpolated into the script) so user supplied inputs cannot inject commands.
set -euo pipefail

action_dir="${GITHUB_ACTION_PATH:?GITHUB_ACTION_PATH is not set}"
out="${GW_OUTPUT_DIR:-gitwrapped}"
message="${GW_COMMIT_MESSAGE:-Update Git Wrapped cards}"

fail() {
  echo "::error::$1" >&2
  exit 1
}

set_output() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$1=$2" >> "$GITHUB_OUTPUT"
  fi
}

# The cards are written into the repository, so the target must stay inside it.
case "$out" in
  /* | *..*) fail "output-dir must be a relative path inside the repository." ;;
esac

if [ "$(node -p 'Boolean(process.features.typescript)')" != "true" ]; then
  fail "Node.js 22.18 or newer is required (found $(node --version))."
fi

args=(--theme both --name '{card}' --out "$out")
if [ -n "${GW_YEAR:-}" ]; then
  args+=(--year "$GW_YEAR")
fi
if [ -n "${GW_CARDS:-}" ]; then
  args+=(--card "$GW_CARDS")
fi
if [ -n "${GW_TZ:-}" ]; then
  args+=("--tz=$GW_TZ")
fi
if [ "${GW_DEMO:-false}" = "true" ]; then
  args+=(--demo)
else
  [ -n "${GW_USERNAME:-}" ] || fail "username is required."
  # "--" makes sure a username can never be read as an option.
  args+=(-- "$GW_USERNAME")
fi

node "$action_dir/src/bin.ts" "${args[@]}"

if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  if [ "${GW_COMMIT:-true}" = "true" ]; then
    fail "No git repository found. Add actions/checkout before this action, or set commit: false."
  fi
  set_output changed unknown
  exit 0
fi

if [ -z "$(git status --porcelain -- "$out")" ]; then
  echo "Cards are already up to date."
  set_output changed false
  exit 0
fi

set_output changed true

if [ "${GW_COMMIT:-true}" != "true" ]; then
  echo "Cards changed, not committing because commit is false."
  exit 0
fi

git add -- "$out"
git -c user.name="github-actions[bot]" \
  -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
  commit -q -m "$message"
git push
echo "Committed updated cards to $out."
