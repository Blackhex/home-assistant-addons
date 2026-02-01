#!/command/with-contenv bashio
# shellcheck shell=bash
main() {
  bashio::log.trace "${FUNCNAME[0]}"

  local size count interval config state

  size="10M"
  count=5
  interval=3600
  config="/tmp/logrotate.conf"
  state="/config/logrotate.status"

  cat > "${config}" <<EOF
/config/error.log /config/debug.log {
    size ${size}
    rotate ${count}
    missingok
    notifempty
    copytruncate
    compress
    delaycompress
}
EOF

  bashio::log.info \
    "Rotating logs every ${interval}s (size: ${size}, keep: ${count})."

  while true; do
    logrotate --state "${state}" "${config}"
    sleep "${interval}"
  done
}
main "$@"
