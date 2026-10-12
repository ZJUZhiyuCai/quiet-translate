# Changelog

## Unreleased

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
