import { STORAGE_KEY, addSession, fingerprint, makeSession, normalizeTabs } from "./core.js";

const ALARM = "tab-rescue-autosave";
const INTERVAL_MINUTES = 15;

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM);
  if (!existing) await chrome.alarms.create(ALARM, { periodInMinutes: INTERVAL_MINUTES });
}

chrome.runtime.onInstalled.addListener(() => { ensureAlarm(); });
chrome.runtime.onStartup.addListener(() => { ensureAlarm(); });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  try {
    const allTabs = await chrome.tabs.query({});
    const tabs = normalizeTabs(allTabs.filter((tab) => !tab.incognito));
    if (!tabs.length) return;
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const sessions = stored[STORAGE_KEY] || [];
    const latestAutomatic = sessions.find((session) => session.source === "automatic");
    if (latestAutomatic && fingerprint(latestAutomatic.tabs) === fingerprint(tabs)) return;
    const title = `Automatic backup · ${new Date().toLocaleString()}`;
    await chrome.storage.local.set({
      [STORAGE_KEY]: addSession(sessions, makeSession(tabs, title, "automatic"))
    });
  } catch (error) {
    console.error("Tab Rescue backup failed:", error);
  }
});
