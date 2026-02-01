#!/command/with-contenv bashio
# shellcheck shell=bash
main() {
  bashio::log.trace "${FUNCNAME[0]}"

  pushd /var/www/opodsync || exit 1
    php83 -S 0.0.0.0:8099 -t server server/index.php
  popd || exit 1
}
main "$@"
