#!/bin/bash
#
# SYNC-FLEET-LOCAL.SH
# Syncs all fleet apps in ~/new-code/template-apps/ against the local template.
# Runs apps in parallel (default: 4 concurrent workers) with live progress.
#
# Usage:
#   bash scripts/sync-fleet-local.sh                       # full parallel sync
#   bash scripts/sync-fleet-local.sh --dry-run             # preview changes
#   bash scripts/sync-fleet-local.sh --skip-quality        # skip quality gate per app
#   bash scripts/sync-fleet-local.sh --auto-commit         # auto-commit after each app
#   bash scripts/sync-fleet-local.sh --jobs 8              # 8 parallel workers
#   bash scripts/sync-fleet-local.sh --apps "tide-check,flashcard-pro"
#   bash scripts/sync-fleet-local.sh --sequential          # disable parallelism
#
# Uses --from to sync the layer directly from the local template directory.
# No need to push to GitHub first. Safe to Ctrl+C — all workers are killed cleanly.

set -uo pipefail

APPS_DIR="$HOME/new-code/template-apps"
TEMPLATE_DIR="$HOME/new-code/narduk-ai"

DRY_RUN=""
SKIP_QUALITY=""
AUTO_COMMIT=""
FILTER_APPS=""
MAX_JOBS=4
ALLOW_DIRTY_TEMPLATE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)      DRY_RUN="--dry-run"; shift ;;
    --skip-quality) SKIP_QUALITY="1"; shift ;;
    --auto-commit)  AUTO_COMMIT="1"; shift ;;
    --apps)         FILTER_APPS="$2"; shift 2 ;;
    --jobs)         MAX_JOBS="$2"; shift 2 ;;
    --sequential)   MAX_JOBS=1; shift ;;
    --allow-dirty-template) ALLOW_DIRTY_TEMPLATE="1"; shift ;;
    --)             shift; break ;;
    *)              echo "Unknown option: $1"; exit 1 ;;
  esac
done

cd "$TEMPLATE_DIR" || exit 1
if [ -z "$ALLOW_DIRTY_TEMPLATE" ] && [ -n "$(git status --porcelain)" ]; then
  echo "❌ Template repository has uncommitted changes."
  echo "   Please commit or stash your changes before syncing the fleet."
  echo "   Or run with --allow-dirty-template to sync anyway (e.g. fleet parallel workers)."
  exit 1
fi

TEMPLATE_SHA=$(git rev-parse --short HEAD)
LOG_DIR=$(mktemp -d)
RESULT_DIR=$(mktemp -d)
PROGRESS_FILE="$LOG_DIR/_progress.log"
touch "$PROGRESS_FILE"

WORKER_PIDS=()

cleanup() {
  # Kill all worker processes and their children
  for pid in "${WORKER_PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      pkill -TERM -P "$pid" 2>/dev/null || true
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  # Kill the progress tailer
  [ -n "${TAIL_PID:-}" ] && kill "$TAIL_PID" 2>/dev/null || true
  wait 2>/dev/null
  rm -rf "$LOG_DIR" "$RESULT_DIR"
}

trap cleanup INT TERM
trap 'rm -rf "$LOG_DIR" "$RESULT_DIR"' EXIT

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Fleet Sync — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "║  Template SHA: $TEMPLATE_SHA"
echo "║  Source: $TEMPLATE_DIR (local)"
echo "║  Parallelism: $MAX_JOBS concurrent workers"
[ -n "$DRY_RUN" ]      && echo "║  Mode: DRY RUN"
[ -n "$SKIP_QUALITY" ] && echo "║  Quality gate: SKIPPED"
[ -n "$AUTO_COMMIT" ]  && echo "║  Auto-commit: ON"
[ -n "$FILTER_APPS" ]  && echo "║  Filter: $FILTER_APPS"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Build the list of apps to sync
APP_LIST=()
for app_path in "$APPS_DIR"/*; do
  [ ! -d "$app_path" ] && continue
  app_name=$(basename "$app_path")

  if [ -n "$FILTER_APPS" ]; then
    echo ",$FILTER_APPS," | grep -q ",$app_name," || continue
  fi

  if [ ! -d "$app_path/.git" ]; then
    echo "⏭  $app_name — not a git repo, skipping"
    echo "$app_name" >> "$RESULT_DIR/skipped"
    continue
  fi

  APP_LIST+=("$app_name")
done

TOTAL=${#APP_LIST[@]}
if [ "$TOTAL" -eq 0 ]; then
  echo "No apps to sync."
  exit 0
fi

echo "📋 $TOTAL apps queued: ${APP_LIST[*]}"
echo ""

START_TIME=$(date +%s)

# Background tailer — streams progress to terminal in real-time
tail -f "$PROGRESS_FILE" &
TAIL_PID=$!

# Worker function — runs in a subshell per app
sync_one_app() {
  local app_name="$1"
  local app_path="$APPS_DIR/$app_name"
  local log_file="$LOG_DIR/$app_name.log"
  local app_start
  app_start=$(date +%s)

  # Atomic append to shared progress file (short lines are atomic under PIPE_BUF)
  progress() { echo "$1" >> "$PROGRESS_FILE"; }

  progress "  ▶  $app_name — started"

  {
    echo "━━━ $app_name ━━━"
    echo "  Started: $(date -u +%H:%M:%S)"
    echo ""

    # Phase 1: Sync template config files
    progress "     $app_name — syncing config..."
    cd "$TEMPLATE_DIR"
    if ! npx tsx tools/sync-template.ts "$app_path" $DRY_RUN --allow-dirty-template 2>&1; then
      echo ""
      echo "❌ sync-template FAILED"
      local fail_end
      fail_end=$(date +%s)
      progress "  ❌ $app_name — sync-template FAILED ($(( fail_end - app_start ))s)"
      echo "$app_name" >> "$RESULT_DIR/failed"
      return 1
    fi

    # Phase 2: Update layer from local template
    progress "     $app_name — updating layer..."
    cd "$app_path"
    local update_args="--from $TEMPLATE_DIR"
    [ -n "$DRY_RUN" ]      && update_args="$update_args --dry-run"
    [ -n "$SKIP_QUALITY" ] && update_args="$update_args --skip-quality"

    if ! npx tsx tools/update-layer.ts $update_args 2>&1; then
      echo ""
      echo "❌ update-layer FAILED"
      local fail_end
      fail_end=$(date +%s)
      progress "  ❌ $app_name — update-layer FAILED ($(( fail_end - app_start ))s)"
      echo "$app_name" >> "$RESULT_DIR/failed"
      return 1
    fi

    # Phase 3: Auto-commit
    if [ -n "$AUTO_COMMIT" ] && [ -z "$DRY_RUN" ]; then
      cd "$app_path"
      if [ -n "$(git status --porcelain)" ]; then
        progress "     $app_name — committing..."
        git add -A
        git commit -m "chore: sync with template $TEMPLATE_SHA" --no-verify 2>&1 || true
        echo "  ✅ Committed"
      else
        echo "  ⏭ No changes to commit"
      fi
    fi

    local app_end
    app_end=$(date +%s)
    local duration=$(( app_end - app_start ))
    echo ""
    echo "  Done in ${duration}s"
    progress "  ✅ $app_name — done (${duration}s)"
    echo "$app_name" >> "$RESULT_DIR/succeeded"

  } > "$log_file" 2>&1
}

# Launch workers with throttling
RUNNING=0

for app_name in "${APP_LIST[@]}"; do
  sync_one_app "$app_name" &
  WORKER_PIDS+=($!)
  RUNNING=$((RUNNING + 1))

  # Throttle: wait for a slot when at max capacity
  while [ "$RUNNING" -ge "$MAX_JOBS" ]; do
    wait -n 2>/dev/null || true
    RUNNING=$((RUNNING - 1))
  done
done

# Wait for all remaining workers
for pid in "${WORKER_PIDS[@]}"; do
  wait "$pid" 2>/dev/null || true
done

# Stop the progress tailer
sleep 0.3
kill "$TAIL_PID" 2>/dev/null || true
wait "$TAIL_PID" 2>/dev/null || true

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

# Collect results
SUCCEEDED_APPS=()
FAILED_APPS=()
SKIPPED_APPS=()

[ -f "$RESULT_DIR/succeeded" ] && mapfile -t SUCCEEDED_APPS < "$RESULT_DIR/succeeded"
[ -f "$RESULT_DIR/failed" ]    && mapfile -t FAILED_APPS < "$RESULT_DIR/failed"
[ -f "$RESULT_DIR/skipped" ]   && mapfile -t SKIPPED_APPS < "$RESULT_DIR/skipped"

# Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Fleet Sync Complete — ${TOTAL_DURATION}s total (${MAX_JOBS}x parallel)"
echo "║  ✅ Succeeded: ${#SUCCEEDED_APPS[@]} / $TOTAL"
if [ ${#FAILED_APPS[@]} -gt 0 ]; then
  echo "║  ❌ Failed: ${#FAILED_APPS[@]} — ${FAILED_APPS[*]}"
fi
if [ ${#SKIPPED_APPS[@]} -gt 0 ]; then
  echo "║  ⏭  Skipped: ${#SKIPPED_APPS[@]} — ${SKIPPED_APPS[*]}"
fi
echo "╚══════════════════════════════════════════════════════════════╝"

# Print failed app logs prominently
if [ ${#FAILED_APPS[@]} -gt 0 ]; then
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  FAILED APP LOGS (last 40 lines each)"
  echo "═══════════════════════════════════════════════════════════════"
  for app_name in "${FAILED_APPS[@]}"; do
    log_file="$LOG_DIR/$app_name.log"
    echo ""
    echo "━━━ $app_name ━━━"
    if [ -f "$log_file" ]; then
      tail -40 "$log_file"
    fi
  done
  echo ""
  echo "Full logs preserved at: $LOG_DIR/"
  # Don't clean up log dir on failure so user can inspect
  trap - EXIT
  exit 1
fi
