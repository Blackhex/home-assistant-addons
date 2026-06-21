#!/command/with-contenv bashio
# shellcheck shell=bash

set_config_value() {
  local file="$1" key="$2" value="$3" escaped
  escaped=${value//\'/\'\'}
  sed -i -e "/^${key}:/d" -e "/^#[[:space:]]*${key}:/d" "${file}"
  printf "%s: '%s'\n" "${key}" "${escaped}" >>"${file}"
}

configure_signing_key() {
  local repo_dir="$1" had_keystore="$2"
  local config="${repo_dir}/config.yml"
  local keystore="${repo_dir}/keystore.p12"

  if bashio::config.has_value 'keystore_password'; then
    local password
    password="$(bashio::config 'keystore_password')"

    if [ "${had_keystore}" = "true" ]; then
      local keyalias
      keyalias="$(keytool -list -storetype PKCS12 -keystore "${keystore}" \
        -storepass "${password}" 2>/dev/null | awk -F, '/PrivateKeyEntry/ {print $1; exit}')"
      if [ -n "${keyalias}" ]; then
        set_config_value "${config}" repo_keyalias "${keyalias}"
      else
        bashio::log.warning "Could not read the restored keystore — is 'keystore_password' correct?"
      fi
    else
      local generated
      generated="$(sed -n 's/^keystorepass:[[:space:]]*//p' "${config}" | head -1)"
      keytool -storepasswd -storetype PKCS12 -keystore "${keystore}" \
        -storepass "${generated}" -new "${password}" 2>/dev/null ||
        bashio::log.warning "Could not apply the configured keystore password to the new key."
    fi

    set_config_value "${config}" keystorepass "${password}"
    set_config_value "${config}" keypass "${password}"
    bashio::log.info "Applied the configured signing key password."
  elif [ "${had_keystore}" = "true" ]; then
    bashio::log.error "A keystore was restored but 'keystore_password' is not set; signing will fail until it is configured."
  else
    local generated
    generated="$(sed -n 's/^keystorepass:[[:space:]]*//p' "${config}" | head -1)"
    bashio::log.warning "Generated a new repository signing key."
    bashio::log.warning "Keystore password: ${generated}"
    bashio::log.warning "Save it (set 'keystore_password' in the add-on options) and back up ${keystore}."
  fi
}

main() {
  bashio::log.trace "${FUNCNAME[0]}"

  local repo_dir="/config/fdroid"
  local config="${repo_dir}/config.yml"

  : >/config/error.log

  mkdir -p "${ANDROID_HOME}" /opt/android-sdk/cmdline-tools

  if [ ! -f "${config}" ]; then
    bashio::log.info "Initializing new F-Droid repository in /config/fdroid."
    mkdir -p "${repo_dir}"

    local had_keystore="false"
    [ -f "${repo_dir}/keystore.p12" ] && had_keystore="true"

    pushd "${repo_dir}" || exit 1
      fdroid init --no-prompt --android-home "${ANDROID_HOME}" || \
        bashio::log.error "fdroid init failed — check the Android SDK installation."
    popd || exit 1

    configure_signing_key "${repo_dir}" "${had_keystore}"
    bashio::log.info "F-Droid repository initialized."
  else
    bashio::log.info "Using existing F-Droid repository at /config/fdroid."
  fi

  if [ ! -f "${repo_dir}/icon.png" ]; then
    bashio::log.info "Seeding default repository icon."
    cp /defaults/icon.png "${repo_dir}/icon.png"
  fi

  if bashio::config.has_value 'repo_name'; then
    bashio::log.info "Setting repository name to $(bashio::config 'repo_name')."
    set_config_value "${config}" repo_name "$(bashio::config 'repo_name')"
  fi

  if bashio::config.has_value 'repo_url'; then
    bashio::log.info "Setting repository URL to $(bashio::config 'repo_url')."
    set_config_value "${config}" repo_url "$(bashio::config 'repo_url')"
  fi

  bashio::log.info "Running fdroid update to build repository index."
  pushd "${repo_dir}" || exit 1
    fdroid update --create-metadata --delete-unknown 2>>/config/error.log || \
      bashio::log.warning "fdroid update completed with warnings — check /config/error.log."
  popd || exit 1
}
main "$@"
