ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:stable
FROM $BUILD_FROM

RUN \
  apk --no-cache add \
    nginx \
    php84 \
    php84-fpm && \
  mkdir -p /run/nginx
COPY rootfs/ /
