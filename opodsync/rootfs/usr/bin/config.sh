#!/command/with-contenv bashio
# shellcheck shell=bash
main() {
  bashio::log.trace "${FUNCNAME[0]}"

  if [ ! -f /config/config.php ]; then
    cp /defaults/config.php /config/config.php
  fi

  pushd /var/www/opodsync || exit
    mkdir -p server/data
    cp /config/config.php server/data/config.local.php
  popd || exit
}
main "$@"
