#!/command/with-contenv bashio
# shellcheck shell=bash
main() {
  bashio::log.trace "${FUNCNAME[0]}"

  git clone https://github.com/kd2org/opodsync.git /var/www/opodsync
}
main "$@"
