# Provider presets and Mac labels · v1.3.1

Validated on October 12, 2026. Official endpoint/model/parameter sources are linked in [PROVIDERS.md](PROVIDERS.md); no public preset contains a credential.

## Automated checks

- **39 Node tests** and **9 Python installer tests** passed. New cases capture real transport request bodies with a mock fetcher to verify provider-specific thinking parameters, MiniMax reasoning separation, standard behavior for custom gateways, exact endpoint recognition, and credential-free presets.
- **Chrome 154.0.8037.99, Edge 156.0.4314.15, Comet 139.1.7258.19069:** 110 checks each (24 stress, 12 structural, 28 frontend, 16 installation/migration, 30 new provider/platform checks).
- **Firefox 157.0.1:** 10 end-to-end checks passed for installation, initial configuration, encrypted migration, streaming, page restoration, and long text. Firefox packaging lint reports no errors or warnings.
- Both browser archives reproduce byte-for-byte, contain exactly the public extension source, and include an empty bootstrap. The distributed installer matches its audited source and checksum.

## New browser coverage

The provider suite selects every domestic preset in an isolated extension profile with dummy credentials. It verifies the endpoint, model, reasoning choice, cleared draft key, next-field focus, and official help link. Merely selecting a preset sends no provider request and changes no persisted connection. Custom drafts stay editable, workspace-domain recognition preserves model edits, lookalike hosts are rejected, and reloading restores the saved configuration.

Preferences are checked at 360 px and 1360 px in light and dark themes. macOS platform metadata is simulated to check Option in preferences/popup and Command in the workspace. Unit tests cover both Chinese and English shortcut text, including preserving interpolated user text.

**Limits:** these platform-label tests run on Windows; they are not native macOS keyboard, permission, font, or installation validation. Paid-provider availability, latency, and account access are not proven by these mocked checks. Existing live API validation uses the user's configured GLM gateway. No accounts or credentials were obtained for other providers.

## Reproduce

```sh
npm run verify
npm run lint:firefox
python scripts/verify_package.py
npm run test:chromium
npm run test:firefox
```

Use `QT_CHROMIUM_BINARY` to select Edge or Comet and `QT_BROWSER_LOCALE=zh-CN` for Chinese UI coverage. `tests/browser-providers.js` is included in the normal Chromium suite. Unique reports and screenshots are written to ignored `output/playwright/run-*/` directories.
