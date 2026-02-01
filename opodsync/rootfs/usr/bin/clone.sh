#!/command/with-contenv bashio
# shellcheck shell=bash
main() {
  bashio::log.trace "${FUNCNAME[0]}"

  git clone https://github.com/kd2org/opodsync.git /var/www/opodsync

  pushd /var/www/opodsync || exit
    mkdir -p server/data
    cp /etc/opodsync/config.php server/data/config.local.php
  popd || exit
}
main "$@"
