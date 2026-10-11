# Changelog

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
