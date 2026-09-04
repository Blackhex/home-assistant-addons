#!/command/with-contenv bashio
# shellcheck shell=bash

has_oauth_token() {
  grep -Eq 'gho_[[:alnum:]_]+' "${COPILOT_HOME}/config.json" 2>/dev/null
}

main() {
  bashio::log.trace "${FUNCNAME[0]}"
  unset SUPERVISOR_TOKEN

  local context
  local model
  local mode
  local reasoning_effort
  local session_action
  local session_id
  local -a copilot_args

  context="${ADDON_COPILOT_CONTEXT:-default}"
  model="${ADDON_COPILOT_MODEL:-auto}"
  mode="${ADDON_COPILOT_MODE:-interactive}"
  reasoning_effort="${ADDON_COPILOT_REASONING_EFFORT:-default}"
  session_action="${1:-}"
  session_id="${2:-}"

  copilot_args=(
    --no-auto-update
    --model "${model}"
    --mode "${mode}"
    --context "${context}"
  )

  if [[ "${reasoning_effort}" != "default" ]]; then
    copilot_args+=(--effort "${reasoning_effort}")
  fi

  if [[ -n "${session_action}" || -n "${session_id}" ]]; then
    if [[ ! "${session_id}" =~ ^[[:xdigit:]]{8}-[[:xdigit:]]{4}-[1-5][[:xdigit:]]{3}-[89abAB][[:xdigit:]]{3}-[[:xdigit:]]{12}$ ]]; then
      bashio::log.error "Invalid Copilot session identifier."
      exit 1
    fi

    case "${session_action}" in
      new)
        copilot_args+=(--session-id "${session_id}")
        ;;
      resume)
        copilot_args+=(--resume="${session_id}")
        ;;
      *)
        bashio::log.error "Invalid Copilot session action."
        exit 1
        ;;
    esac
  fi

  pushd "${WORKSPACE}" >/dev/null || exit 1

  if bashio::config.has_value 'github_token'; then
    export COPILOT_GITHUB_TOKEN
    COPILOT_GITHUB_TOKEN="$(bashio::config 'github_token')"
    bashio::log.info "Using the configured GitHub token."
  elif ! has_oauth_token; then
    bashio::log.info "Authenticate Copilot with GitHub."
    bashio::log.info "Open the displayed URL in your browser and enter the one-time code."

    copilot login --device-code || {
      bashio::log.error "Copilot OAuth authentication did not complete. Reopen the web interface to try again."
      exit 1
    }
  fi

  bashio::log.info \
    "Starting Copilot with model ${model}, mode ${mode}," \
    "context ${context}, and thinking level ${reasoning_effort}."

  exec copilot "${copilot_args[@]}"
}
main "$@"