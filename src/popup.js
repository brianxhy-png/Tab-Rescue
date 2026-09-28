import { STORAGE_KEY, addSession, makeSession, normalizeTabs, safeUrl, validateImport } from "./core.js";

const $ = (selector) => document.querySelector(selector);
const state = { sessions: [], filter: "all", query: "" };
const status = (message) => { $("#status").textContent = message; };

async function load() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  state.sessions = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
  render();
}

async function persist() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state.sessions });
  render();
}

function filtered() {
  const query = state.query.toLowerCase();
  return state.sessions.filter((session) => {
    if (state.filter === "pinned" && !session.pinned) return false;
    if (state.filter === "automatic" && session.source !== "automatic") return false;
    return !query || session.title.toLowerCase().includes(query)
      || session.tabs.some((tab) => tab.url.toLowerCase().includes(query));
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
}

function button(text, className, handler, label) {
  const el = document.createElement("button");
  el.textContent = text;
  el.className = className;
  el.setAttribute("aria-label", label);
  el.addEventListener("click", handler);
  return el;
}

function render() {
  $("#count").textContent = `${state.sessions.length} sessions saved`;
  const container = $("#sessions");
  container.replaceChildren();
  const sessions = filtered();
  if (!sessions.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = state.sessions.length ? "No sessions match your search." : "Nothing saved yet. Save this window to get started.";
    container.append(empty);
    return;
  }
  for (const session of sessions) {
    const card = document.createElement("article");
    card.className = "session";
    const top = document.createElement("div");
    top.className = "session-top";
    const title = document.createElement("h3");
    title.textContent = session.title;
    title.title = session.title;
    top.append(title);
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `${session.tabs.length} tabs · ${new Date(session.createdAt).toLocaleString()} · ${session.source}`;
    const actions = document.createElement("div");
    actions.className = "session-actions";
    actions.append(
      button("Restore", "restore", () => restore(session), `Restore ${session.title}`),
      button(session.pinned ? "Unpin" : "Pin", "", async () => {
        session.pinned = !session.pinned;
        await persist();
      }, `${session.pinned ? "Unpin" : "Pin"} ${session.title}`),
      button("Rename", "", async () => {
        const title = prompt("Rename session", session.title);
        if (title === null || !title.trim()) return;
        session.title = title.trim().slice(0, 100);
        await persist();
      }, `Rename ${session.title}`),
      button("Delete", "delete", async () => {
        if (!confirm(`Delete "${session.title}"? This cannot be undone.`)) return;
        state.sessions = state.sessions.filter((item) => item.id !== session.id);
        await persist();
      }, `Delete ${session.title}`)
    );
    card.append(top, meta, actions);
    container.append(card);
  }
}

async function restore(session) {
  const urls = session.tabs.map((tab) => safeUrl(tab.url)).filter(Boolean);
  if (!urls.length) return status("No restorable web tabs in this session.");
  try {
    await chrome.windows.create({ url: urls, focused: true });
    status(`Opened ${urls.length} tabs in a new window.`);
  } catch (error) {
    status(`Restore failed: ${error.message}`);
  }
}

$("#save").addEventListener("click", async () => {
  try {
    const current = await chrome.windows.getCurrent();
    const tabs = normalizeTabs((await chrome.tabs.query({ windowId: current.id }))
      .filter((tab) => !tab.incognito));
    const title = $("#session-title").value.trim() || `Window · ${new Date().toLocaleString()}`;
    const session = makeSession(tabs, title);
    // Re-read before writing so a background backup is not overwritten by stale popup state.
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    state.sessions = addSession(stored[STORAGE_KEY] || [], session);
    await persist();
    $("#session-title").value = "";
    status(`Saved ${session.tabs.length} web tabs.`);
  } catch (error) {
    status(error.message);
  }
});

$("#search").addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

document.querySelectorAll("[data-filter]").forEach((el) => el.addEventListener("click", () => {
  state.filter = el.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach((chip) => chip.classList.toggle("selected", chip === el));
  render();
}));

$("#export").addEventListener("click", () => {
  const data = JSON.stringify({ format: "tab-rescue-v1", exportedAt: new Date().toISOString(), sessions: state.sessions }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `tab-rescue-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status("Backup downloaded.");
});

$("#import").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 2_000_000) return status("File is too large (2 MB limit).");
  try {
    const imported = validateImport(JSON.parse(await file.text()));
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    state.sessions = imported.reduce((list, session) => addSession(list, session), stored[STORAGE_KEY] || []);
    await persist();
    status(`Imported ${imported.length} sessions.`);
  } catch (error) {
    status(`Import failed: ${error.message}`);
  }
  event.target.value = "";
});

load().catch((error) => status(`Could not load sessions: ${error.message}`));
