#!/command/with-contenv bashio
# shellcheck shell=bash
main() {
  bashio::log.trace "${FUNCNAME[0]}"

  local repo_dir="/config/fdroid"
  local interval=3600

  bashio::log.info "Starting F-Droid index updater (interval: ${interval}s)."

  while true; do
    sleep "${interval}"
    bashio::log.info "Running scheduled fdroid update."
    pushd "${repo_dir}" || exit 1
      fdroid update --create-metadata --delete-unknown 2>>/config/error.log || \
        bashio::log.warning "fdroid update completed with warnings — check /config/error.log."
    popd || exit 1
  done
}
main "$@"
