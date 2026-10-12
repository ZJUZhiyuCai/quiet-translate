# Changelog

## 1.4.1 — 2026-10-13

- Preserve the filtered model list and highlighted choice when the window resizes, so a delayed resize event between Arrow and Enter cannot submit a partial model ID. Reposition the dropdown above the save bar without resetting keyboard navigation.
- Add a real-window resize regression and exercise Firefox's public page-control path, including content-script initialization on newly opened pages.

## 1.4.0 — 2026-10-13

- Enter an API key to fetch model IDs automatically after a short pause, with an explicit permission button when needed. The editable dropdown supports search, arrow keys, Enter and Escape; manual entry remains available for unsupported, empty, denied or failed lists.
- Discover OpenAI-compatible catalogs and paginated Model Studio catalogs on the selected host. Existing model choices and saved credentials are preserved until Save; changing credentials or destinations cancels stale requests. Model lists stay in the current tab.
- Isolate listing in the extension background, reject website callers and redirects, omit cookies, bound response sizes/counts/time, and never expose provider error bodies. Update configuration screenshots and document discovery behavior and its access limitations.

## 1.3.1 — 2026-10-12

- Domestic provider presets for DeepSeek, Zhipu GLM, Qwen (Beijing / Singapore), Kimi, MiniMax, SiliconFlow, and Doubao, with editable model defaults, regional guidance, and official documentation links. Existing saved configurations remain untouched until saved.
- Provider-specific thinking controls for direct translation, low-effort GLM/Qwen defaults, and separated MiniMax reasoning output. No shared API keys or bundled credits.
- macOS UI uses Option and Command in preferences, popup, selection hints, and workspace; Windows/Linux labels stay unchanged.

## 1.3.0 — 2026-10-12

- Agent-first installation guide and a dependency-free Python installer distributed with release checksums. Downloads the official package, verifies it before replacement, keeps a fixed directory and rollback backup, and reports file preparation separately from browser verification. No store account, browser policy edits, or credential scanning.
- One-action **Save & test connection**, with a ready-to-read entry after a successful API probe. Existing saved-only and test-saved actions remain available.
- Portable key-free preferences and optional password-encrypted backups for browser/folder migration. Imports are validated drafts until explicitly saved; a key-free import never silently reuses an existing key. Keys can be exported only by extension pages, never website content scripts.
- Installer failure/recovery tests and Chromium onboarding/migration checks, including narrow-screen layout and content-script isolation; Firefox encrypted backup validation.

## 1.2.0 — 2026-10-12

- Ivory-inspired typography separates system UI, CJK-first input, serif reading, and monospace connection values. Explicit body fonts prevent Chromium extension styles from shrinking the interface; all fonts remain local and inline page translations keep the site's typeface.
- Compact popup and text workspace, with pane-local toolbars, visible primary actions on narrow screens, and a persistent API setup entry.
- Preferences start with the API connection, use matching section navigation, and keep keyboard-focused fields above the save bar. Saving preferences and testing a saved connection have independent feedback; removing a key preserves other unsaved fields and invalidates pending tests.
- Selection cards stay within the viewport while streaming long results, follow their live text selection on page scroll, and remain still when pinned or scrolled internally.
- Clearer secondary text and Chinese/English copy, including isolated light/dark selection typography; 28 additional Chromium frontend regression checks with layout screenshots.

## 1.1.1 — 2026-10-12

- Normalize ZIP member ordering and platform metadata so Windows and Linux builds are byte-for-byte identical. 1.1.0 package contents matched across platforms, but their ZIP metadata/order differed. Translation behavior is unchanged.

## 1.1.0 — 2026-10-12

First public open-source release.

- BYO OpenAI-compatible API, provider URL presets, configurable reasoning/token parameters, and keyless localhost mode.
- Chinese and English interfaces following the browser UI language; 12 translation target languages.
- Separate reproducible Chromium and Firefox packages. Firefox Promise APIs, module background page, explicit data-transmission declarations, and correctly bound idle scanning.
- Fresh-install onboarding, saved-connection test, removable credentials, and protection against silently reusing a key on a different provider domain.
- Preserved-original bilingual pages, selection/Alt-hover translation, cancellable 60,000-character workspace, local cache, and ordered streaming.
- Public CI, browser regression scripts, contribution/security/privacy guidance, and release checksums.

## 1.0.1 — 2026-10-12

Local pre-release: real-page fixes for inline code, article headings versus navigation, double-`br` legacy articles, live theme colors, and stable long-text streaming order. Tested on MDN, Wikipedia, and Paul Graham; see the [recorded report](docs/REAL-WEB-QA.md).

## 1.0.0 — 2026-10-11

Local prototype of bilingual reading, selection translation, and the long-text workspace.
