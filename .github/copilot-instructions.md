# Project Guidelines

Home Assistant add-ons repository maintained by Blackhex. Add-ons are built on the [Home Assistant base image](https://github.com/hassio-addons/addon-base) and orchestrated with **s6-overlay**. The `template/` folder is a scaffold for new add-ons.

## Architecture

Each add-on is a multi-arch container defined by:

- `config.yaml` — add-on manifest (slug, ports, ingress, `map`, version).
- `Dockerfile` — installs packages, sets `ENV` (`NAME`, `REPO`, `BRANCH`, `PORT`), copies `rootfs/`.
- `rootfs/` — files overlaid onto the container filesystem.

Startup uses **s6-overlay services** under `rootfs/etc/s6-overlay/s6-rc.d/`. Addon's flow:

```
base → clone (oneshot) → config (oneshot) → start (longrun) → logrotate + logs (longrun)
```

- **oneshot** services run once and exit (init tasks like cloning the repo, writing config).
- **longrun** services run supervised (the PHP server, log rotation, log tailing).
- Each service dir has a `type` file (`oneshot`/`longrun`), a `run` script, optional `up`/`finish`,
  and `dependencies.d/<name>` empty files declaring ordering.
- The `user` bundle's `contents.d/` lists which services start.
- Service `run` scripts stay thin and `exec /usr/bin/<name>.sh`; real logic lives in `rootfs/usr/bin/`.

## Conventions

**Shell scripts** (`rootfs/usr/bin/*.sh` and s6 `run`/`finish`):

- Shebang `#!/command/with-contenv bashio` followed by `# shellcheck shell=bash`.
- Wrap logic in a `main()` function ending with `main "$@"`; start it with `bashio::log.trace "${FUNCNAME[0]}"`.
- Log via `bashio::log.{trace,info,warning,error}` — do not use raw `echo` for status.
- No global `set -e`; guard critical commands inline with `|| exit 1` (e.g. `pushd … || exit 1`).
- Reference Dockerfile env vars (`${NAME}`, `${REPO}`, `${BRANCH}`, `${PORT}`); use `${NAME,,}` for the lowercase app dir.
- `service run` scripts end in `exec /usr/bin/<name>.sh` so the script replaces PID 1.

**Naming:** services kebab-case, scripts snake_case (`logrotate.sh`), env vars SCREAMING_SNAKE_CASE, add-on slug lowercase.

**Paths:** `/var/www/${NAME,,}` (app), `/config` (persistent user data via `addon_config` map),
`/defaults` (default config seeded into `/config` if absent).

## Build and Test

No app build step; the add-on clones its source at container start (`clone.sh`). Validate quality with the
linters the workspace recommends — run before committing:

- `shellcheck` for shell scripts.
- `hadolint` for Dockerfiles.
- `yamllint` (see `.yamllint`) — requires `---` start, 2-space indent, no trailing whitespace.
- `markdownlint` / `.mdlrc` for Markdown.

Editor is configured for format-on-save with Prettier; keep edits consistent with that.
