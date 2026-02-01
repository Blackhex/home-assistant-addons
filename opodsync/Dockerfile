ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.1
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Copy root filesystem
COPY rootfs /

# Setup base
RUN apk add --no-cache \
  git \
  php83 \
  php83-ctype \
  php83-opcache \
  php83-session \
  php83-sqlite3

# TODO: HEALTHCHECK
#HEALTHCHECK \
#    --start-period=15m \
#    --interval=60s \
#    --timeout=30s \
#    CMD curl \

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
