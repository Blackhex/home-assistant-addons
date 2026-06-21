ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.1
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set addon name and port
ENV NAME="F-Droid"
ENV PORT=8085
ENV ANDROID_HOME="/opt/android-sdk"
ENV PATH="${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools"

# Copy root filesystem
COPY rootfs /

# Setup base
RUN apk add --no-cache \
  android-tools \
  git \
  logrotate \
  openjdk17-jdk \
  py3-pip \
  python3 \
  && pip3 install --no-cache-dir --break-system-packages fdroidserver

RUN mkdir -p /opt/android-sdk/cmdline-tools \
  && wget -qO /tmp/android-commandlinetools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
  && unzip -q /tmp/android-commandlinetools.zip -d /opt/android-sdk/cmdline-tools \
  && mv /opt/android-sdk/cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest \
  && rm -f /tmp/android-commandlinetools.zip \
  && mkdir -p /opt/android-sdk/licenses \
  && printf '%s\n' \
    '8933bad161af4178b1185d1a37fbf41ea5269c55' \
    'd56f5187479451eabf01fb78af6dfcb131a6481e' \
    '24333f8a63b6825ea9c5514f83c2829b004d1fee' > /opt/android-sdk/licenses/android-sdk-license \
  && printf '%s\n' '84831b9409646a918e30573bab4c9c91346d8abd' > /opt/android-sdk/licenses/android-sdk-preview-license \
  && /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android-sdk "platform-tools" "build-tools;34.0.0" >/dev/null

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
