<p align="center"><img src="extension/icons/128.png" width="64" alt="Quiet Translate leaf icon"></p>

# Quiet Translate · 轻译

**The original in sight. Translation just below.**

A small, open-source browser extension for bilingual reading, selection translation, and long text. Bring your own OpenAI-compatible API, or connect a localhost model. No project account. No telemetry. No runtime dependencies.

English · [简体中文](README.zh-CN.md)

[![CI](https://github.com/ZJUZhiyuCai/quiet-translate/actions/workflows/ci.yml/badge.svg)](https://github.com/ZJUZhiyuCai/quiet-translate/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-397965.svg)](LICENSE)

[**Download v1.2.0**](https://github.com/ZJUZhiyuCai/quiet-translate/releases/latest) · [Installation](docs/BROWSERS.md) · [Connect your API](docs/PROVIDERS.md) · [Report a bug](https://github.com/ZJUZhiyuCai/quiet-translate/issues/new/choose)

![Bilingual reading on an original demo article](docs/assets/bilingual.png)

## Read without losing your place

- **Bilingual pages.** Keep the original text and links; add translations underneath. Only nearby passages enter the translation queue. Restore the page in one action.
- **Selection and hover.** A small button appears after selection. Stream into a compact card, pin it, copy, or open it in the workspace. Hold Alt over a paragraph to translate just that passage.
- **Room for long text.** Up to 60,000 characters, automatic chunking, ordered streaming, cancellation, TXT/Markdown import, and bilingual text export. Original and translation sit side by side in wide windows and stack in narrow ones.
- **Your API.** URL presets for OpenAI, DeepSeek, OpenRouter, SiliconFlow, and local Ollama. Custom compatible endpoints work too. Enter your own model and key; provider charges apply.
- **Quiet by default.** No permanent floating button. Three translation styles, light/dark themes, glossary, per-site controls, and a local cache. Chinese/English UI; 12 target languages.

Version **1.2.0** adds serif reading text, clearer system controls, and better Chinese/English input typography. It uses fonts already on your device; inline page translations keep the website's own typeface. [What's changed →](CHANGELOG.md)

### Translate a passage, keep your place

The selection card keeps the source nearby. Pin it while reading, copy the translation, or expand it into the workspace.

![v1.2.0 English selection card, pinned below the original paragraph](docs/assets/selection-en.png)

### Give longer text some room

Import or paste text, watch the translation arrive, and export both languages together. The main action stays visible in narrow windows too.

![v1.2.0 English workspace with original English text and Chinese translation](docs/assets/workspace-en.png)

Screenshots show the actual v1.2.0 interface with an authored demo article and fixed sample translations replayed locally. Selection and workspace show completed cache hits, not API speed measurements. [Image sources and reproduction →](docs/assets/README.md)

## Install

| Browser | Install |
|---|---|
| Chrome, Edge, Comet | Download the **Chromium ZIP**, extract, enable Developer mode in Extensions, then **Load unpacked** |
| Brave | Use the Chromium ZIP; this release has not been independently tested in Brave |
| Firefox desktop | Download the **Firefox ZIP**, extract, open `about:debugging`, and **Load Temporary Add-on** → `manifest.json` |

The first installation opens Preferences. Enter the **API base URL, model ID, and your key**, save, allow the API host, then test the connection. Refresh pages already open before installation.

**Updating an unpacked Chromium installation?** Extract the new version into the same folder, click **Reload** on its extension card, then refresh the pages you want to translate. Keeping the original installation preserves its saved API configuration and preferences.

These are developer packages. Firefox is **unsigned and temporary until browser restart**. No store listings or Safari build are claimed. See the [tested browser/version matrix and update instructions](docs/BROWSERS.md).

## Everyday shortcuts

| Action | Shortcut |
|---|---|
| Bilingual page / restore original | Alt+T |
| Translate selected text | Alt+Q, or the selection button |
| Translate one paragraph | Hover and hold Alt |
| Open text workspace | Alt+L |
| Translate in workspace | Ctrl+Enter / Cmd+Enter |
| Close selection card | Esc |

Change conflicting shortcuts in your browser's extension shortcut manager.

## Speed and verification

Four requests maximum, with capacity reserved for selections. Identical requests share work; cached results skip the network. Later long-text chunks wait for earlier chunks so visible output grows in order.

In the **October 12, 2026** live sample with GLM 5.3 Flash, five selections across MDN, Wikipedia, and Paul Graham had **1.344 s median time to first text**, with cache disabled. A 7,167-character workspace sample completed in **11.073 s**. This sample preceded the final typography refinement; it is not a controlled comparison or a speed guarantee. [Measurements and limits →](docs/FRONTEND-QA.md#live-api-sample)

For v1.2.0, Chrome, Edge, and Comet each passed **64 checks**; Firefox passed **9 end-to-end checks**. Coverage includes layout, selection positioning, settings races, and light/dark contrast. Node tests and reproducible-package checks also pass. [Frontend validation →](docs/FRONTEND-QA.md) · [Earlier stress and protocol checks →](docs/QA.md)

## Privacy

Translation sends text to **your configured provider**. The project runs no translation proxy and collects no analytics. API keys stay in extension-origin storage, are never exposed to page/content scripts, and are not synced. Changing provider domains requires a new key. Cache can be disabled or cleared; incognito requests do not write persistent translations. [Full data flow and limitations →](PRIVACY.md)

## Build & contribute

Node.js 22+ and Python 3.10+:

```sh
npm ci
npm run verify
npm run lint:firefox
npm run test:chromium
npm run test:firefox
```

Browser tests use isolated profiles and a dummy localhost API. `QT_CHROMIUM_BINARY`, `QT_FIREFOX_BINARY`, and `QT_GECKODRIVER` can select executables. ZIPs and SHA-256 checksums are generated in `dist/`. See [CONTRIBUTING](CONTRIBUTING.md) for setup and architecture, [SECURITY](SECURITY.md) for private reports, and the [roadmap](docs/ROADMAP.md) for what comes next.

## Inspiration

Vertical bilingual reading and focused selection translation are useful ideas demonstrated by [Immersive Translate](https://immersivetranslate.com/en/). [TWP](https://github.com/FilipePS/Traduzir-paginas-web) is another established reference for page-translation workflows. Quiet Translate independently implements a small BYO-API reading tool; it is not affiliated with either project. No third-party extension source was copied.

The separation of interface, input, and reading fonts draws on [DSH Ivory](https://github.com/ZJUZhiyuCai/dsh-ivory). [Typography details →](docs/FRONTEND-QA.md#typography-refinement)

[MIT](LICENSE). Demo articles and translations are included in the repository; screenshots contain no personal browsing content or credentials.
