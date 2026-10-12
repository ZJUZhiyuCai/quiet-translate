# Roadmap

This is a working first public release. A useful reading tool earns trust through compatibility, transparent behavior, and careful maintenance; a release does not make it a mature ecosystem overnight.

## Now: agent-first distribution

- Distribute stable, checksum-verified releases through the [agent installation workflow](../INSTALL.md). No browser-store submissions are planned for the current distribution strategy.
- Keep one-action onboarding, same-folder updates, code rollback, and explicit encrypted migration reliable. Add regressions from real installation failures.
- Keep the unsigned Firefox package clearly marked as temporary until restart; agent automation does not replace Mozilla signing.
- Record macOS and Brave runs using the same fixtures; fix platform shortcut/permission issues before upgrading support claims.

Completion means an agent can distinguish prepared files, an enabled browser installation, and a verified API connection, and can update without losing the user's configuration. Browser-enforced confirmations remain visible and honest.

## Then: improve reading quality from real reports

- Turn high-quality public layout bug reports into small fixture regressions.
- Extend internationalization/accessibility review: keyboard-only flows, screen-reader announcements, and more UI locales without expanding runtime dependencies.
- Add opt-in, user-run benchmarks for cold/warm latency and long text; collect no passive usage telemetry.
- Evaluate terminology consistency across chunks and native provider adapters only when the benefit is clear. Keep cancellation, cost visibility, and credential boundaries intact.

## Later: Safari and mobile

Safari needs a macOS/Xcode conversion, signing/distribution plan, and independent testing. Mobile needs touch-selection and background-lifecycle design. Neither should be announced as supported from a desktop manifest conversion alone.

## Release criteria

A release should pass Node tests, browser regressions, package reproducibility checks, and manifest linting; explain changed permissions/data handling; include checksums and a changelog; and mark any untested platforms or incomplete store distribution explicitly. Changes that regress original content, links, or selection responsiveness block release.
