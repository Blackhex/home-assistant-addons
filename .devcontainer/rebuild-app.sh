#!/usr/bin/env bash
set -uo pipefail

slug="${1:?Usage: ${0##*/} <app-slug>}"

echo "Rebuilding ${slug} add-on in Supervisor..."
docker exec -t hassio_cli ha apps rebuild "${slug}"
