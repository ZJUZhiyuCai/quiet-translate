# Browser support & installation

The release contains two builds from the same source. They use browser Promise APIs and distinct Manifest V3 background configurations. No account with this project is needed.

| Browser | Package | v1.4.0 validation on Windows, 2026-10-13 |
|---|---|---|
| Chrome | `chromium.zip` | 154.0.8037.99: 24 stress/interaction + 12 structural + 28 frontend + 16 installation/migration + 30 provider/Mac-label + 33 model-discovery checks passed |
| Edge | `chromium.zip` | 156.0.4314.15: the same 143 checks passed |
| Comet | `chromium.zip` | 139.1.7258.19069: the same 143 checks passed; live model/site testing also recorded |
| Brave | `chromium.zip` | Chromium-compatible build; not independently run in this release |
| Firefox desktop | `firefox.zip` | 157.0.1: 14 end-to-end checks passed, including model discovery, onboarding, streaming, page restoration, and long text |
| Safari | None yet | Requires a separate macOS/Xcode packaging and validation pass |
| Mobile browsers | None claimed | Touch selection, layout, and background lifecycle have not been validated |

Chromium minimum: 120. Firefox minimum: 142. Modern desktop versions are recommended. Linux CI runs additional browser checks; macOS is not yet independently validated. Store submission and signing are separate from a working developer build.

## Agent installation (recommended)

Give your desktop agent the repository link and follow [INSTALL.md](../INSTALL.md). It includes checksum-verified file preparation, browser loading, one-action API setup, updates, rollback, and encrypted migration. No store submission is planned; browser confirmations and the Firefox temporary-installation limitation still apply. Manual steps follow.

## Chromium: Chrome, Edge, Brave, Comet

1. Download the Chromium ZIP from [Releases](https://github.com/ZJUZhiyuCai/quiet-translate/releases/latest) and extract it into a permanent folder.
2. Open your browser's Extensions page: `chrome://extensions` in Chrome/Comet, `edge://extensions` in Edge, or `brave://extensions` in Brave.
3. Enable Developer mode, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.
4. Preferences opens on first installation. Choose a provider preset and enter your own API key. Fetch and select a model from the editable dropdown, or type its ID; custom endpoints remain available. Click **Save & test connection** and allow the requested API host.
5. Pin the extension if desired. Refresh pages that were already open before installation.

To update, prefer the agent installer with `--directory` pointing to the existing loaded folder; it verifies the package, preserves a private bootstrap if present, and creates a rollback backup. Then click Reload on the same extension card and refresh existing pages. Manual updates may replace the public files in that same folder, retaining any private `bootstrap.json`. Keep the installation folder in place. The public ZIP has no credentials and will not configure an account for you.

## Firefox desktop

1. Extract the Firefox ZIP.
2. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**.
3. Select the extracted `manifest.json`, then configure your API in Preferences.

This release is **unsigned**. Temporary add-ons are removed when Firefox restarts. Persistent consumer installation requires Mozilla signing/AMO distribution; it is not included or claimed here. Do not disable browser signature verification. Development instructions follow [Mozilla's temporary-installation documentation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).

Firefox's build uses module background scripts because Firefox does not implement MV3 `background.service_worker` as Chromium does. See [MDN background compatibility](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background). Data-transmission categories are declared according to [Firefox's built-in consent requirements](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

## Limitations

Browser internal pages, extension stores, some protected pages, built-in PDF viewers, canvas-rendered text, and cross-origin frames cannot be treated as ordinary article pages. Use the text workspace for copied text. Layout testing covers the documented fixtures and public pages, not every site. An extension changes page height when adding translations; the layout promise is to preserve original content and reading structure, not to keep every element at its previous vertical position.

Shortcuts may be reserved by the OS, browser, or another extension. Change them in the browser's extension shortcut manager. On macOS, Alt is **⌥ Option**; the UI now displays the matching key names, including in hover/selection hints. The workspace supports Cmd+Enter as well as Ctrl+Enter, but macOS interaction testing remains open.
