#!/usr/bin/with-contenv bashio

if [[ ! -d firefly-iii ]]; then
    echo "Cloning Firefly III repository..."
    git clone --depth 1 https://github.com/Blackhex/firefly-iii.git
    cd firefly-iii || exit
else
    echo "Updating Firefly III repository..."
    cd firefly-iii || exit
    git clean -fdx
    git reset --hard HEAD
    git pull
fi

echo "Starting Nginx..."
nginx -c /etc/nginx/nginx.conf
