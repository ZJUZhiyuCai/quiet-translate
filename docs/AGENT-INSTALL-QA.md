# Agent installation and migration validation

Validated on Windows on **2026-10-12** for **v1.3.0**, using isolated browser profiles, dummy credentials, and a localhost test API. No personal credentials appear in reports or screenshots. Repository CI repeats the portable tests on Linux; macOS and Brave browser operation remain unverified.

## Results

| Scope | Result |
|---|---|
| Chrome 154.0.8037.99 | 80 checks: 24 stress, 12 structure/protocol, 28 frontend, 16 onboarding/migration |
| Edge 156.0.4314.15 | Same 80 checks passed |
| Comet 139.1.7258.19069 | Same 80 checks passed, including Chinese interface |
| Firefox 157.0.1 | 10 checks, including fresh setup, one-action connection, encrypted profile round-trip, page/selection/long-text translation |
| Node | 34 tests, including profile validation, encrypted round-trip, wrong password, tampered ciphertext, unsupported metadata, and plaintext-secret rejection |
| Installer | 9 filesystem tests; no skips on this Windows host |
| Packaging | Empty public bootstrap, no new extension permissions, Firefox lint clean, reproducible ZIPs, installer/source checksum match |

## Installation and recovery

The Python tests use temporary directories with spaces and Chinese characters. They cover first install, repeat/idempotence, update at a stable path, preserving a dummy private bootstrap, code backup/rollback, failure during the second directory rename, checksum rejection without changing existing files, unrelated-directory refusal, unsafe ZIP paths, browser-package mismatch, version mismatch, downgrade refusal, malicious rollback pointers, and symlink refusal.

A separate network smoke test downloaded the public **v1.2.0** package through the official GitHub release link, prepared it in an isolated directory, upgraded to the locally built **v1.3.0** package, then rolled code back to **v1.2.0**. The first attempt hit an unauthenticated GitHub API 403; the installer was changed to use the public latest-release redirect. The repeated real download worked without authentication. Hash verification precedes replacement.

The installer deliberately reports `browser_verified: false`. Preparing files, loading/enabling the browser extension, and verifying an API connection are separate states. Browser loading is completed through the agent's available UI tools or an explicit remaining user action. The installer does not alter browser databases, policies, or signature enforcement.

## Onboarding and migration

Chromium browser checks exercise the real settings page and file controls:

- Fresh setup, missing-key feedback, successful Save & test connection, failed provider authentication, and invalidation of a ready state after editing.
- Actual downloads of key-free preferences and encrypted backup files; clearing the export passphrase after success.
- A key-free import staged without altering saved settings; saving it clears the old key even on the same endpoint.
- Wrong-passphrase rejection; encrypted import staged before save; restoration of the exact dummy credential and a working connection after saving.
- A content-script request for credential export is rejected by the background's trusted-extension-page check.
- Migration controls fit at 360 px and 1360 px and focused fields stay above the save bar. Reload preserves saved configuration, hides the key, and does not claim a new connection test.

Backup encryption uses browser Web Crypto: AES-256-GCM, independently random 16-byte salt and 12-byte IV, PBKDF2-SHA256 with 310,000 iterations, and an authenticated format/version label. Imports have fixed derivation parameters and file-size limits. Unit tests reject wrong passwords, tampering, malformed types, unsupported versions, prototype keys, and unsafe endpoints. This is regression coverage, not an independent cryptographic audit.

## Reproduce

```sh
npm ci
npm run verify
npm run lint:firefox
python scripts/verify_package.py
npm run test:chromium
npm run test:firefox
npm run docs:screenshots
```

Select other Chromium binaries with `QT_CHROMIUM_BINARY` and language with `QT_BROWSER_LOCALE`. Use `QT_FIREFOX_BINARY` / `QT_GECKODRIVER` when the binaries are not discoverable. All browser tests use disposable profiles. Local CLI reports and screenshots live under ignored `output/playwright/` directories.

The refreshed README images show v1.3.0 in Comet with authored translations replayed locally. Settings screenshots show an untested localhost demo connection; selection/workspace show real cache hits. They make no live-provider latency claim. See [asset provenance](assets/README.md).

## Limits

Unpacked Chromium installations need developer-mode loading and may show reminders. No silent-install or browser-store availability claim is made. Firefox remains unsigned and temporary until restart. No automatic background updater is added. Same-directory updates preserve the browser's existing extension storage; cross-browser migration transfers preferences and an optionally encrypted key, not caches, drafts, host grants, or shortcuts. Code rollback does not roll back browser-stored settings.
