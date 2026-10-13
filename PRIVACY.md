# Privacy

Quiet Translate has no project-operated backend, analytics, advertising, or telemetry. No API key is included. You choose the API provider and supply your own credentials. Provider charges and data handling follow your agreement with that provider.

## What leaves the browser

When you translate, the extension sends the selected text, a nearby page passage, or text submitted in the workspace to the API URL you configured. The request includes the translation prompt, target language, glossary, model ID, and API credential (unless using a keyless localhost service). It does not separately send the page URL, title, browsing history, cookies, or a user identifier. Text you translate can itself contain URLs or personal information.

In Preferences, entering an API key starts model-list discovery after an 800 ms pause if the selected host already has permission. Otherwise, **Allow & get models** requests that permission on a click; manual model entry always remains available. You can also click **Get models** to refresh using a draft key, or the saved key for the exact saved endpoint. These GET requests send the API credential to the selected API host, without article text, cookies, or a translation request. Model Studio uses its catalog path on the same regional host. Redirects are refused. Opening Preferences or selecting a provider alone does not start discovery, and fetching a list does not save a draft key or model.

Page translation starts after you enable it, or on exact hostnames you add to the auto-translate list. It processes content near the viewport as you scroll. Default selection mode waits for a click; optional instant selection and Alt-hover modes submit selected/hovered passages. Editable fields, standalone code blocks, navigation, hidden content, and explicitly excluded content are skipped by automatic page translation. Review sensitive text before submitting it manually.

**Model speed tests** start only when you click **Test speeds** or press Enter in its filter. They send the fixed sentence “A quiet garden gives us room to read and think.”, a translation instruction, the selected target language, each candidate model ID and the API credential to the configured Chat Completions endpoint. They do not include the private glossary or webpage/workspace text. Each model uses one uncached request, a requested 512-output-token limit and a 20-second deadline; provider usage charges apply. There are at most two concurrent probes, with no automatic retries. Invalid credentials, depleted credits or rate limits stop the remaining batch. Stop, closing the settings page or changing its connection cancels requests. Cookies, referrers and redirects are excluded.

## What stays in the browser

- Settings and API credentials: extension-origin IndexedDB. They are not browser-synced and are never returned to content scripts or website JavaScript. The credential is not encrypted against someone who controls your OS account/browser profile.
- Translation cache: up to approximately 4 MB for 7 days, keyed by a hash of source text and translation settings. Values contain translated text; translations can contain personal information. Disable or clear this cache in Preferences. Incognito requests do not write to the persistent cache.
- Workspace drafts: not automatically persisted. Text explicitly opened from a selection is briefly transferred through browser session storage and removed when the workspace consumes it. Pasted/imported text stays in that tab unless submitted to the API.
- Discovered model lists: kept only in the current Preferences tab, not exported, synced, or cached on disk. Changing the key, endpoint or authentication mode, selecting a preset, or importing settings discards the list and cancels its request. Closing the tab cancels pending discovery.
- Speed-test results: temporary status, latency and model IDs in the current settings tab; not exported, synchronized or persisted. Generated sample translations and provider error bodies are not returned to the settings page. Website content scripts cannot start these tests. Choosing a result fills the model draft; saving remains a separate action.

## Your controls

Preferences can be exported to a local JSON file on explicit request. The default export excludes the API key; it can still contain private glossary entries, provider addresses, and website rules. Optionally include the key in a password-encrypted backup (AES-256-GCM with a random salt/IV and PBKDF2-SHA256, 310,000 iterations). Encryption and decryption run locally. The passphrase is not saved or recoverable. Imported files fill a draft and take effect only after saving; plaintext imports containing keys are rejected. Backups omit caches, workspace drafts, browser permissions, and shortcuts. No file is uploaded to a migration service.

The optional agent installer downloads releases and checksums from GitHub. GitHub receives normal download metadata such as the requesting IP address. The installer does not read browser profiles, API keys, or other apps' settings. During same-folder updates it retains an existing private `bootstrap.json` from older local installations and keeps a local code backup that may also contain that file. Do not upload private installation folders or backups to GitHub.

Change providers, remove the saved key, disable caching, clear cached translations, disable individual sites, or uninstall the extension. Changing the API domain requires entering the new provider's credential; the previous key is not silently reused. Only HTTPS API endpoints and HTTP loopback endpoints are accepted. Redirects are refused and cookies are omitted from API requests.

Browser permissions let the extension inject translation UI into ordinary web pages, use the current tab, offer context-menu commands, and store preferences locally. API host access is requested when you save the chosen endpoint or explicitly request its model list. Automatic discovery never opens a permission prompt. Broad content-script matches enable selection translation across sites; they do not mean that every page is sent to an API.

Firefox declares `authenticationInfo` and `websiteContent` transmission permissions because translating sends your credential and text to your chosen provider. This declaration is not an assertion that the project collects those data.

Updated: 2026-10-13. Changes to data handling must be documented here before release. Report concerns using [private vulnerability reporting](https://github.com/ZJUZhiyuCai/quiet-translate/security/advisories/new).
