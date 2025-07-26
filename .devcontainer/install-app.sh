#!/usr/bin/env bash
set -uo pipefail

slug="${1:?Usage: ${0##*/} <app-slug>}"

echo "Installing ${slug} add-on in Supervisor..."
docker exec -t hassio_cli ha apps install "${slug}"
