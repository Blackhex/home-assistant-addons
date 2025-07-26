#!/usr/bin/env bash
set -uo pipefail

slug="${1:?Usage: ${0##*/} <app-slug>}"

echo "Starting ${slug} add-on in Supervisor..."
ha app start "${slug}"
