# Home Assistant add-ons by Blackhex

Home Assistant add-ons maintained by Blackhex.

## Installation

[![Add repository to Home Assistant][repository-badge]][repository]

Alternatively, add this repository URL manually in Home Assistant:

`https://github.com/Blackhex/home-assistant-addons`

## Add-ons

### [oPodSync](opodsync/DOCS.md)

oPodSync is a lightweight, self-hosted podcast synchronization server that
implements the GPodder API. It synchronizes podcast subscriptions and episode
playback positions across devices, and works with clients such as AntennaPod
and gPodder. Access it through Home Assistant Ingress or its configured port.

### [F-Droid](fdroid/DOCS.md)

F-Droid hosts a private Android app repository from Home Assistant. Add APK
files to the persistent add-on configuration directory; the repository index
is built at startup and refreshed every hour. It serves clients over a
configurable HTTP port and generates a persistent signing key on first use.

[repository-badge]: https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg
[repository]: https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FBlackhex%2Fhome-assistant-addons
