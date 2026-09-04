ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.1
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

ARG COPILOT_VERSION=1.0.80

ENV NAME="Copilot CLI" \
    PORT=7681 \
    HOME="/config" \
    COPILOT_HOME="/config/copilot" \
    COPILOT_CACHE_HOME="/config/copilot/cache" \
    COPILOT_AUTO_UPDATE="false" \
    WORKSPACE="/config/workspace"

# Copy root filesystem
COPY rootfs /

# Install the web terminal and Copilot CLI
# hadolint ignore=DL3018
RUN chmod 0755 \
    /etc/s6-overlay/s6-rc.d/init/run \
    /etc/s6-overlay/s6-rc.d/start/finish \
    /etc/s6-overlay/s6-rc.d/start/run \
    /usr/bin/copilot.sh \
    /usr/bin/init.sh \
    /usr/bin/start.sh \
    && apk add --no-cache \
      git \
      nodejs \
      npm \
      openssh-client-default \
      ripgrep \
      ttyd \
            util-linux-misc \
    && npm install --global "@github/copilot@${COPILOT_VERSION}" \
    && npm cache clean --force

# Build arguments
ARG BUILD_ARCH
ARG BUILD_DATE
ARG BUILD_DESCRIPTION
ARG BUILD_NAME
ARG BUILD_REF
ARG BUILD_REPOSITORY
ARG BUILD_VERSION

# Labels
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