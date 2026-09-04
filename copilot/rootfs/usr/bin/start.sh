#!/command/with-contenv bashio
# shellcheck shell=bash

has_oauth_token() {
  grep -Eq 'gho_[[:alnum:]_]+' "${COPILOT_HOME}/config.json" 2>/dev/null
}

main() {
  bashio::log.trace "${FUNCNAME[0]}"

  if ! bashio::config.has_value 'github_token' && ! has_oauth_token; then
    bashio::log.info "No GitHub credential found. Starting the authentication setup."
    export COPILOT_AUTH_REQUIRED="true"
  else
    bashio::log.info "Starting the Copilot session launcher on port ${PORT}."
    export COPILOT_AUTH_REQUIRED="false"
  fi

  exec node /usr/bin/setup-server.js
}
main "$@"