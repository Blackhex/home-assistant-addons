ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM $BUILD_FROM

ENV LANG=C.UTF-8
ARG REPO_URL
ENV REPO_URL=$REPO_URL

LABEL \
    io.hass.name="Addon Template" \
    io.hass.description="A template for Home Assistant addons." \
    io.hass.version="dev" \
    io.hass.type="addon"

COPY rootfs /

# Install requirements for add-on
RUN \
  apk add --no-cache \
    git

CMD [ "/init" ]
