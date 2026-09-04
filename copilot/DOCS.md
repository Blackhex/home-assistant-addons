# Copilot CLI Add-on Documentation

## Overview

This add-on hosts [GitHub Copilot CLI](https://github.com/github/copilot-cli) in
a browser terminal protected by Home Assistant Ingress. Copilot runs as an
interactive coding agent with its persistent workspace at `/config/workspace`.

An active GitHub Copilot subscription is required.

## Setup

1. Start the add-on and open its web interface.
2. Select **Sign in with GitHub**. Copilot CLI requests a short-lived device
  authorization code and the add-on displays it in the setup screen.
3. Select **Open GitHub**, sign in with the account that has your Copilot
  subscription, enter the displayed code, and authorize **GitHub Copilot CLI**.
  The setup screen attempts to copy the code when it opens GitHub.
4. Return to Home Assistant. The add-on detects approval, stores the OAuth
  credential, restarts, and opens the Copilot terminal automatically.
5. On the first launch, review Copilot's folder-trust prompt for
   `/config/workspace`.

GitHub sign-in and approval happen on GitHub.com. The add-on never receives your
GitHub password or browser session. Copilot CLI polls GitHub for approval and
stores the resulting OAuth credential in `/config/copilot`.
GitHub does not provide a supported device-authorization URL that pre-fills the
code, so it must be entered on GitHub's page.

As a manual fallback, expand **Use a personal access token instead** in the
setup screen. Create a fine-grained token owned by your personal account with
the **Copilot Requests** permission, then paste it into the masked field.

## Sessions

After authentication, the app web UI opens a session launcher instead of
starting Copilot immediately:

- Select **New session** to start a fresh conversation with a new session ID.
- Select a row in **Sessions** to resume that conversation.
- Select the **×** button on a session row and confirm to permanently remove it.
- All persisted sessions are listed by title, update time, turn count, and
  branch when available. Unnamed sessions use their session ID prefix.

The session toolbar remains available above the terminal. Starting or resuming
another session closes the currently attached terminal before opening the
selection, preventing two processes from writing to the same session. Session
history persists under `/config/copilot` and remains available after restarts.
The active session cannot be deleted until its terminal is closed.

## Settings

Open **Settings** from the session toolbar to manage model defaults and Copilot
extensions. Changes apply when a new Copilot terminal session starts.

### Model

- **Model** selects the model for new sessions. Keep `auto` to let Copilot
  choose, or enter a model ID supported by your account, such as `gpt-5.4`.
- **Mode** sets the initial agent mode to `interactive`, `plan`, or `autopilot`.
- **Context** uses the model's default context window or requests the extended
  `long_context` tier.
- **Reasoning effort** uses the model default or requests a supported fixed
  level from `none` through `max`.

The model settings are persisted in `/config/copilot/addon-settings.json` and
can be edited directly from the app without restarting the add-on. Existing
values from older add-on options are migrated when this file is first created.

### Skills

Add a skill from an HTTPS `SKILL.md` URL or a local file or directory under the
add-on configuration volume. Copilot materializes URL and file skills under
`/config/copilot/skills`. Built-in and plugin-provided skills are listed but
cannot be removed independently.

### Plugins

Install a plugin using a marketplace reference such as
`plugin@copilot-plugins`, a GitHub repository such as `owner/repo`, a repository
subdirectory, or an HTTPS Git URL. Installed plugins and their bundled skills,
agents, hooks, and servers persist under `/config/copilot`.

### MCP servers

Add local `stdio` servers or remote HTTP/SSE servers. Local servers support a
command, argument list, environment variables, tool filters, and a timeout.
Remote servers support a URL, request headers, tool filters, and a timeout.
Copilot stores these definitions in `/config/copilot/mcp-config.json`; secret
environment and header values are masked when configurations are listed.

### Home Assistant configuration

#### `github_token`

An optional fine-grained token used instead of OAuth. The field is masked in
Home Assistant. Leave it empty to use the guided device authorization flow or a
previously saved OAuth login. A configured token takes precedence over OAuth.

## Workspace and persistence

- Copilot starts in `/config/workspace`. Clone repositories there or create
  files directly from the agent.
- Copilot settings, sessions, and OAuth credentials are stored in
  `/config/copilot`.
- Git and SSH user files are stored under `/config` because it is the add-on
  user's home directory.
- Everything under `/config` persists across restarts and is included in add-on
  backups.

The image pins the Copilot CLI version and disables its self-updater. Update or
rebuild the add-on to install a newer CLI release.

## Security

- The terminal is available only through Home Assistant Ingress; no
  unauthenticated host port is published.
- The setup screen can update this add-on's own options and restart the add-on
  through the Supervisor API. It does not receive access to Home Assistant data.
- Copilot can execute commands and modify any file in the add-on's `/config`
  volume. Review its tool permission requests before approving them.
- The configured GitHub token is stored in the add-on options and included in
  backups. Keep backups private and revoke the token if it is exposed.
- A headless container has no operating-system keychain. Copilot therefore
  asks to use its plaintext fallback. The setup server accepts that prompt and
  stores the OAuth token in `/config/copilot/config.json`. Keep add-on backups
  private. Use `/logout` and revoke the **GitHub Copilot CLI** authorization in
  GitHub settings if a backup or token is exposed.
