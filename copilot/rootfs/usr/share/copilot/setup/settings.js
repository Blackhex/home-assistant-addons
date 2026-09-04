"use strict";

const cancelRemoveButton = document.querySelector("#cancel-remove");
const confirmRemoveButton = document.querySelector("#confirm-remove");
const contextInput = document.querySelector("#context");
const mcpArgumentsInput = document.querySelector("#mcp-arguments");
const mcpCommandInput = document.querySelector("#mcp-command");
const mcpCount = document.querySelector("#mcp-count");
const mcpDisclosure = document.querySelector("#mcp-disclosure");
const mcpEmpty = document.querySelector("#mcp-empty");
const mcpEnvironmentInput = document.querySelector("#mcp-environment");
const mcpForm = document.querySelector("#mcp-form");
const mcpHeadersInput = document.querySelector("#mcp-headers");
const mcpList = document.querySelector("#mcp-list");
const mcpNameInput = document.querySelector("#mcp-name");
const mcpStatus = document.querySelector("#mcp-status");
const mcpTimeoutInput = document.querySelector("#mcp-timeout");
const mcpToolsInput = document.querySelector("#mcp-tools");
const mcpUrlInput = document.querySelector("#mcp-url");
const modeInput = document.querySelector("#mode");
const modelForm = document.querySelector("#model-form");
const modelInput = document.querySelector("#model");
const modelStatus = document.querySelector("#model-status");
const pluginCount = document.querySelector("#plugins-count");
const pluginEmpty = document.querySelector("#plugins-empty");
const pluginForm = document.querySelector("#plugin-form");
const pluginList = document.querySelector("#plugins-list");
const pluginSourceInput = document.querySelector("#plugin-source");
const pluginStatus = document.querySelector("#plugin-status");
const reasoningEffortInput = document.querySelector("#reasoning-effort");
const removeDialog = document.querySelector("#remove-dialog");
const removeDialogMessage = document.querySelector("#remove-dialog-message");
const settingsLoadState = document.querySelector("#settings-load-state");
const skillCount = document.querySelector("#skills-count");
const skillEmpty = document.querySelector("#skills-empty");
const skillForm = document.querySelector("#skill-form");
const skillList = document.querySelector("#skills-list");
const skillSourceInput = document.querySelector("#skill-source");
const skillStatus = document.querySelector("#skill-status");

let csrfToken = "";
let pendingRemoval;

function setMessage(element, message, state = "") {
  element.textContent = message;
  element.dataset.state = state;
}

function setBusy(busy) {
  for (const control of document.querySelectorAll(
    ".settings-main input, .settings-main select, .settings-main textarea, .settings-main button",
  )) {
    control.disabled = busy;
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Copilot-Setup-Token": csrfToken,
      ...options.headers,
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "The request could not be completed.");
  }

  return data;
}

function post(path, body) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function sourceLabel(source) {
  if (!source) {
    return "User";
  }

  return source
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function createRemoveButton(label, removal) {
  const button = document.createElement("button");
  button.className = "setting-remove";
  button.type = "button";
  button.textContent = "×";
  button.setAttribute("aria-label", `Remove ${label}`);
  button.title = `Remove ${label}`;
  button.addEventListener("click", () => openRemoveDialog(label, removal));
  return button;
}

function createSettingRow(name, metadata, removal) {
  const row = document.createElement("div");
  row.className = "setting-row";

  const copy = document.createElement("div");
  copy.className = "setting-row-copy";

  const title = document.createElement("strong");
  title.textContent = name;
  copy.append(title);

  if (metadata) {
    const detail = document.createElement("span");
    detail.textContent = metadata;
    copy.append(detail);
  }

  row.append(copy);
  if (removal) {
    row.append(createRemoveButton(name, removal));
  }
  return row;
}

function renderSkills(skills) {
  skillList.replaceChildren();

  for (const skill of skills) {
    const protectedSources = new Set(["builtin", "plugin", "organization"]);
    const removal = protectedSources.has(skill.source)
      ? undefined
      : {
        endpoint: "./api/settings/skills/remove",
        payload: {
          name:
              skill.source === "custom" && skill.path
                ? skill.path
                : skill.name,
        },
        type: "skill",
      };
    const metadata = [sourceLabel(skill.source), skill.description]
      .filter(Boolean)
      .join(" · ");
    skillList.append(createSettingRow(skill.name, metadata, removal));
  }

  skillCount.textContent = `${skills.length}`;
  skillEmpty.hidden = skills.length !== 0;
  skillList.hidden = skills.length === 0;
}

function renderPlugins(plugins) {
  pluginList.replaceChildren();

  for (const plugin of plugins) {
    pluginList.append(
      createSettingRow(plugin.name, "Installed", {
        endpoint: "./api/settings/plugins/uninstall",
        payload: { name: plugin.name },
        type: "plugin",
      }),
    );
  }

  pluginCount.textContent = `${plugins.length}`;
  pluginEmpty.hidden = plugins.length !== 0;
  pluginList.hidden = plugins.length === 0;
}

function safeRemoteTarget(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "Remote endpoint";
  }
}

function mcpMetadata(server) {
  const transport = String(server.type || "stdio").toUpperCase();
  const target = server.url
    ? safeRemoteTarget(server.url)
    : server.command || "Local command";
  const status = server.enabled === false ? "Disabled" : "Enabled";
  return `${transport} · ${target} · ${status}`;
}

function renderMcpServers(servers) {
  const entries = Object.entries(servers);
  mcpList.replaceChildren();

  for (const [name, server] of entries) {
    const removal =
      !server.source || server.source === "user"
        ? {
          endpoint: "./api/settings/mcp/remove",
          payload: { name },
          type: "MCP server",
        }
        : undefined;
    mcpList.append(createSettingRow(name, mcpMetadata(server), removal));
  }

  mcpCount.textContent = `${entries.length}`;
  mcpEmpty.hidden = entries.length !== 0;
  mcpList.hidden = entries.length === 0;
}

function renderModel(model) {
  modelInput.value = model.model;
  modeInput.value = model.mode;
  contextInput.value = model.context;
  reasoningEffortInput.value = model.reasoning_effort;
}

function renderSettings(settings) {
  renderModel(settings.model);
  renderSkills(Array.isArray(settings.skills) ? settings.skills : []);
  renderPlugins(Array.isArray(settings.plugins) ? settings.plugins : []);
  renderMcpServers(settings.mcp_servers || {});
}

function lineValues(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function mutateExtensions(endpoint, payload, status, pending, complete) {
  setBusy(true);
  setMessage(status, pending, "pending");

  try {
    const settings = await post(endpoint, payload);
    renderSettings(settings);
    setMessage(status, complete, "success");
    return true;
  } catch (error) {
    setMessage(status, error.message, "error");
    return false;
  } finally {
    setBusy(false);
  }
}

function selectedTransport() {
  return mcpForm.querySelector('input[name="transport"]:checked').value;
}

function updateTransportFields() {
  const local = selectedTransport() === "stdio";
  document.querySelector('[data-transport-panel="stdio"]').hidden = !local;
  document.querySelector('[data-transport-panel="remote"]').hidden = local;
  mcpCommandInput.required = local;
  mcpUrlInput.required = !local;
}

function resetMcpForm() {
  mcpForm.reset();
  mcpToolsInput.value = "*";
  updateTransportFields();
  mcpDisclosure.open = false;
}

function openRemoveDialog(label, removal) {
  pendingRemoval = removal;
  removeDialogMessage.textContent = `Remove “${label}”?`;
  removeDialog.showModal();
}

function closeRemoveDialog() {
  pendingRemoval = undefined;
  removeDialog.close();
}

modelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(true);
  setMessage(modelStatus, "Saving...", "pending");

  try {
    const data = await post("./api/settings/model", {
      model: modelInput.value,
      mode: modeInput.value,
      context: contextInput.value,
      reasoning_effort: reasoningEffortInput.value,
    });
    renderModel(data.model);
    setMessage(modelStatus, "Saved for new sessions.", "success");
  } catch (error) {
    setMessage(modelStatus, error.message, "error");
  } finally {
    setBusy(false);
  }
});

skillForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const added = await mutateExtensions(
    "./api/settings/skills/add",
    { source: skillSourceInput.value },
    skillStatus,
    "Adding skill...",
    "Skill added.",
  );
  if (added) {
    skillForm.reset();
  }
});

pluginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const installed = await mutateExtensions(
    "./api/settings/plugins/install",
    { source: pluginSourceInput.value },
    pluginStatus,
    "Installing plugin...",
    "Plugin installed.",
  );
  if (installed) {
    pluginForm.reset();
  }
});

mcpForm.addEventListener("change", (event) => {
  if (event.target.name === "transport") {
    updateTransportFields();
  }
});

mcpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const transport = selectedTransport();
  const added = await mutateExtensions(
    "./api/settings/mcp/add",
    {
      name: mcpNameInput.value,
      transport,
      command: mcpCommandInput.value,
      arguments: lineValues(mcpArgumentsInput.value),
      environment: lineValues(mcpEnvironmentInput.value),
      url: mcpUrlInput.value,
      headers: lineValues(mcpHeadersInput.value),
      tools: mcpToolsInput.value,
      timeout: mcpTimeoutInput.value,
    },
    mcpStatus,
    "Adding MCP server...",
    "MCP server added.",
  );
  if (added) {
    resetMcpForm();
  }
});

cancelRemoveButton.addEventListener("click", closeRemoveDialog);
confirmRemoveButton.addEventListener("click", async () => {
  if (!pendingRemoval) {
    return;
  }

  const removal = pendingRemoval;
  confirmRemoveButton.disabled = true;
  cancelRemoveButton.disabled = true;

  try {
    const settings = await post(removal.endpoint, removal.payload);
    renderSettings(settings);
    closeRemoveDialog();
    setMessage(
      settingsLoadState,
      `${sourceLabel(removal.type)} removed.`,
      "success",
    );
  } catch (error) {
    closeRemoveDialog();
    setMessage(settingsLoadState, error.message, "error");
  } finally {
    confirmRemoveButton.disabled = false;
    cancelRemoveButton.disabled = false;
  }
});
removeDialog.addEventListener("cancel", () => {
  pendingRemoval = undefined;
});

async function initialize() {
  setBusy(true);
  setMessage(settingsLoadState, "Loading...", "pending");

  try {
    const setupResponse = await fetch("./api/setup", { cache: "no-store" });
    const setup = await setupResponse.json();
    if (!setupResponse.ok || !setup.authenticated) {
      window.location.replace("./");
      return;
    }

    csrfToken = setup.csrf_token;
    renderSettings(await request("./api/settings"));
    setMessage(settingsLoadState, "");
    updateTransportFields();
  } catch (error) {
    setMessage(settingsLoadState, error.message, "error");
  } finally {
    setBusy(false);
  }
}

initialize();