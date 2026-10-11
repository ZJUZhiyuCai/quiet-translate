# Release validation — 1.1.0

Date: 2026-10-12, Windows. Public packages contain an empty bootstrap. Automated browser tests use disposable profiles, dummy credentials, and a local SSE server. Live-provider tests are separately identified; mock timings are never presented as model speed.

## Release checks

- 30 Node tests: Unicode-safe lossless splitting, source limits, scheduler capacity/priority, request deduplication, independent cancellation, ordered streaming, SSE boundaries, incomplete/truncated streams, HTTP retries, credential redaction, provider-domain changes, keyless loopback restrictions, optional API parameters, and UI localization.
- Extension syntax, CSP, manifest/resource checks; Firefox add-on linter: zero errors, warnings, or notices.
- Reproducible ZIPs, exact public-source file lists, empty bootstraps, version alignment, and SHA-256 checksums.
- Development dependency audit: zero known vulnerabilities at release verification time. There are no runtime dependencies.

## Browser runs

| Browser | Version | Result |
|---|---|---|
| Chrome | 154.0.8037.99 | 24 interaction/stress checks + 12 structural regressions |
| Edge | 156.0.4314.15 | Same 36 checks |
| Comet | 139.1.7258.19069 | Same 36 checks |
| Firefox | 157.0.1 | 9 end-to-end checks: install, onboarding, credential projection, save/probe, original DOM preservation, exclusions, selection, restore, long text |

Chromium tests cover dynamic paragraphs, source edits, 1,000 inserted paragraphs, viewport demand, cancellation, 401 handling, hostile HTML rendered as plain text, 60,000-character input, concurrency, site rules, trust boundaries, popup controls, command registration, and cache clearing. Structural regressions cover inline API identifiers, global navigation versus article headings, legacy double-br paragraphs, preserved DOM identity, theme changes, updates, and cleanup.

In the local mock runs, inserting 1,000 distant paragraphs produced zero additional requests in the approximately 1.2-second observation window. There were 12–13 translated blocks, with no observed main-thread task over 100 ms in those samples. The 60,000-character mock input completed 40 chunks in about 7.8 seconds. This demonstrates bounded work and interface capacity, not real-provider translation throughput.

## Bug found while porting

Firefox requires the `requestIdleCallback` receiver to be the window. The original unbound call could enable bilingual mode without discovering paragraphs. Binding the callback fixed the issue; the Firefox page/restore integration now exercises this path.

## Live model / real websites

[The 1.0.1 real-web report](REAL-WEB-QA.md) records exact URLs, seven short-selection measurements, full-article selection, a 7,167-character test, viewport geometry, source/link identity, and limitations. It used GLM 5.3 Flash through an OpenAI-compatible provider. These older measurements remain explicitly versioned rather than being relabeled as a new benchmark.

The 1.1.0 source also passed 17 live-provider browser checks on the original Fieldnotes fixture: page and selection translation, shared cache, pin/Esc behavior, source/link identity, 3,237-character / 16-numbered-passage completion (5.3 seconds in this run), cache reuse, 430 px workspace/settings layouts, and credential isolation. This is an additional sample, not a statistical comparison to 1.0.1. Public screenshots show that original fixture; no personal pages or credentials are included.

## Reproduce

```sh
npm ci
npm run verify
npm run lint:firefox
python scripts/verify_package.py
npm run test:chromium
npm run test:firefox
```

Set `QT_CHROMIUM_BINARY`, `QT_FIREFOX_BINARY`, or `QT_GECKODRIVER` as needed. See [CONTRIBUTING](../CONTRIBUTING.md). Private browser profiles, real API keys, and personal screenshots are excluded from Git. Failure screenshots and logs are saved under ignored `output/playwright/`.

Brave, macOS, Safari, mobile browsers, all websites, all models, and store installation are not claimed as verified. Keyboard registration is checked in Chromium; native mouse selection/shortcuts were separately checked in Comet during the local pre-release. Browser automation mostly exercises the same message routes through controlled fixtures.
