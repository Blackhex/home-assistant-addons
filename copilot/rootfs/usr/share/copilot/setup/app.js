"use strict";

const cancelOauthButton = document.querySelector("#cancel-oauth");
const createTokenLink = document.querySelector("#create-token");
const deviceCode = document.querySelector("#device-code");
const manualAuth = document.querySelector("#manual-auth");
const oauthCode = document.querySelector("#oauth-code");
const oauthIdle = document.querySelector("#oauth-idle");
const oauthMessage = document.querySelector("#oauth-message");
const openDevicePage = document.querySelector("#open-device-page");
const saveButton = document.querySelector("#save-token");
const startOauthButton = document.querySelector("#start-oauth");
const tokenForm = document.querySelector("#token-form");
const tokenInput = document.querySelector("#github-token");
const tokenMessage = document.querySelector("#token-message");
const toggleTokenButton = document.querySelector("#toggle-token");

let csrfToken = "";
let currentDeviceCode = "";
let oauthInProgress = false;
let oauthPollTimer;

const terminalReadyTimeout = 30000;
const terminalReadyPollInterval = 750;

function showMessage(element, text, state = "") {
  element.textContent = text;
  element.dataset.state = state;
}

function setTokenBusy(busy) {
  saveButton.disabled =
    busy || oauthInProgress || tokenInput.value.trim() === "" || !csrfToken;
  tokenInput.disabled = busy || oauthInProgress;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
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

function post(path, body = {}) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function scheduleOauthPoll() {
  clearTimeout(oauthPollTimer);
  oauthPollTimer = setTimeout(pollOauthStatus, 1000);
}

async function terminalIsReady() {
  try {
    const response = await fetch(`./?handoff=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return false;
    }

    const page = await response.text();
    return !page.includes("<title>Connect Copilot CLI</title>");
  } catch {
    return false;
  }
}

async function openTerminalWhenReady(messageElement) {
  const deadline = Date.now() + terminalReadyTimeout;

  while (Date.now() < deadline) {
    if (await terminalIsReady()) {
      window.location.reload();
      return;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, terminalReadyPollInterval),
    );
  }

  showMessage(
    messageElement,
    "Copilot is still starting. Reload this page in a moment.",
    "error",
  );
}

function renderOauthState(state) {
  const pending =
    state.status === "starting" ||
    state.status === "pending" ||
    state.status === "saving";
  oauthInProgress = pending || state.status === "complete";
  startOauthButton.disabled = oauthInProgress || !csrfToken;
  startOauthButton.textContent =
    state.status === "complete"
      ? "Authorization complete"
      : pending
        ? "Authorization in progress"
        : "Sign in with GitHub";
  setTokenBusy(false);
  oauthIdle.hidden =
    state.status === "pending" ||
    state.status === "saving" ||
    state.status === "complete";
  oauthCode.hidden = state.status !== "pending";

  if (state.status === "idle") {
    showMessage(oauthMessage, "Ready to connect.");
    return;
  }

  if (state.status === "starting") {
    showMessage(oauthMessage, "Requesting a one-time code...", "pending");
    scheduleOauthPoll();
    return;
  }

  if (state.status === "pending") {
    currentDeviceCode = state.code;
    deviceCode.textContent = state.code;
    openDevicePage.href = state.verification_url;
    openDevicePage.classList.remove("disabled");
    openDevicePage.removeAttribute("aria-disabled");
    showMessage(oauthMessage, "Waiting for approval on GitHub...", "pending");
    scheduleOauthPoll();
    return;
  }

  if (state.status === "saving") {
    showMessage(
      oauthMessage,
      "Approved. Saving the Copilot credential...",
      "pending",
    );
    scheduleOauthPoll();
    return;
  }

  if (state.status === "complete") {
    clearTimeout(oauthPollTimer);
    showMessage(
      oauthMessage,
      "Authorized. Starting Copilot CLI...",
      "success",
    );
    openTerminalWhenReady(oauthMessage);
    return;
  }

  clearTimeout(oauthPollTimer);
  showMessage(
    oauthMessage,
    state.error || "Authorization did not complete. Try again.",
    "error",
  );
}

async function pollOauthStatus() {
  try {
    const state = await request("./api/device-status", { cache: "no-store" });
    renderOauthState(state);
  } catch (error) {
    clearTimeout(oauthPollTimer);
    showMessage(oauthMessage, error.message, "error");
    startOauthButton.disabled = false;
  }
}

async function setup() {
  try {
    const response = await fetch("./api/setup", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Setup information is unavailable.");
    }

    const data = await response.json();
    csrfToken = data.csrf_token;
    createTokenLink.href = data.token_url;
    setTokenBusy(false);
    await pollOauthStatus();
  } catch (error) {
    showMessage(oauthMessage, error.message, "error");
  }
}

startOauthButton.addEventListener("click", async () => {
  startOauthButton.disabled = true;
  showMessage(oauthMessage, "Starting GitHub authorization...", "pending");

  try {
    const state = await post("./api/device-login");
    renderOauthState(state);
  } catch (error) {
    showMessage(oauthMessage, error.message, "error");
    startOauthButton.disabled = false;
  }
});

cancelOauthButton.addEventListener("click", async () => {
  clearTimeout(oauthPollTimer);
  cancelOauthButton.disabled = true;

  try {
    const state = await post("./api/device-cancel");
    currentDeviceCode = "";
    renderOauthState(state);
  } catch (error) {
    showMessage(oauthMessage, error.message, "error");
  } finally {
    cancelOauthButton.disabled = false;
  }
});

openDevicePage.addEventListener("click", () => {
  if (!currentDeviceCode || !navigator.clipboard) {
    return;
  }

  navigator.clipboard.writeText(currentDeviceCode).then(
    () =>
      showMessage(
        oauthMessage,
        "Code copied. Paste it into GitHub to approve Copilot CLI.",
        "pending",
      ),
    () => { },
  );
});

manualAuth.addEventListener("toggle", () => {
  if (manualAuth.open && oauthCode.hidden === false) {
    showMessage(
      tokenMessage,
      "Cancel device authorization before using a personal access token.",
      "error",
    );
  }
});

tokenInput.addEventListener("input", () => setTokenBusy(false));

toggleTokenButton.addEventListener("click", () => {
  const showToken = tokenInput.type === "password";
  tokenInput.type = showToken ? "text" : "password";
  toggleTokenButton.textContent = showToken ? "Hide" : "Show";
  toggleTokenButton.setAttribute(
    "aria-label",
    showToken ? "Hide token" : "Show token",
  );
  tokenInput.focus();
});

tokenForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = tokenInput.value.trim();

  if (!token.startsWith("github_pat_")) {
    showMessage(
      tokenMessage,
      "Paste the fine-grained token generated by GitHub.",
      "error",
    );
    return;
  }

  setTokenBusy(true);
  showMessage(tokenMessage, "Saving the token...", "pending");

  try {
    await post("./api/configure", { token });
    tokenInput.value = "";
    showMessage(
      tokenMessage,
      "Connected. Starting Copilot CLI...",
      "success",
    );
    openTerminalWhenReady(tokenMessage);
  } catch (error) {
    showMessage(tokenMessage, error.message, "error");
    setTokenBusy(false);
  }
});

setup();