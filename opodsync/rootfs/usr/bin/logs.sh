#!/command/with-contenv bashio
# shellcheck shell=bash
main() {
  LOGS="/config/error.log /config/debug.log"

  for LOG in $LOGS; do
    touch "$LOG"
  done

  tail -f $LOGS 2>&1
}
main "$@"
