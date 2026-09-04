#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const port = Number.parseInt(process.env.PORT || "7681", 10);
const terminalPort = port + 1;
const optionsPath = "/data/options.json";
const staticRoot = "/usr/share/copilot/setup";
const copilotHome = process.env.COPILOT_HOME || "/config/copilot";
const workspacePath = process.env.WORKSPACE || "/config/workspace";
const modelSettingsPath = path.join(copilotHome, "addon-settings.json");
const sessionDatabasePath = path.join(
  copilotHome,
  "session-store.db",
);
const authenticationRequired = process.env.COPILOT_AUTH_REQUIRED === "true";
const csrfToken = crypto.randomBytes(32).toString("hex");
const maxRequestBytes = 128 * 1024;
const sessionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deviceCodePattern = /enter code\s+([A-Z0-9]{4}-[A-Z0-9]{4})/i;
const plaintextConsentPrompt =
  "System keychain unavailable. Store token in plaintext config file? (y/N)";

let oauthCanceled = false;
let oauthProcess;
let oauthState = { status: "idle" };
let restartScheduled = false;
let terminalProcess;
let terminalStopping = false;
let terminalState = { status: "idle" };

const defaultModelOptions = {
  model: "auto",
  mode: "interactive",
  context: "default",
  reasoning_effort: "default",
};
const validModes = new Set(["interactive", "plan", "autopilot"]);
const validContexts = new Set(["default", "long_context"]);
const validReasoningEfforts = new Set([
  "default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
let configuredModelOptions = loadModelOptions();

const staticFiles = new Map([
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/ha-theme.css", ["ha-theme.css", "text/css; charset=utf-8"]],
  ["/ha-theme.js", ["ha-theme.js", "text/javascript; charset=utf-8"]],
  ["/sessions.html", ["sessions.html", "text/html; charset=utf-8"]],
  ["/sessions.css", ["sessions.css", "text/css; charset=utf-8"]],
  ["/sessions.js", ["sessions.js", "text/javascript; charset=utf-8"]],
  ["/settings.html", ["settings.html", "text/html; charset=utf-8"]],
  ["/settings.css", ["settings.css", "text/css; charset=utf-8"]],
  ["/settings.js", ["settings.js", "text/javascript; charset=utf-8"]],
]);

function securityHeaders(contentType) {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'; img-src 'self'; object-src 'none'",
    "Content-Type": contentType,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
  };
}

function send(response, status, contentType, body) {
  response.writeHead(status, {
    ...securityHeaders(contentType),
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendJson(response, status, payload) {
  send(
    response,
    status,
    "application/json; charset=utf-8",
    JSON.stringify(payload),
  );
}

function readOptions() {
  return JSON.parse(fs.readFileSync(optionsPath, "utf8"));
}

function hasValidCsrfToken(request) {
  return request.headers["x-copilot-setup-token"] === csrfToken;
}

function redactSecrets(value, secrets) {
  return secrets.reduce(
    (redacted, secret) =>
      secret ? redacted.split(secret).join("********") : redacted,
    value,
  );
}

function cleanCommandOutput(value) {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "").trim();
}

function runCopilot(args, { secrets = [], timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const commandEnvironment = { ...process.env };
    delete commandEnvironment.SUPERVISOR_TOKEN;

    const child = spawn("copilot", args, {
      cwd: workspacePath,
      env: commandEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeout);
    timer.unref();

    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk.toString()}`.slice(-1024 * 1024);
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-1024 * 1024);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error("Copilot did not complete the request in time."));
        return;
      }

      if (exitCode === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(
        new Error(
          redactSecrets(
            cleanCommandOutput(
              stderr || stdout || "Copilot could not complete the request.",
            ),
            secrets,
          ),
        ),
      );
    });
  });
}

function selectModelOptions(options) {
  const model =
    typeof options.model === "string" &&
    /^(auto|[A-Za-z0-9][A-Za-z0-9._-]{0,79})$/u.test(options.model)
      ? options.model
      : defaultModelOptions.model;

  return {
    model,
    mode: validModes.has(options.mode) ? options.mode : defaultModelOptions.mode,
    context: validContexts.has(options.context)
      ? options.context
      : defaultModelOptions.context,
    reasoning_effort: validReasoningEfforts.has(options.reasoning_effort)
      ? options.reasoning_effort
      : defaultModelOptions.reasoning_effort,
  };
}

function writeModelOptions(options) {
  fs.mkdirSync(copilotHome, { recursive: true, mode: 0o700 });
  const temporaryPath = `${modelSettingsPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(options, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, modelSettingsPath);
}

function loadModelOptions() {
  let source = readOptions();

  if (fs.existsSync(modelSettingsPath)) {
    try {
      source = JSON.parse(fs.readFileSync(modelSettingsPath, "utf8"));
    } catch (error) {
      console.error(`[settings] Replacing invalid model settings: ${error.message}`);
    }
  }

  const options = selectModelOptions(source);
  writeModelOptions(options);
  return options;
}

function requiredText(value, label, maxLength = 2048) {
  if (typeof value !== "string") {
    throw new Error(`${label} is required.`);
  }

  const text = value.trim();
  if (!text) {
    throw new Error(`${label} is required.`);
  }
  if (text.length > maxLength || /[\u0000-\u001f\u007f]/u.test(text)) {
    throw new Error(`${label} is invalid.`);
  }

  return text;
}

function textList(value, label, { maxItems = 32, maxLength = 1024 } = {}) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`${label} is invalid.`);
  }

  return value.map((item) => requiredText(item, label, maxLength));
}

function enumValue(value, label, validValues) {
  const selected = requiredText(value, label, 64);
  if (!validValues.has(selected)) {
    throw new Error(`${label} is invalid.`);
  }
  return selected;
}

async function saveModelOptions(body) {
  const model = requiredText(body.model, "Model", 80);
  if (!/^(auto|[A-Za-z0-9][A-Za-z0-9._-]{0,79})$/u.test(model)) {
    throw new Error("Model is invalid.");
  }

  const nextModelOptions = {
    model,
    mode: enumValue(body.mode, "Mode", validModes),
    context: enumValue(body.context, "Context", validContexts),
    reasoning_effort: enumValue(
      body.reasoning_effort,
      "Reasoning effort",
      validReasoningEfforts,
    ),
  };
  writeModelOptions(nextModelOptions);
  configuredModelOptions = nextModelOptions;
  return nextModelOptions;
}

async function addSkill(body) {
  const source = requiredText(body.source, "Skill source");
  await runCopilot(["skill", "add", source]);
}

async function removeSkill(body) {
  const name = requiredText(body.name, "Skill name", 512);
  await runCopilot(["skill", "remove", name]);
}

async function installPlugin(body) {
  const source = requiredText(body.source, "Plugin source");
  if (/\s/u.test(source)) {
    throw new Error("Plugin source is invalid.");
  }
  await runCopilot(["plugin", "install", source]);
}

async function uninstallPlugin(body) {
  const name = requiredText(body.name, "Plugin name", 256);
  if (/\s/u.test(name)) {
    throw new Error("Plugin name is invalid.");
  }
  await runCopilot(["plugin", "uninstall", name]);
}

async function addMcpServer(body) {
  const name = requiredText(body.name, "Server name", 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(name)) {
    throw new Error("Server name is invalid.");
  }

  const transport = enumValue(
    body.transport,
    "Transport",
    new Set(["stdio", "http", "sse"]),
  );
  const environment = textList(body.environment, "Environment variable");
  const headers = textList(body.headers, "Header");
  if (
    body.tools !== undefined &&
    (typeof body.tools !== "string" ||
      body.tools.length > 2048 ||
      /[\u0000-\u001f\u007f]/u.test(body.tools))
  ) {
    throw new Error("Tools filter is invalid.");
  }
  const tools = body.tools === undefined ? "*" : body.tools.trim();
  const args = ["mcp", "add", "--transport", transport, "--tools", tools];

  for (const variable of environment) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*=.+$/u.test(variable)) {
      throw new Error("Environment variables must use KEY=value format.");
    }
    args.push("--env", variable);
  }
  for (const header of headers) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+:\s*.+$/u.test(header)) {
      throw new Error("Headers must use Name: value format.");
    }
    args.push("--header", header);
  }

  if (body.timeout !== undefined && body.timeout !== "") {
    const timeout = Number(body.timeout);
    if (!Number.isInteger(timeout) || timeout < 100 || timeout > 300000) {
      throw new Error("Timeout must be between 100 and 300000 milliseconds.");
    }
    args.push("--timeout", String(timeout));
  }

  args.push(name);
  if (transport === "stdio") {
    const command = requiredText(body.command, "Command", 1024);
    const commandArgs = textList(body.arguments, "Command argument");
    args.push("--", command, ...commandArgs);
  } else {
    const url = requiredText(body.url, "Server URL");
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error("Server URL is invalid.");
    }
    if (!new Set(["http:", "https:"]).has(parsedUrl.protocol)) {
      throw new Error("Server URL must use HTTP or HTTPS.");
    }
    args.push(url);
  }

  const secrets = [
    ...environment.flatMap((value) => [value, value.slice(value.indexOf("=") + 1)]),
    ...headers.flatMap((value) => [value, value.slice(value.indexOf(":") + 1).trim()]),
  ];
  await runCopilot(args, { secrets });
}

async function removeMcpServer(body) {
  const name = requiredText(body.name, "Server name", 64);
  await runCopilot(["mcp", "remove", name]);
}

function parseCopilotJson(output, fallback) {
  return output ? JSON.parse(output) : fallback;
}

function listInstalledPlugins() {
  const pluginRoot = path.join(copilotHome, "installed-plugins");
  if (!fs.existsSync(pluginRoot)) {
    return [];
  }

  return fs
    .readdirSync(pluginRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function settingsInventory() {
  const [skillOutput, mcpOutput] = await Promise.all([
    runCopilot(["skill", "list", "--json"]),
    runCopilot(["mcp", "list", "--json"]),
  ]);

  return {
    model: configuredModelOptions,
    skills: parseCopilotJson(skillOutput, []),
    plugins: listInstalledPlugins(),
    mcp_servers: parseCopilotJson(mcpOutput, { mcpServers: {} }).mcpServers,
  };
}

function listSessions() {
  if (!fs.existsSync(sessionDatabasePath)) {
    return [];
  }

  const database = new DatabaseSync(sessionDatabasePath, { readOnly: true });

  try {
    return database
      .prepare(
        `SELECT
           sessions.id,
           sessions.summary,
           sessions.cwd,
           sessions.repository,
           sessions.branch,
           sessions.created_at,
           sessions.updated_at,
           count(turns.id) AS turn_count
         FROM sessions
         LEFT JOIN turns ON turns.session_id = sessions.id
         GROUP BY sessions.id
        ORDER BY coalesce(sessions.updated_at, sessions.created_at) DESC`,
      )
      .all()
      .map((session) => ({
        id: session.id,
        title: session.summary?.trim() || `Session ${session.id.slice(0, 8)}`,
        cwd: session.cwd,
        repository: session.repository,
        branch: session.branch,
        created_at: session.created_at,
        updated_at: session.updated_at,
        turn_count: Number(session.turn_count),
      }));
  } finally {
    database.close();
  }
}

function sessionExists(sessionId) {
  if (!fs.existsSync(sessionDatabasePath)) {
    return false;
  }

  const database = new DatabaseSync(sessionDatabasePath, { readOnly: true });

  try {
    return Boolean(
      database
        .prepare("SELECT 1 FROM sessions WHERE id = ? LIMIT 1")
        .get(sessionId),
    );
  } finally {
    database.close();
  }
}

function removeSessionFromSidebarState(sessionId) {
  const sidebarStateRoot = path.join(
    process.env.COPILOT_HOME || "/config/copilot",
    "sidebar-sessions-state",
  );

  if (!fs.existsSync(sidebarStateRoot)) {
    return;
  }

  for (const fileName of fs.readdirSync(sidebarStateRoot)) {
    const filePath = path.join(sidebarStateRoot, fileName);
    let state;

    try {
      state = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }

    if (!Array.isArray(state.sessionIds) || !state.sessionIds.includes(sessionId)) {
      continue;
    }

    state.sessionIds = state.sessionIds.filter((id) => id !== sessionId);
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      mode: 0o600,
    });
    fs.renameSync(temporaryPath, filePath);
  }
}

function deleteSession(sessionId) {
  if (!sessionIdPattern.test(sessionId || "")) {
    throw new Error("The selected session identifier is invalid.");
  }

  if (
    terminalProcess?.pid &&
    terminalState.session_id === sessionId &&
    ["starting", "running"].includes(terminalState.status)
  ) {
    throw new Error("The active session cannot be deleted.");
  }

  if (!fs.existsSync(sessionDatabasePath)) {
    throw new Error("The selected session no longer exists.");
  }

  const database = new DatabaseSync(sessionDatabasePath);
  const childTables = [
    "assistant_usage_events",
    "checkpoints",
    "forge_trajectory_events",
    "search_index",
    "session_files",
    "session_refs",
    "turns",
  ];

  try {
    database.exec("PRAGMA busy_timeout = 5000");
    database.exec("BEGIN IMMEDIATE");

    for (const table of childTables) {
      database.prepare(`DELETE FROM ${table} WHERE session_id = ?`).run(sessionId);
    }

    const result = database
      .prepare("DELETE FROM sessions WHERE id = ?")
      .run(sessionId);

    if (result.changes !== 1) {
      throw new Error("The selected session no longer exists.");
    }

    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // No active transaction remains.
    }
    throw error;
  } finally {
    database.close();
  }

  fs.rmSync(
    path.join(
      process.env.COPILOT_HOME || "/config/copilot",
      "session-state",
      sessionId,
    ),
    { recursive: true, force: true },
  );
  removeSessionFromSidebarState(sessionId);
}

function publicTerminalState() {
  return { ...terminalState };
}

function stopProcessGroup(child) {
  if (!child?.pid) {
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function stopTerminal() {
  if (!terminalProcess?.pid) {
    terminalState = { status: "idle" };
    return Promise.resolve();
  }

  const child = terminalProcess;
  terminalStopping = true;
  stopProcessGroup(child);

  return new Promise((resolve) => {
    let settled = false;
    let timeout;
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      if (terminalProcess === child) {
        terminalProcess = undefined;
      }
      terminalStopping = false;
      terminalState = { status: "idle" };
      resolve();
    };

    child.once("close", finish);
    timeout = setTimeout(() => {
      if (terminalProcess === child) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
      finish();
    }, 5000).unref();
  });
}

async function startTerminal(action, requestedSessionId) {
  if (action !== "new" && action !== "resume") {
    throw new Error("Choose a new or previous session.");
  }

  const sessionId =
    action === "new" ? crypto.randomUUID() : requestedSessionId;

  if (!sessionIdPattern.test(sessionId || "")) {
    throw new Error("The selected session identifier is invalid.");
  }

  if (action === "resume" && !sessionExists(sessionId)) {
    throw new Error("The selected session no longer exists.");
  }

  await stopTerminal();

  const selectedSession =
    action === "resume"
      ? listSessions().find((session) => session.id === sessionId)
      : undefined;
  const terminalEnvironment = { ...process.env };
  delete terminalEnvironment.SUPERVISOR_TOKEN;
  terminalEnvironment.ADDON_COPILOT_MODEL = configuredModelOptions.model;
  terminalEnvironment.ADDON_COPILOT_MODE = configuredModelOptions.mode;
  terminalEnvironment.ADDON_COPILOT_CONTEXT = configuredModelOptions.context;
  terminalEnvironment.ADDON_COPILOT_REASONING_EFFORT =
    configuredModelOptions.reasoning_effort;

  terminalState = {
    status: "starting",
    action,
    session_id: sessionId,
    title: selectedSession?.title || "New session",
  };

  const child = spawn(
    "ttyd",
    [
      "--writable",
      "--port",
      String(terminalPort),
      "--interface",
      "lo",
      "--base-path",
      "/terminal",
      "--max-clients",
      "1",
      "--terminal-type",
      "xterm-256color",
      "--client-option",
      `titleFixed=${process.env.NAME || "Copilot CLI"}`,
      "--client-option",
      "disableLeaveAlert=true",
      "--",
      "/usr/bin/copilot.sh",
      action,
      sessionId,
    ],
    {
      detached: true,
      env: terminalEnvironment,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  terminalProcess = child;
  let output = "";
  const captureOutput = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-4096);
    if (
      terminalProcess === child &&
      terminalState.status === "starting" &&
      output.includes("Listening on port")
    ) {
      terminalState = { ...terminalState, status: "running" };
    }
  };

  child.stdout.on("data", captureOutput);
  child.stderr.on("data", captureOutput);
  child.on("error", () => {
    if (terminalProcess === child) {
      terminalProcess = undefined;
      terminalState = {
        status: "error",
        error: "Could not start the Copilot terminal.",
      };
    }
  });
  child.on("close", (exitCode) => {
    if (terminalProcess !== child) {
      return;
    }

    terminalProcess = undefined;
    if (!terminalStopping) {
      terminalState = {
        status: "error",
        error: `Copilot terminal exited (${exitCode ?? "unknown"}).`,
      };
    }
  });

  return publicTerminalState();
}

function proxyTerminalRequest(request, response) {
  if (terminalState.status !== "running") {
    sendJson(response, 503, { error: "The Copilot terminal is not ready." });
    return;
  }

  const headers = { ...request.headers, host: `127.0.0.1:${terminalPort}` };
  const proxyRequest = http.request(
    {
      hostname: "127.0.0.1",
      port: terminalPort,
      method: request.method,
      path: request.url,
      headers,
    },
    (proxyResponse) => {
      response.writeHead(
        proxyResponse.statusCode || 502,
        proxyResponse.statusMessage,
        proxyResponse.headers,
      );
      proxyResponse.pipe(response);
    },
  );

  proxyRequest.on("error", () => {
    if (!response.headersSent) {
      sendJson(response, 502, { error: "The Copilot terminal is unavailable." });
    } else {
      response.end();
    }
  });
  request.pipe(proxyRequest);
}

function rejectUpgrade(socket, status, message) {
  socket.end(
    `HTTP/1.1 ${status} ${message}\r\n` +
    "Connection: close\r\n" +
    "Content-Length: 0\r\n\r\n",
  );
}

function proxyTerminalUpgrade(request, socket, head) {
  if (authenticationRequired || terminalState.status !== "running") {
    rejectUpgrade(socket, 503, "Service Unavailable");
    return;
  }

  const headers = { ...request.headers, host: `127.0.0.1:${terminalPort}` };
  const proxyRequest = http.request({
    hostname: "127.0.0.1",
    port: terminalPort,
    method: request.method,
    path: request.url,
    headers,
  });

  proxyRequest.on("upgrade", (proxyResponse, proxySocket, proxyHead) => {
    let responseHeaders = `HTTP/1.1 ${proxyResponse.statusCode} ${proxyResponse.statusMessage}\r\n`;
    for (let index = 0; index < proxyResponse.rawHeaders.length; index += 2) {
      responseHeaders += `${proxyResponse.rawHeaders[index]}: ${proxyResponse.rawHeaders[index + 1]}\r\n`;
    }
    socket.write(`${responseHeaders}\r\n`);

    if (head.length) {
      proxySocket.write(head);
    }
    if (proxyHead.length) {
      socket.write(proxyHead);
    }

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });
  proxyRequest.on("response", (proxyResponse) => {
    rejectUpgrade(
      socket,
      proxyResponse.statusCode || 502,
      proxyResponse.statusMessage || "Bad Gateway",
    );
  });
  proxyRequest.on("error", () => {
    rejectUpgrade(socket, 502, "Bad Gateway");
  });
  proxyRequest.end();
}

function createTokenUrl() {
  const url = new URL(
    "https://github.com/settings/personal-access-tokens/new",
  );
  url.searchParams.set("name", "Home Assistant Copilot CLI");
  url.searchParams.set(
    "description",
    "Authenticate Copilot CLI running in Home Assistant",
  );
  url.searchParams.set("expires_in", "90");
  url.searchParams.set("copilot_requests", "write");
  return url.toString();
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxRequestBytes) {
        tooLarge = true;
      }
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(new Error("Request is too large."));
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body is not valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function callSupervisor(pathname, body) {
  const supervisorToken = process.env.SUPERVISOR_TOKEN;
  if (!supervisorToken) {
    return Promise.reject(new Error("Supervisor API access is unavailable."));
  }

  const payload = body === undefined ? "" : JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const supervisorRequest = http.request(
      {
        hostname: "supervisor",
        path: pathname,
        method: "POST",
        headers: {
          Authorization: `Bearer ${supervisorToken}`,
          "Content-Length": Buffer.byteLength(payload),
          "Content-Type": "application/json",
        },
      },
      (supervisorResponse) => {
        let responseBody = "";
        supervisorResponse.setEncoding("utf8");
        supervisorResponse.on("data", (chunk) => {
          responseBody += chunk;
        });
        supervisorResponse.on("end", () => {
          const status = supervisorResponse.statusCode || 500;
          let result;

          try {
            result = JSON.parse(responseBody);
          } catch {
            result = {};
          }

          if (status >= 200 && status < 300 && result.result === "ok") {
            resolve();
          } else {
            reject(
              new Error(`Supervisor rejected the request (${status}).`),
            );
          }
        });
      },
    );

    supervisorRequest.setTimeout(10000, () => {
      supervisorRequest.destroy(new Error("Supervisor request timed out."));
    });
    supervisorRequest.on("error", reject);
    supervisorRequest.end(payload);
  });
}

function updateAddonOptions(options) {
  return callSupervisor("/addons/self/options", { options });
}

function scheduleRestart(delay = 750) {
  if (restartScheduled) {
    return;
  }

  restartScheduled = true;
  setTimeout(() => {
    callSupervisor("/addons/self/restart").catch((error) => {
      restartScheduled = false;
      console.error(`[setup] Could not restart the app: ${error.message}`);
    });
  }, delay).unref();
}

function publicOauthState() {
  return {
    status: oauthState.status,
    ...(oauthState.code ? { code: oauthState.code } : {}),
    ...(oauthState.verification_url
      ? { verification_url: oauthState.verification_url }
      : {}),
    ...(oauthState.expires_at ? { expires_at: oauthState.expires_at } : {}),
    ...(oauthState.error ? { error: oauthState.error } : {}),
  };
}

function stopOauthProcess() {
  if (!oauthProcess?.pid) {
    return;
  }

  try {
    process.kill(-oauthProcess.pid, "SIGTERM");
  } catch {
    oauthProcess.kill("SIGTERM");
  }
}

function startDeviceLogin() {
  if (oauthProcess) {
    return;
  }

  const oauthEnvironment = { ...process.env };
  delete oauthEnvironment.COPILOT_GITHUB_TOKEN;
  delete oauthEnvironment.GH_TOKEN;
  delete oauthEnvironment.GITHUB_TOKEN;
  delete oauthEnvironment.SUPERVISOR_TOKEN;

  oauthCanceled = false;
  oauthState = {
    status: "starting",
    verification_url: "https://github.com/login/device",
    expires_at: Date.now() + 15 * 60 * 1000,
  };

  oauthProcess = spawn(
    "script",
    [
      "--quiet",
      "--return",
      "--flush",
      "--command",
      "exec copilot login --device-code",
      "/dev/null",
    ],
    {
      cwd: process.env.WORKSPACE || "/config/workspace",
      detached: true,
      env: oauthEnvironment,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  let output = "";
  let plaintextConsentSent = false;
  const captureOutput = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-4096);
    const match = output.match(deviceCodePattern);
    if (match && oauthState.status === "starting") {
      oauthState = {
        ...oauthState,
        code: match[1].toUpperCase(),
        status: "pending",
      };
    }

    if (
      !plaintextConsentSent &&
      output.includes(plaintextConsentPrompt) &&
      oauthProcess?.stdin.writable
    ) {
      plaintextConsentSent = true;
      oauthState = { ...oauthState, status: "saving" };
      oauthProcess.stdin.write("yes\n");
    }
  };

  oauthProcess.stdout.on("data", captureOutput);
  oauthProcess.stderr.on("data", captureOutput);
  oauthProcess.on("error", () => {
    oauthProcess = undefined;
    oauthState = {
      status: "error",
      error: "Could not start GitHub authorization.",
    };
  });
  oauthProcess.on("close", (exitCode) => {
    oauthProcess = undefined;

    if (oauthCanceled) {
      oauthCanceled = false;
      oauthState = { status: "idle" };
      return;
    }

    if (exitCode === 0) {
      oauthState = { status: "complete" };
      scheduleRestart(1800);
      return;
    }

    const tokenReceived = output.includes("Login succeeded");
    oauthState = {
      status: "error",
      error: tokenReceived
        ? "GitHub approved the request, but Copilot could not save the credential. Try again."
        : "GitHub authorization was not completed. Try again.",
    };
  });
}

async function handleConfigure(request, response) {
  if (request.headers["x-copilot-setup-token"] !== csrfToken) {
    sendJson(response, 403, { error: "The setup session has expired." });
    return;
  }

  const body = await readJson(request);
  const token = typeof body.token === "string" ? body.token.trim() : "";

  if (!/^github_pat_[A-Za-z0-9_]{20,512}$/.test(token)) {
    sendJson(response, 400, {
      error: "Enter the fine-grained token generated by GitHub.",
    });
    return;
  }

  const options = {
    ...readOptions(),
    github_token: token,
  };
  for (const key of Object.keys(defaultModelOptions)) {
    delete options[key];
  }
  delete options.github_host;
  await updateAddonOptions(options);
  sendJson(response, 200, { success: true });
  scheduleRestart();
}

function handleDeviceLogin(request, response) {
  if (request.headers["x-copilot-setup-token"] !== csrfToken) {
    sendJson(response, 403, { error: "The setup session has expired." });
    return;
  }

  startDeviceLogin();
  sendJson(response, 202, publicOauthState());
}

function handleDeviceCancel(request, response) {
  if (request.headers["x-copilot-setup-token"] !== csrfToken) {
    sendJson(response, 403, { error: "The setup session has expired." });
    return;
  }

  oauthCanceled = true;
  stopOauthProcess();
  oauthState = { status: "idle" };
  sendJson(response, 200, publicOauthState());
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url || "/", "http://setup.local");

  if (requestUrl.pathname === "/terminal") {
    response.writeHead(308, { Location: "./terminal/" });
    response.end();
    return;
  }

  if (requestUrl.pathname.startsWith("/terminal/")) {
    if (authenticationRequired) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    proxyTerminalRequest(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/setup") {
    sendJson(response, 200, {
      authenticated: !authenticationRequired,
      csrf_token: csrfToken,
      token_url: createTokenUrl(),
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/sessions") {
    if (authenticationRequired || !hasValidCsrfToken(request)) {
      sendJson(response, 403, { error: "The launcher session has expired." });
      return;
    }

    sendJson(response, 200, { sessions: listSessions() });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/settings") {
    if (authenticationRequired || !hasValidCsrfToken(request)) {
      sendJson(response, 403, { error: "The launcher session has expired." });
      return;
    }

    sendJson(response, 200, await settingsInventory());
    return;
  }

  if (
    request.method === "POST" &&
    requestUrl.pathname === "/api/settings/model"
  ) {
    if (authenticationRequired || !hasValidCsrfToken(request)) {
      sendJson(response, 403, { error: "The launcher session has expired." });
      return;
    }

    sendJson(response, 200, {
      model: await saveModelOptions(await readJson(request)),
    });
    return;
  }

  const extensionActions = new Map([
    ["/api/settings/skills/add", addSkill],
    ["/api/settings/skills/remove", removeSkill],
    ["/api/settings/plugins/install", installPlugin],
    ["/api/settings/plugins/uninstall", uninstallPlugin],
    ["/api/settings/mcp/add", addMcpServer],
    ["/api/settings/mcp/remove", removeMcpServer],
  ]);
  const extensionAction = extensionActions.get(requestUrl.pathname);
  if (request.method === "POST" && extensionAction) {
    if (authenticationRequired || !hasValidCsrfToken(request)) {
      sendJson(response, 403, { error: "The launcher session has expired." });
      return;
    }

    await extensionAction(await readJson(request));
    sendJson(response, 200, await settingsInventory());
    return;
  }

  if (
    request.method === "GET" &&
    requestUrl.pathname === "/api/session-status"
  ) {
    if (authenticationRequired || !hasValidCsrfToken(request)) {
      sendJson(response, 403, { error: "The launcher session has expired." });
      return;
    }

    sendJson(response, 200, publicTerminalState());
    return;
  }

  if (
    request.method === "POST" &&
    requestUrl.pathname === "/api/session-launch"
  ) {
    if (authenticationRequired || !hasValidCsrfToken(request)) {
      sendJson(response, 403, { error: "The launcher session has expired." });
      return;
    }

    const body = await readJson(request);
    const state = await startTerminal(body.action, body.session_id);
    sendJson(response, 202, state);
    return;
  }

  if (
    request.method === "POST" &&
    requestUrl.pathname === "/api/session-stop"
  ) {
    if (authenticationRequired || !hasValidCsrfToken(request)) {
      sendJson(response, 403, { error: "The launcher session has expired." });
      return;
    }

    await stopTerminal();
    sendJson(response, 200, publicTerminalState());
    return;
  }

  if (
    request.method === "POST" &&
    requestUrl.pathname === "/api/session-delete"
  ) {
    if (authenticationRequired || !hasValidCsrfToken(request)) {
      sendJson(response, 403, { error: "The launcher session has expired." });
      return;
    }

    const body = await readJson(request);
    deleteSession(body.session_id);
    sendJson(response, 200, { success: true });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/configure") {
    await handleConfigure(request, response);
    return;
  }

  if (
    request.method === "POST" &&
    requestUrl.pathname === "/api/device-login"
  ) {
    handleDeviceLogin(request, response);
    return;
  }

  if (
    request.method === "POST" &&
    requestUrl.pathname === "/api/device-cancel"
  ) {
    handleDeviceCancel(request, response);
    return;
  }

  if (
    request.method === "GET" &&
    requestUrl.pathname === "/api/device-status"
  ) {
    if (request.headers["x-copilot-setup-token"] !== csrfToken) {
      sendJson(response, 403, { error: "The setup session has expired." });
      return;
    }

    sendJson(response, 200, publicOauthState());
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  const staticFile =
    requestUrl.pathname === "/"
      ? [
        authenticationRequired ? "index.html" : "sessions.html",
        "text/html; charset=utf-8",
      ]
      : staticFiles.get(requestUrl.pathname);
  if (request.method === "GET" && staticFile) {
    if (
      authenticationRequired &&
      (requestUrl.pathname.startsWith("/sessions") ||
        requestUrl.pathname.startsWith("/settings"))
    ) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    const [fileName, contentType] = staticFile;
    send(
      response,
      200,
      contentType,
      fs.readFileSync(path.join(staticRoot, fileName)),
    );
    return;
  }

  if (requestUrl.pathname === "/favicon.ico") {
    response.writeHead(204, securityHeaders("image/x-icon"));
    response.end();
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error(`[app] ${error.message}`);
    if (!response.headersSent) {
      sendJson(response, 500, {
        error: error.message || "The request could not be completed.",
      });
    } else {
      response.end();
    }
  });
});

server.on("upgrade", (request, socket, head) => {
  const requestUrl = new URL(request.url || "/", "http://launcher.local");
  if (!requestUrl.pathname.startsWith("/terminal/")) {
    rejectUpgrade(socket, 404, "Not Found");
    return;
  }

  proxyTerminalUpgrade(request, socket, head);
});

server.listen(port, "0.0.0.0");

process.on("SIGTERM", () => {
  oauthCanceled = true;
  stopOauthProcess();
  stopTerminal().finally(() => {
    server.close(() => process.exit(0));
  });
});