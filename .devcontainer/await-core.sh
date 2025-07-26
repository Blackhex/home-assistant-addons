#!/usr/bin/env bash
set -uo pipefail

url="http://localhost:8123"

echo "Waiting for Home Assistant Core (${url})..."
for _ in $(seq 1 90); do
  curl -sf -o /dev/null --max-time 2 "${url}" && exit 0
  sleep 2
done
