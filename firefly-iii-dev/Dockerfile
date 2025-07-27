ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:stable
FROM ${BUILD_FROM}

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

USER root
RUN \
  apk add --no-cache \
    git \
    nginx \
    npm \
    php84 \
    php84-bcmath \
    php84-curl \
    php84-dom \
    php84-fileinfo \
    php84-fpm \
    php84-iconv \
    php84-intl \
    php84-mbstring \
    php84-openssl \
    php84-pdo \
    php84-pdo_sqlite \
    php84-phar \
    php84-session \
    php84-simplexml \
    php84-sodium \
    php84-sqlite3 \
    php84-tokenizer \
    php84-xml \
    php84-xmlwriter \
    sqlite && \
  ln -sf /usr/bin/php84 /usr/bin/php && \
  wget https://getcomposer.org/download/2.8.10/composer.phar  && \
  chmod +x composer.phar && \
  mv composer.phar /usr/bin/composer && \
  rm -fr \
    /tmp/* \
    /etc/nginx

COPY rootfs /

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
