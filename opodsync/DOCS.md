# A minimalist GPodder server, using the same API, for self-hosting

oPodSync is a lightweight, self-hosted podcast synchronization server that
implements the [GPodder API][gpodder-api]. It lets you keep your podcast
subscriptions and episode playback positions in sync across all your devices
without relying on a third-party cloud service.

It is compatible with GPodder API clients such as
[AntennaPod](https://antennapod.org/) (Android) and
[gPodder](https://gpodder.github.io/) (desktop), so you can switch between
devices and pick up listening right where you left off.

## Installation

1. Click the Home Assistant My button below to open the app on your Home
   Assistant instance.

   [![Open this app in your Home Assistant instance.][addon-badge]][addon]

1. Click the "Install" button to install the app.
1. Start the "oPodSync" app.

## Configuration

The log files (`error.log` and `debug.log` in the add-on configuration
directory) are rotated automatically once they grow past 10M, keeping 5
compressed copies.

## Usage

1. Open the add-on's web interface (via Ingress or the configured port).
1. Create a user account and log in.
1. In your podcast client, add a new GPodder/Nextcloud sync account pointing to
   this server's address and your credentials.
1. Your subscriptions and episode playback positions will now sync through
   oPodSync.

[addon]: https://my.home-assistant.io/redirect/supervisor_addon/?addon=local_opodsync
[addon-badge]: https://my.home-assistant.io/badges/supervisor_addon.svg
[gpodder-api]: https://gpoddernet.readthedocs.io/en/latest/api/
