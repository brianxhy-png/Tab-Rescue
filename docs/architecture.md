# Architecture

Tab Rescue is a Chrome Manifest V3 extension with no server.

- `src/popup.html`, `popup.css`, and `popup.js`: interactive session library, save, restore, search, pin, rename, delete, import/export.
- `src/background.js`: a service worker that creates a repeating alarm and makes automatic snapshots when the tab URL set changes.
- `src/core.js`: shared normalization, safe URL policy, import validation, session creation, deduplication fingerprint, and retention rules.
- `chrome.storage.local`: local snapshots. No account or remote service.

## Data flow

1. A manual save queries tabs in the current window.
2. An alarm queries tabs across regular windows every 15 minutes.
3. Both paths normalize URLs to HTTP(S), limit the tab count, and store a session locally.
4. Restore revalidates URLs and opens them in a new Chrome window. It does not close existing tabs.
5. Export serializes saved sessions to a local JSON download. Import validates and generates new IDs.

## Boundaries

The extension stores URLs and titles, which can be sensitive. Chrome's `tabs` permission is necessary to read them; `storage` holds snapshots; `alarms` schedules periodic backups. It never reads webpage content, history, cookies, or passwords. Incognito tabs are excluded from automatic backups; regular browser restrictions apply to popup access. Browser internal pages are excluded. The extension cannot restore form state, scroll position, or authentication.
