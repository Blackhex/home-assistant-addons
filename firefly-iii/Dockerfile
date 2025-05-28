FROM fireflyiii/base:latest

# Set S6 wait time
ENV S6_CMD_WAIT_FOR_SERVICES=1 \
    S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0 \
    S6_SERVICES_GRACETIME=0

USER root
COPY rootfs/ /

RUN if [ ! -f /bin/sh ] && [ -f /usr/bin/sh ]; then ln -s /usr/bin/sh /bin/sh; fi && \
    if [ ! -f /bin/bash ] && [ -f /usr/bin/bash ]; then ln -s /usr/bin/bash /bin/bash; fi

# Download Firefly III
USER www-data
ENV DOWNLOAD_URL="https://github.com/firefly-iii/firefly-iii/releases/download/v6.2.16/FireflyIII-v6.2.16.zip"
RUN curl -s -o /var/www/download.zip -A "Mozilla/5.0" -sSL $DOWNLOAD_URL

# Extract Firefly III and make sure the relevant paths have the necessary access rights.
RUN unzip -q /var/www/download.zip -d $FIREFLY_III_PATH && \
    chmod -R 775 $FIREFLY_III_PATH/storage && \
    rm /var/www/download.zip

# Change upload folder to "ha_upload" since the default one is binded to a volume (see base image).
USER root
RUN sed -i "s/'root'   => storage_path('upload'),/'root'   => storage_path('ha_upload'),/g" /var/www/html/config/filesystems.php

USER root
COPY scripts/* /usr/local/bin/

# Automatic modules
ARG MODULES="00-banner.sh 01-custom_script.sh 00-global_var.sh 01-config_yaml.sh"
RUN /usr/local/bin/ha_automodules.sh "$MODULES"

# Automatic apps
ENV PACKAGES="cron mariadb-client sudo"
RUN /usr/local/bin/ha_autoapps.sh "$PACKAGES"

# Upstream entrypoint script
RUN chmod uga+x /usr/local/bin/entrypoint.sh

# Entrypoint modifications
RUN /usr/local/bin/ha_entrypoint_modif.sh

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN \
    # Run as www-data
    sed -i "s|/usr|exec sudo -Eu www-data /usr|g" /etc/s6*/s6*/php-fpm/run && \
    # Move execute things
    mkdir -p /scripts && \
    mv /etc/entrypoint.d/11-execute-things.sh /scripts/ && \
    # Allow passwordless root
    echo "www-data ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers && \
    # Change output lots
    sed -i "s|/proc/self/fd/2|/log_php|g" /etc/entrypoint.d/1-log-output-level.sh && \
    grep -rl "/proc/self/fd/2" /usr/local/etc | while read -r files; do sed -i "s|/proc/self/fd/2|/log_php|g" "$files"; done && \
    touch /log_php && chown www-data:www-data /log_php && \
    # Adapt files
    for files in /etc/cont-init.d/*; do sed -i "s|/usr/bin/with-contenv bashio|/usr/bin/env bashio|g" "$files"; done

ARG BUILD_ARCH
ARG BUILD_DATE
ARG BUILD_DESCRIPTION
ARG BUILD_NAME
ARG BUILD_REF
ARG BUILD_REPOSITORY
ARG BUILD_VERSION
ENV BUILD_VERSION="${BUILD_VERSION}"
LABEL \
  io.hass.name="${BUILD_NAME}" \
  io.hass.description="${BUILD_DESCRIPTION}" \
  io.hass.arch="${BUILD_ARCH}" \
  io.hass.type="addon" \
  io.hass.version=${BUILD_VERSION} \
  maintainer="Radek Bartoň <blackhex@post.cz>" \
  org.opencontainers.image.title="${BUILD_NAME}" \
  org.opencontainers.image.description="${BUILD_DESCRIPTION}" \
  org.opencontainers.image.vendor="Blackhex" \
  org.opencontainers.image.authors="Radek Bartoň <blackhex@post.cz>" \
  org.opencontainers.image.licenses="MIT" \
  org.opencontainers.image.url="https://github.com/Blackhex/home-assistant-addons" \
  org.opencontainers.image.source="https://github.com/${BUILD_REPOSITORY}" \
  org.opencontainers.image.documentation="https://github.com/${BUILD_REPOSITORY}/blob/main/README.md" \
  org.opencontainers.image.created=${BUILD_DATE} \
  org.opencontainers.image.revision=${BUILD_REF} \
  org.opencontainers.image.version=${BUILD_VERSION}

RUN \
    # Handle Apache configuration
    if [ -d /etc/apache2/sites-available ]; then \
        for file in /etc/apache2/sites-*/*.conf; do \
            sed -i '/<VirtualHost/a \ \n    # Match requests with the custom User-Agent "HealthCheck" \n    SetEnvIf User-Agent "HealthCheck" dontlog \n    # Exclude matching requests from access logs \n    CustomLog ${APACHE_LOG_DIR}/access.log combined env=!dontlog' "$file"; \
        done; \
    fi && \
    \
    # Handle Nginx configuration
    if [ -f /etc/nginx/nginx.conf ]; then \
        awk '/http \{/{print; print "map $http_user_agent $dontlog {\n  default 0;\n  \"~*HealthCheck\" 1;\n}\naccess_log /var/log/nginx/access.log combined if=$dontlog;"; next}1' /etc/nginx/nginx.conf > /etc/nginx/nginx.conf.new && \
        mv /etc/nginx/nginx.conf.new /etc/nginx/nginx.conf; \
    fi

# Healthcheck
ENV HEALTH_PORT="8080" \
    HEALTH_URL="/health"
HEALTHCHECK \
    --interval=5s \
    --retries=5 \
    --start-period=30s \
    --timeout=25s \
    CMD curl -A "HealthCheck: Docker/1.0" -s -f "http://127.0.0.1:${HEALTH_PORT}${HEALTH_URL}" &>/dev/null || exit 1