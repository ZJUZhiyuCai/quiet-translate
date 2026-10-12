# Privacy

Quiet Translate has no project-operated backend, analytics, advertising, or telemetry. No API key is included. You choose the API provider and supply your own credentials. Provider charges and data handling follow your agreement with that provider.

## What leaves the browser

When you translate, the extension sends the selected text, a nearby page passage, or text submitted in the workspace to the API URL you configured. The request includes the translation prompt, target language, glossary, model ID, and API credential (unless using a keyless localhost service). It does not separately send the page URL, title, browsing history, cookies, or a user identifier. Text you translate can itself contain URLs or personal information.

Page translation starts after you enable it, or on exact hostnames you add to the auto-translate list. It processes content near the viewport as you scroll. Default selection mode waits for a click; optional instant selection and Alt-hover modes submit selected/hovered passages. Editable fields, standalone code blocks, navigation, hidden content, and explicitly excluded content are skipped by automatic page translation. Review sensitive text before submitting it manually.

## What stays in the browser

- Settings and API credentials: extension-origin IndexedDB. They are not browser-synced and are never returned to content scripts or website JavaScript. The credential is not encrypted against someone who controls your OS account/browser profile.
- Translation cache: up to approximately 4 MB for 7 days, keyed by a hash of source text and translation settings. Values contain translated text; translations can contain personal information. Disable or clear this cache in Preferences. Incognito requests do not write to the persistent cache.
- Workspace drafts: not automatically persisted. Text explicitly opened from a selection is briefly transferred through browser session storage and removed when the workspace consumes it. Pasted/imported text stays in that tab unless submitted to the API.

## Your controls

Preferences can be exported to a local JSON file on explicit request. The default export excludes the API key; it can still contain private glossary entries, provider addresses, and website rules. Optionally include the key in a password-encrypted backup (AES-256-GCM with a random salt/IV and PBKDF2-SHA256, 310,000 iterations). Encryption and decryption run locally. The passphrase is not saved or recoverable. Imported files fill a draft and take effect only after saving; plaintext imports containing keys are rejected. Backups omit caches, workspace drafts, browser permissions, and shortcuts. No file is uploaded to a migration service.

The optional agent installer downloads releases and checksums from GitHub. GitHub receives normal download metadata such as the requesting IP address. The installer does not read browser profiles, API keys, or other apps' settings. During same-folder updates it retains an existing private `bootstrap.json` from older local installations and keeps a local code backup that may also contain that file. Do not upload private installation folders or backups to GitHub.

Change providers, remove the saved key, disable caching, clear cached translations, disable individual sites, or uninstall the extension. Changing the API domain requires entering the new provider's credential; the previous key is not silently reused. Only HTTPS API endpoints and HTTP loopback endpoints are accepted. Redirects are refused and cookies are omitted from API requests.

Browser permissions let the extension inject translation UI into ordinary web pages, use the current tab, offer context-menu commands, and store preferences locally. API host access is requested when you save the chosen endpoint. Broad content-script matches enable selection translation across sites; they do not mean that every page is sent to an API.

Firefox declares `authenticationInfo` and `websiteContent` transmission permissions because translating sends your credential and text to your chosen provider. This declaration is not an assertion that the project collects those data.

Updated: 2026-10-12. Changes to data handling must be documented here before release. Report concerns using [private vulnerability reporting](https://github.com/ZJUZhiyuCai/quiet-translate/security/advisories/new).
