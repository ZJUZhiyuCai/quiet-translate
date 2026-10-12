# Model discovery · v1.4.1

Validated on October 13, 2026. Configuration now supports automatic model discovery after key input, a searchable editable dropdown, and manual fallback. [Provider behavior and official references](PROVIDERS.md#model-discovery).

## Results

- **50 Node tests** and **9 Python installer tests** passed. Eleven new protocol tests verify draft validation, exact-endpoint saved-key reuse, same-host URLs, catalog normalization, GET headers/no redirects/no cookies, keyless localhost, Model Studio pagination, safe errors, empty/malformed lists, response bounds, cancellation and timeouts.
- **Chrome 154.0.8037.99, Edge 156.0.4314.15 and Comet 139.1.7258.19069** on Windows each passed **144 browser checks**: the existing 110 checks plus 34 model-discovery checks. Comet ran in Chinese; Chrome and Edge ran in English.
- **Firefox 157.0.1** passed **14 end-to-end checks**, including unsaved-key automatic discovery, filtered and inert model names, keyboard selection, unsupported-list manual fallback, saved connection testing, migration, bilingual restoration, selection and long text.
- Firefox packaging lint: zero errors, warnings or notices. Browser archives have exact public source contents, an empty bootstrap, reproducible SHA-256 hashes, and a source-matched agent installer.

## New UI coverage

Browser checks verify that opening Preferences does not fetch models; explicit refresh can use the saved credential without exposing it; entering a key debounces to one GET; discovery and selection do not persist drafts; a slow response cannot overwrite typed text; changing a key aborts the old request; changing a destination never auto-sends the previous draft key; and unsupported, unauthorized, malformed or empty lists preserve manual entry.

The permission-denial branch is exercised with a scoped test double in the isolated settings page. Automatic discovery does not request permission, and the explicit permission button invokes its request during a user gesture. Actual browser host access is still independently checked in the extension background. A real content-script caller is rejected from the model-discovery port.

The editable dropdown supports keyboard search, active-option accessibility, Enter selection, Escape dismissal and manual IDs. Long IDs fit at 360 px and 1360 px in both themes; the list opens upward when needed to remain above the fixed save bar. Remote names containing HTML stay literal text. Resizing preserves the filtered list and highlighted keyboard choice, including a resize between ArrowDown and Enter. Selected models survive saving and reload without displaying the key.

## Reproduce

```sh
npm run verify
npm run lint:firefox
python scripts/verify_package.py
npm run test:chromium
npm run test:firefox
npm run docs:screenshots
```

The Chromium runner includes `tests/browser-models.js`. Use `QT_CHROMIUM_BINARY` for Edge/Comet and `QT_BROWSER_LOCALE=zh-CN` for Chinese coverage. Reports and screenshots live in ignored `output/playwright/run-*/` folders. README setup screenshots use a localhost catalog of clearly named `demo-*` models, with no private key or live-provider latency claim.

## Limits

Automated catalog requests use localhost fixtures or captured request mocks, not funded accounts for every provider. Native macOS remains untested. Catalog visibility is not proof of account entitlement, balance or Chat Completions support. Firefox distribution remains an unsigned temporary add-on. Live personal Comet verification is performed after release without publishing the user's credential or model catalog.
