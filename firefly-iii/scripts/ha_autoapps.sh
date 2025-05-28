#!/bin/sh
# shellcheck disable=SC2015
set -e

PACKAGES="$1"
echo "To install : $PACKAGES"

# Install bash if needed
if ! command -v bash >/dev/null 2>/dev/null; then
    (apt-get update && apt-get install -yqq --no-install-recommends bash || apk add --no-cache bash) >/dev/null
fi

# Install curl if needed
if ! command -v curl >/dev/null 2>/dev/null; then
    (apt-get update && apt-get install -yqq --no-install-recommends curl || apk add --no-cache curl) >/dev/null
fi

# Call apps installer script if needed
eval /usr/local/bin/ha_automatic_packages.sh "${PACKAGES:-}"
