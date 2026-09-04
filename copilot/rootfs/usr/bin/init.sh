#!/command/with-contenv bashio
# shellcheck shell=bash

main() {
  bashio::log.trace "${FUNCNAME[0]}"

  local addon_options
  addon_options="$(bashio::addon.options)"

  if bashio::jq.exists "${addon_options}" '.github_host'; then
    bashio::log.info "Removing the obsolete github_host option."
    bashio::addon.option 'github_host'
  fi

  mkdir -p "${COPILOT_HOME}" "${COPILOT_CACHE_HOME}" "${WORKSPACE}" "${HOME}/.ssh"
  chmod 0700 "${COPILOT_HOME}" "${HOME}/.ssh"

  bashio::log.info "Using ${WORKSPACE} as the Copilot workspace."
  bashio::log.info "Copilot configuration and OAuth credentials persist in ${COPILOT_HOME}."
}
main "$@"