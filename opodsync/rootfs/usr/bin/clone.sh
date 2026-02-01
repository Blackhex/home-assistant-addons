#!/command/with-contenv bashio
# shellcheck shell=bash
main() {
  bashio::log.trace "${FUNCNAME[0]}"

  bashio::log.info "Cloning ${NAME} from branch ${BRANCH} of ${REPO}."

  git clone "${REPO}" -b "${BRANCH}" /var/www/${NAME,,}
}
main "$@"
