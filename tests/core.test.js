import test from "node:test";
import assert from "node:assert/strict";
import { addSession, fingerprint, makeSession, normalizeTabs, safeUrl, validateImport } from "../src/core.js";

test("only regular web URLs are kept", () => {
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("chrome://settings"), null);
  assert.equal(safeUrl("https://example.com/a"), "https://example.com/a");
  assert.deepEqual(normalizeTabs([
    { url: "chrome://newtab", title: "internal" },
    { url: "https://example.com", title: "Example", pinned: true }
  ]), [{ url: "https://example.com/", title: "Example", pinned: true }]);
});

test("fingerprint ignores tab order", () => {
  assert.equal(fingerprint([{ url: "https://a.test" }, { url: "https://b.test" }]),
               fingerprint([{ url: "https://b.test" }, { url: "https://a.test" }]));
});

test("saving preserves title, tabs, and source", () => {
  const session = makeSession([{ url: "https://example.com" }], " Research ", "automatic", 42, "id-1");
  assert.equal(session.title, "Research");
  assert.equal(session.source, "automatic");
  assert.equal(session.tabs.length, 1);
  assert.equal(session.id, "id-1");
});

test("malformed import and unsafe URLs cannot restore", () => {
  assert.throws(() => validateImport({ sessions: [] }), /not a Tab Rescue/);
  const imported = validateImport({
    format: "tab-rescue-v1",
    sessions: [{ title: "Mixed", tabs: [
      { url: "file:///private" },
      { url: "https://safe.test" }
    ] }]
  });
  assert.equal(imported.length, 1);
  assert.equal(imported[0].tabs.length, 1);
  assert.equal(imported[0].tabs[0].url, "https://safe.test/");
});

test("maximum count prunes old unpinned sessions while retaining pinned", () => {
  const pinned = makeSession([{ url: "https://a.test" }], "Pinned", "manual", 1, "p");
  pinned.pinned = true;
  let sessions = [pinned];
  for (let i = 0; i < 105; i++) {
    sessions = addSession(sessions, makeSession([{ url: "https://a.test" }], String(i), "manual", i + 2, String(i)));
  }
  assert.equal(sessions.length, 100);
  assert.ok(sessions.some((item) => item.id === "p"));
});
