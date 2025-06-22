#!/usr/bin/with-contenv bashio

echo "Starting Addon Template..."

echo "Clonning $REPO_URL repository..."

mkdir -p /var/www
pushd /var/www
  git clone --depth 1 "$REPO_URL"
popd
