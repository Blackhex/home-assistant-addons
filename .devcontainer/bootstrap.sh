#!/usr/bin/env bash

set -e

echo "Setting up local add-ons for development..."

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_NAME="$(basename "${REPO_ROOT}")"
SUPERVISOR_CONTAINER="hassio_supervisor"
CLI_CONTAINER="hassio_cli"
SUPERVISOR_ADDONS_ROOT="/data/addons/local"
SUPERVISOR_REPO_ROOT="${SUPERVISOR_ADDONS_ROOT}/${REPO_NAME}"

# Wait for Supervisor to be running before attempting mounts.
for _ in {1..30}; do
  if docker inspect -f '{{.State.Status}}' "${SUPERVISOR_CONTAINER}" 2>/dev/null | grep -q '^running$'; then
    break
  fi
  sleep 1
done

if ! docker inspect -f '{{.State.Status}}' "${SUPERVISOR_CONTAINER}" 2>/dev/null | grep -q '^running$'; then
	echo "Supervisor container '${SUPERVISOR_CONTAINER}' is not running; skipping add-on mount setup."
	exit 0
fi

mapfile -t addon_dirs < <(
  find "${REPO_ROOT}" -mindepth 1 -maxdepth 1 -type d \
    -not -name '.git' \
    -not -name '.github' \
    -not -name '.devcontainer' \
    -not -name 'local' \
    -not -name 'template' \
    -exec test -f '{}/config.yaml' ';' \
    -exec basename '{}' ';'
)

if [ ${#addon_dirs[@]} -eq 0 ]; then
  echo "No add-on directories found in ${REPO_ROOT}; nothing to mount."
  exit 0
fi

for addon in "${addon_dirs[@]}"; do
  source_path="${SUPERVISOR_REPO_ROOT}/${addon}"
  target_path="${SUPERVISOR_ADDONS_ROOT}/${addon}"

  echo "Setting up ${addon} add-on..."

  docker exec "${SUPERVISOR_CONTAINER}" rm -f "${target_path}" 2>/dev/null || true

  docker exec --privileged "${SUPERVISOR_CONTAINER}" sh -c "
    mkdir -p '${target_path}' &&
    mount --bind '${source_path}' '${target_path}' &&
    echo '${addon} bind mount created successfully'
  " || echo "Warning: Could not create ${addon} bind mount. Trying symlink..."

  if ! docker exec "${SUPERVISOR_CONTAINER}" mountpoint -q "${target_path}" 2>/dev/null; then
    echo "${addon} bind mount failed, using symlink fallback..."
    docker exec "${SUPERVISOR_CONTAINER}" ln -snf "${REPO_NAME}/${addon}" "${target_path}"
  fi
done

echo "Waiting for Home Assistant CLI (${CLI_CONTAINER}) to be ready..."
cli_ready=false
for _ in {1..60}; do
  if docker inspect -f '{{.State.Status}}' "${CLI_CONTAINER}" 2>/dev/null | grep -q '^running$'; then
    cli_ready=true
    break
  fi
  sleep 1
done

if [ "${cli_ready}" != true ]; then
  echo "Warning: '${CLI_CONTAINER}' container not ready; skipping add-on store reload."
else
  echo "Reloading add-on store..."
  reloaded=false
  for _ in {1..5}; do
    if ha store reload; then
      reloaded=true
      break
    fi
    echo "Add-on store reload failed; retrying in 3s..."
    sleep 3
  done
  if [ "${reloaded}" != true ]; then
    echo "Warning: add-on store reload did not succeed; continuing anyway."
  fi
fi

echo "Done! Mounted add-ons: ${addon_dirs[*]}"
