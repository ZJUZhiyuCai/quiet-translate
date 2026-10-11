<p align="center"><img src="extension/icons/128.png" width="64" alt="Quiet Translate leaf icon"></p>

# Quiet Translate · 轻译

**The original in sight. Translation just below.**

A small, open-source browser extension for bilingual reading, selection translation, and long text. Bring your own OpenAI-compatible API, or connect a localhost model. No project account. No telemetry. No runtime dependencies.

English · [简体中文](README.zh-CN.md)

[![CI](https://github.com/ZJUZhiyuCai/quiet-translate/actions/workflows/ci.yml/badge.svg)](https://github.com/ZJUZhiyuCai/quiet-translate/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-397965.svg)](LICENSE)

[**Download v1.1.0**](https://github.com/ZJUZhiyuCai/quiet-translate/releases/latest) · [Installation](docs/BROWSERS.md) · [Connect your API](docs/PROVIDERS.md) · [Report a bug](https://github.com/ZJUZhiyuCai/quiet-translate/issues/new/choose)

![Bilingual reading on an original demo article](docs/assets/bilingual.png)

## Read without losing your place

- **Bilingual pages.** Keep the original text and links; add translations underneath. Only nearby passages enter the translation queue. Restore the page in one action.
- **Selection and hover.** A small button appears after selection. Stream into a compact card, pin it, copy, or open it in the workspace. Hold Alt over a paragraph to translate just that passage.
- **Room for long text.** Up to 60,000 characters, automatic chunking, ordered streaming, cancellation, TXT/Markdown import, and bilingual text export. Incomplete results stay visibly incomplete.
- **Your API.** URL presets for OpenAI, DeepSeek, OpenRouter, SiliconFlow, and local Ollama. Custom compatible endpoints work too. Enter your own model and key; provider charges apply.
- **Quiet by default.** No permanent floating button. Three translation styles, light/dark themes, glossary, per-site controls, and a local cache. Chinese/English UI; 12 target languages.

![Selection translation card](docs/assets/selection.png)

## Install

| Browser | Install |
|---|---|
| Chrome, Edge, Comet | Download the **Chromium ZIP**, extract, enable Developer mode in Extensions, then **Load unpacked** |
| Brave | Use the Chromium ZIP; this release has not been independently tested in Brave |
| Firefox desktop | Download the **Firefox ZIP**, extract, open `about:debugging`, and **Load Temporary Add-on** → `manifest.json` |

The first installation opens Preferences. Enter the **API base URL, model ID, and your key**, save, allow the API host, then test the connection. Refresh pages already open before installation.

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

## Speed, with evidence

Four requests maximum, with capacity reserved for selections. Identical requests share work; cached results skip the network. Later long-text chunks wait for earlier chunks so visible output grows in order.

In the recorded 1.0.1 live-provider sample on MDN, Wikipedia, and Paul Graham, seven short selections had **0.980 s median time to first visible text**, cache disabled. One 7,167-character passage finished in **9.709 s**. These are small, provider/network-specific samples, not a speed guarantee. [Method, individual measurements, and limits →](docs/REAL-WEB-QA.md)

The 1.1.0 release was exercised in Chrome, Edge, Comet, and Firefox, with additional deterministic SSE, cancellation, XSS-as-text, 60,000-character, and 1,000-paragraph tests. [QA report →](docs/QA.md)

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

[MIT](LICENSE). Screenshots use an original fixture written for this project; translations in the demo were generated by the configured model.
