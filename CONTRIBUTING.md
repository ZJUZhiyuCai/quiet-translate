# Contributing

Small, reviewable improvements are welcome. English and Chinese issues/PRs are both fine. Start with a reproducible page-layout bug, a browser regression, an accessibility improvement, or a localization correction.

## Development

Requirements: Node.js 22+ and Python 3.10+. There are no runtime dependencies, bundler, or remote scripts.

```sh
npm ci
npm run verify
npm run lint:firefox
```

Load `extension/` unpacked in a Chromium browser. `npm run package` also builds `dist/chromium/` and `dist/firefox/`, plus deterministic ZIPs and SHA-256 checksums. Load the Firefox manifest through `about:debugging` → This Firefox → Load Temporary Add-on. See [browser support](docs/BROWSERS.md).

For the automated Firefox integration, install Firefox and run `npm run test:firefox`. Selenium Manager resolves the driver; `QT_FIREFOX_BINARY` and `QT_GECKODRIVER` optionally select executables. This test uses a temporary browser profile, dummy key, local fixture, and mock SSE endpoint. It enables geckodriver system access only for that disposable test process so extension pages can be tested. It does not access your normal browser profile or API account.

For Chromium, `npm run test:chromium` drives a fresh profile through Playwright CLI. Set `QT_CHROMIUM_BINARY` to a browser executable to test a particular browser, and `QT_BROWSER_LOCALE` to `zh-CN` or `en-US` to exercise either interface language (English is the default). The suite includes reading/stress tests, real-page structural fixtures, and frontend state/layout regressions. Each run gets a unique output directory so parallel browser runs do not share a profile. All artifacts go into ignored `output/playwright/`. Browser behavior and reproducible cases are documented in [QA](docs/QA.md).

For README images, `npm run docs:screenshots` captures the current interface in isolated English/Chinese profiles using authored localhost demo translations. Review its output before copying images into `docs/assets/`. See [image provenance and reproduction](docs/assets/README.md); keep mock output separate from live-provider performance claims.

## What belongs in a PR

- Describe the user-visible problem and resulting behavior.
- Give a minimal public fixture or public URL. Never include personal browsing content, browser profiles, credentials, or `local-install/`.
- Run relevant checks. Add a regression test for an actual logic/compatibility bug; avoid tests that merely repeat the implementation.
- Preserve source text and original DOM nodes. Keep selection tasks responsive while page/long-text tasks run. Do not add remote fonts, analytics, service accounts, or runtime dependencies without discussion.
- Update docs when permissions, settings, supported browsers, or data handling change.

## Structure

`content.js` owns page discovery, incremental bilingual rendering, and the selection overlay. `background.js` owns messaging and trusted operations. `shared/engine.js` handles chunking, shared requests, cancellation, and cache access; `scheduler.js` reserves capacity for selections; `transport.js` handles compatible chat-completion streams. `shared/locale.js` contains Chinese/English UI translations, applied only to extension-owned UI. `_locales/` localizes browser metadata. Build-time browser differences belong in `scripts/package.py`.

By submitting a contribution, you agree to license it under the project's MIT license. Credit sources, respect third-party licenses, and keep discussions specific and considerate.
