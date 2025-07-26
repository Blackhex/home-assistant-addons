#!/usr/bin/env bash
set -uo pipefail

slug="${1:?Usage: ${0##*/} <app-slug>}"

echo "Uninstalling ${slug} add-on in Supervisor..."
ha apps uninstall "${slug}"
