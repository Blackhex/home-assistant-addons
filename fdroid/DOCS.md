# F-Droid Add-on Documentation

## Overview

This add-on runs an [F-Droid](https://f-droid.org/) repository server, letting you host your own Android app store on Home Assistant.

## Setup

1. After starting the add-on, a new F-Droid repository is initialised at `/config/fdroid/` (inside the add-on config volume).
2. In the add-on **Configuration** tab, set the repository name (`repo_name`) and, to make the repository standalone (not shown as a mirror), the repository URL (`repo_url`, e.g. `http://<home-assistant-ip>:8085`). These are applied on every start. For other settings (signing key details, description), edit `/config/fdroid/config.yml`.
3. Drop your `.apk` files into `/config/fdroid/repo/`.
4. The index is built automatically on startup and refreshed every hour.

## Accessing the repository

The repository is served over HTTP on port **8085** (configurable). Point your F-Droid client to:

```text
http://<home-assistant-ip>:8085/repo
```

## Configuration

The repository configuration lives entirely in `/config/fdroid/config.yml`. Refer to the [fdroidserver documentation](https://f-droid.org/docs/Setup_an_F-Droid_App_Repo) for all available options.

## Notes

- A signing key is generated automatically on first install and stored in `/config/fdroid/keystore.p12`. Its password is shown in the add-on log on first start; set it as the **`keystore_password`** option (Configuration tab) to control it. To reuse an existing key after a reinstall, restore `keystore.p12` and set `keystore_password` to its password. **Back up the keystore and its password** — losing them means you cannot push updates to existing clients.
- The repository URL embedded in the index defaults to fdroidserver's placeholder, so clients show the repo as a *mirror* of it. Set the **`repo_url`** option to the URL clients use (e.g. `http://<home-assistant-ip>:8085`) to make the repository standalone.
- `android-tools` (adb, etc.) is included in the image and is required by fdroidserver for APK metadata extraction.
