export const STORAGE_KEY = "tabRescueSessions";
export const MAX_SESSIONS = 100;
export const MAX_TABS = 300;
const MAX_TITLE = 100;
const MAX_URL = 4096;

export function safeUrl(url) {
  if (typeof url !== "string" || url.length > MAX_URL) return null;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

export function normalizeTabs(tabs) {
  if (!Array.isArray(tabs)) return [];
  return tabs.flatMap((tab) => {
    const url = safeUrl(tab?.url);
    if (!url) return [];
    return [{
      url,
      title: String(tab.title || new URL(url).hostname).slice(0, 200),
      pinned: Boolean(tab.pinned)
    }];
  }).slice(0, MAX_TABS);
}

export function fingerprint(tabs) {
  return normalizeTabs(tabs).map((tab) => tab.url).sort().join("\n");
}

export function makeSession(tabs, title, source = "manual", now = Date.now(), id = crypto.randomUUID()) {
  const normalized = normalizeTabs(tabs);
  if (!normalized.length) throw new Error("No regular web tabs to save.");
  return {
    id,
    title: String(title || "Untitled session").trim().slice(0, MAX_TITLE) || "Untitled session",
    createdAt: now,
    source: source === "automatic" ? "automatic" : "manual",
    pinned: false,
    tabs: normalized
  };
}

export function addSession(sessions, incoming) {
  const list = Array.isArray(sessions) ? sessions : [];
  // Pinned saves survive pruning; the oldest unpinned save is discarded first.
  const next = [incoming, ...list.filter((item) => item.id !== incoming.id)];
  while (next.length > MAX_SESSIONS) {
    const index = next.findLastIndex((item) => !item.pinned);
    if (index < 0) throw new Error("All saved sessions are pinned. Unpin one before saving another.");
    next.splice(index, 1);
  }
  return next;
}

export function validateImport(input) {
  if (!input || input.format !== "tab-rescue-v1" || !Array.isArray(input.sessions)) {
    throw new Error("This is not a Tab Rescue v1 export.");
  }
  if (input.sessions.length > MAX_SESSIONS) throw new Error("Export has too many sessions.");
  return input.sessions.flatMap((item) => {
    if (!item || typeof item !== "object" || !Array.isArray(item.tabs)) return [];
    const tabs = normalizeTabs(item.tabs);
    if (!tabs.length) return [];
    const stamp = Number(item.createdAt);
    const session = makeSession(
      tabs, item.title, item.source,
      Number.isFinite(stamp) && stamp > 0 ? stamp : Date.now()
    );
    session.pinned = Boolean(item.pinned);
    return [session];
  });
}
