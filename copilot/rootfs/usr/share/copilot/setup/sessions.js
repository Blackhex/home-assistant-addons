"use strict";

const cancelDeleteButton = document.querySelector("#cancel-delete");
const closeSessionButton = document.querySelector("#close-session");
const confirmDeleteButton = document.querySelector("#confirm-delete");
const deleteDialog = document.querySelector("#delete-dialog");
const deleteDialogMessage = document.querySelector("#delete-dialog-message");
const emptySessions = document.querySelector("#empty-sessions");
const launchStatus = document.querySelector("#launch-status");
const newSessionButton = document.querySelector("#new-session");
const recentList = document.querySelector("#recent-list");
const sessionCount = document.querySelector("#session-count");
const sessionHome = document.querySelector("#session-home");
const terminalFrame = document.querySelector("#terminal-frame");
const terminalView = document.querySelector("#terminal-view");

let csrfToken = "";
let pendingDeleteSession;
let sessions = [];

function setStatus(message, state = "") {
  launchStatus.textContent = message;
  launchStatus.dataset.state = state;
}

function setBusy(busy) {
  closeSessionButton.disabled = busy;
  newSessionButton.disabled = busy;
  for (const button of recentList.querySelectorAll("button")) {
    button.disabled = busy;
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

function formatUpdatedAt(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function sessionMetadata(session) {
  const turns = `${session.turn_count} ${session.turn_count === 1 ? "turn" : "turns"}`;
  const branch = session.branch ? ` on ${session.branch}` : "";
  return `${formatUpdatedAt(session.updated_at || session.created_at)} - ${turns}${branch}`;
}

function renderSessions() {
  recentList.replaceChildren();

  for (const session of sessions) {
    const row = document.createElement("div");
    row.className = "session-row";
    row.dataset.sessionId = session.id;

    const resumeButton = document.createElement("button");
    resumeButton.className = "session-resume";
    resumeButton.type = "button";

    const text = document.createElement("span");
    text.className = "session-row-text";

    const title = document.createElement("strong");
    title.textContent = session.title;

    const metadata = document.createElement("span");
    metadata.textContent = sessionMetadata(session);

    const deleteButton = document.createElement("button");
    deleteButton.className = "session-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete ${session.title}`);
    deleteButton.title = `Delete ${session.title}`;

    text.append(title, metadata);
    resumeButton.append(text);
    resumeButton.addEventListener("click", () =>
      launchSession("resume", session.id),
    );
    deleteButton.addEventListener("click", () => openDeleteDialog(session));
    row.append(resumeButton, deleteButton);
    recentList.append(row);
  }

  sessionCount.textContent = sessions.length
    ? `${sessions.length} available`
    : "";
  emptySessions.hidden = sessions.length !== 0;
}

function openDeleteDialog(session) {
  pendingDeleteSession = session;
  deleteDialogMessage.textContent = `Delete “${session.title}”?`;
  deleteDialog.showModal();
}

function closeDeleteDialog() {
  pendingDeleteSession = undefined;
  deleteDialog.close();
}

async function deleteSelectedSession() {
  if (!pendingDeleteSession) {
    return;
  }

  const session = pendingDeleteSession;
  confirmDeleteButton.disabled = true;
  cancelDeleteButton.disabled = true;

  try {
    await post("./api/session-delete", { session_id: session.id });
    sessions = sessions.filter((item) => item.id !== session.id);
    renderSessions();
    closeDeleteDialog();
    setStatus(`Deleted ${session.title}.`, "success");
  } catch (error) {
    closeDeleteDialog();
    setStatus(error.message, "error");
  } finally {
    confirmDeleteButton.disabled = false;
    cancelDeleteButton.disabled = false;
  }
}

async function loadSessions() {
  const data = await request("./api/sessions");
  sessions = data.sessions;
  renderSessions();
}

function showTerminal() {
  sessionHome.hidden = true;
  terminalView.hidden = false;
  closeSessionButton.hidden = false;

  const terminalUrl = "./terminal/";
  if (!terminalFrame.src.endsWith("/terminal/")) {
    terminalFrame.src = terminalUrl;
  }
  setStatus("");
}

function hideTerminalScrollbar() {
  if (!terminalFrame.contentDocument || terminalFrame.src === "about:blank") {
    return;
  }

  const style = terminalFrame.contentDocument.createElement("style");
  style.textContent = `
    .xterm .xterm-viewport {
      scrollbar-width: none;
    }

    .xterm .xterm-viewport::-webkit-scrollbar {
      display: none;
    }
  `;
  terminalFrame.contentDocument.head.append(style);
}

async function closeSession() {
  setBusy(true);
  setStatus("Closing session...", "pending");

  try {
    await post("./api/session-stop", {});
    terminalFrame.src = "about:blank";
    terminalView.hidden = true;
    sessionHome.hidden = false;
    closeSessionButton.hidden = true;
    await loadSessions();
    setStatus("");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
}

async function waitForTerminal() {
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    const state = await request("./api/session-status");
    if (state.status === "running") {
      showTerminal();
      setBusy(false);
      setTimeout(() => loadSessions().catch(() => { }), 1500);
      return;
    }
    if (state.status === "error") {
      throw new Error(state.error || "The Copilot terminal could not start.");
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("The Copilot terminal is still starting. Try again.");
}

async function launchSession(action, sessionId) {
  setBusy(true);
  setStatus(
    action === "resume" ? "Resuming session..." : "Starting a new session...",
    "pending",
  );
  terminalFrame.src = "about:blank";
  terminalView.hidden = true;
  sessionHome.hidden = false;
  closeSessionButton.hidden = true;

  try {
    await post("./api/session-launch", {
      action,
      ...(sessionId ? { session_id: sessionId } : {}),
    });
    await waitForTerminal();
  } catch (error) {
    setStatus(error.message, "error");
    setBusy(false);
  }
}

newSessionButton.addEventListener("click", () => launchSession("new"));
closeSessionButton.addEventListener("click", closeSession);
terminalFrame.addEventListener("load", hideTerminalScrollbar);
cancelDeleteButton.addEventListener("click", closeDeleteDialog);
confirmDeleteButton.addEventListener("click", deleteSelectedSession);
deleteDialog.addEventListener("cancel", () => {
  pendingDeleteSession = undefined;
});

async function initialize() {
  try {
    const setupResponse = await fetch("./api/setup", { cache: "no-store" });
    const setup = await setupResponse.json();
    if (!setupResponse.ok || !setup.authenticated) {
      window.location.reload();
      return;
    }

    csrfToken = setup.csrf_token;
    await loadSessions();
    const state = await request("./api/session-status");

    if (state.status === "running") {
      showTerminal();
    } else if (state.status === "starting") {
      setBusy(true);
      setStatus("Starting Copilot terminal...", "pending");
      await waitForTerminal();
    }
  } catch (error) {
    setStatus(error.message, "error");
  }
}

initialize();