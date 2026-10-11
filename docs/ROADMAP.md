# Roadmap

This is a working first public release. A useful reading tool earns trust through compatibility, transparent behavior, and careful maintenance; a release does not make it a mature ecosystem overnight.

## Next: make installation ordinary

- Submit the tested Chromium package to Chrome Web Store and Edge Add-ons using the maintainer's publisher accounts.
- Sign and publish the Firefox package through AMO so it survives restart. Keep the developer ZIP available with honest labels.
- Record macOS and Brave runs using the same fixtures; fix platform shortcut/permission issues before upgrading support claims.

Completion means real store links, reproducible submitted builds, and successful first-install/update checks. Publisher registration, store review, signing credentials, and any fees are separate steps; they are not part of the current GitHub release.

## Then: improve reading quality from real reports

- Turn high-quality public layout bug reports into small fixture regressions.
- Extend internationalization/accessibility review: keyboard-only flows, screen-reader announcements, and more UI locales without expanding runtime dependencies.
- Add opt-in, user-run benchmarks for cold/warm latency and long text; collect no passive usage telemetry.
- Evaluate terminology consistency across chunks and native provider adapters only when the benefit is clear. Keep cancellation, cost visibility, and credential boundaries intact.

## Later: Safari and mobile

Safari needs a macOS/Xcode conversion, signing/distribution plan, and independent testing. Mobile needs touch-selection and background-lifecycle design. Neither should be announced as supported from a desktop manifest conversion alone.

## Release criteria

A release should pass Node tests, browser regressions, package reproducibility checks, and manifest linting; explain changed permissions/data handling; include checksums and a changelog; and mark any untested platforms or incomplete store distribution explicitly. Changes that regress original content, links, or selection responsiveness block release.
