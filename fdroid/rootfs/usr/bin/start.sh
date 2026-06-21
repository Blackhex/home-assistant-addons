#!/command/with-contenv bashio
# shellcheck shell=bash
main() {
  bashio::log.trace "${FUNCNAME[0]}"

  local webroot="/var/www"
  mkdir -p "${webroot}"
  ln -sfn /config/fdroid/repo "${webroot}/repo"

  bashio::log.info "Starting ${NAME} HTTP server on port ${PORT}."

  exec python3 -m http.server "${PORT}" \
    --directory "${webroot}" 2>>/config/error.log
}
main "$@"
