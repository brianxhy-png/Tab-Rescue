# Privacy

Tab Rescue stores snapshots of tab URLs and titles in `chrome.storage.local` on your device. It does not send them to a server, run analytics, or collect webpage content. Exporting a backup creates a JSON file on your computer; anyone with that file can read the URLs and titles. Keep backups private.

The extension requests:

| Permission | Why |
| --- | --- |
| `tabs` | Read the URLs and titles of tabs you choose to save and open tabs during restore. |
| `storage` | Keep session snapshots locally. |
| `alarms` | Schedule automatic backups every 15 minutes. |

Automatic backups exclude incognito tabs and internal browser pages. Saved sessions persist until you delete them, clear extension storage, or uninstall the extension. The oldest unpinned snapshots are pruned after 100 sessions.
