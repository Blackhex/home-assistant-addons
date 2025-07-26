#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SNAPSHOT_DIR="${SCRIPT_DIR}/ha-snapshot"
SNAPSHOT_TAR="${SNAPSHOT_DIR}/devcontainer.tar"
SNAPSHOT_SLUG_FILE="${SNAPSHOT_DIR}/devcontainer.slug"
SUPERVISOR_BACKUP_DIR="/mnt/supervisor/backup"
ONBOARDING_MARKER="/mnt/supervisor/homeassistant/.storage/onboarding"
BACKUP_NAME="devcontainer-baseline"
BACKUP_FILENAME="devcontainer.tar"

log() { echo "[ha-snapshot] $*"; }

is_configured() {
  sudo test -f "${ONBOARDING_MARKER}" 2>/dev/null &&
    sudo grep -q '"user"' "${ONBOARDING_MARKER}" 2>/dev/null
}

wait_for_supervisor() {
  local tries="${1:-150}"
  log "Waiting for the Supervisor to be responsive..."
  local i
  for ((i = 0; i < tries; i++)); do
    if ha core info >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

capture() {
  if ! wait_for_supervisor 30; then
    log "ERROR: Supervisor is not responsive; start it first."
    exit 1
  fi

  mkdir -p "${SNAPSHOT_DIR}"
  log "Creating Home Assistant Core backup '${BACKUP_NAME}'..."

  local response
  if ! response="$(ha backups new \
    --name "${BACKUP_NAME}" \
    --filename "${BACKUP_FILENAME}" \
    --folders homeassistant \
    --homeassistant-exclude-database \
    --no-progress --raw-json)" || [ -z "${response}" ]; then
    log "ERROR: 'ha backups new' failed."
    exit 1
  fi

  local slug
  slug="$(printf '%s' "${response}" | jq -r '.data.slug // empty')"
  if [ -z "${slug}" ]; then
    log "ERROR: could not parse backup slug from: ${response}"
    exit 1
  fi

  if [ ! -f "${SUPERVISOR_BACKUP_DIR}/${BACKUP_FILENAME}" ]; then
    log "ERROR: expected backup ${SUPERVISOR_BACKUP_DIR}/${BACKUP_FILENAME} not found."
    exit 1
  fi

  cp "${SUPERVISOR_BACKUP_DIR}/${BACKUP_FILENAME}" "${SNAPSHOT_TAR}"
  printf '%s\n' "${slug}" >"${SNAPSHOT_SLUG_FILE}"

  log "Saved snapshot ${SNAPSHOT_TAR} (slug ${slug}, $(du -h "${SNAPSHOT_TAR}" | cut -f1))."
  log "Commit .devcontainer/ha-snapshot/ to keep this baseline across rebuilds."
}

restore() {
  if [ ! -f "${SNAPSHOT_TAR}" ]; then
    log "No snapshot at ${SNAPSHOT_TAR}; nothing to restore."
    return 0
  fi
  if is_configured; then
    log "Home Assistant is already configured; skipping restore."
    return 0
  fi

  if ! wait_for_supervisor 150; then
    log "ERROR: Supervisor did not become ready; skipping restore."
    return 0
  fi

  if is_configured; then
    log "Home Assistant became configured; skipping restore."
    return 0
  fi

  log "Fresh Home Assistant detected; restoring baseline..."
  sudo mkdir -p "${SUPERVISOR_BACKUP_DIR}"
  sudo cp "${SNAPSHOT_TAR}" "${SUPERVISOR_BACKUP_DIR}/${BACKUP_FILENAME}"
  ha backups reload >/dev/null 2>&1

  local slug=""
  if [ -f "${SNAPSHOT_SLUG_FILE}" ]; then
    slug="$(tr -d '[:space:]' <"${SNAPSHOT_SLUG_FILE}")"
  fi
  if [ -z "${slug}" ]; then
    slug="$(ha backups --raw-json 2>/dev/null |
      jq -r --arg n "${BACKUP_NAME}" '.data.backups[] | select(.name == $n) | .slug' | head -n1)"
  fi
  if [ -z "${slug}" ] || [ "${slug}" = "null" ]; then
    log "ERROR: could not resolve backup slug; aborting restore."
    return 0
  fi

  log "Restoring backup ${slug} (this can take a few minutes)..."
  if ha backups restore "${slug}" --folders homeassistant --no-progress; then
    log "Restore complete."
  else
    log "ERROR: restore failed; continuing startup."
  fi
}

main() {
  case "${1:-}" in
  capture) capture ;;
  restore) restore ;;
  *)
    echo "Usage: ${0##*/} {capture|restore}" >&2
    exit 2
    ;;
  esac
}

main "$@"
