#!/command/with-contenv bashio
# shellcheck shell=bash
main() {
  bashio::log.trace "${FUNCNAME[0]}"

  bashio::log.info "Starting ${NAME} server on port ${PORT}."

  pushd /var/www/${NAME,,} || exit 1
    php83 -S "0.0.0.0:${PORT}" -t server server/index.php
  popd || exit 1
}
main "$@"
