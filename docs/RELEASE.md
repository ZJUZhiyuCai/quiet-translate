# Release checklist

1. Align versions in `package.json`, `package-lock.json`, and `extension/manifest.json`; update the changelog and browser matrix.
2. Run `npm ci`, `npm run verify`, `npm run lint:firefox`, `python scripts/verify_package.py`, and relevant browser tests. Require CI on the release commit to pass.
3. Inspect the actual ZIP file list and empty `bootstrap.json`; review data/permission changes. Never package a private configured installation, browser profile, or test output directory.
4. Tag the verified commit as `vX.Y.Z`. Attach only the two versioned public ZIPs and `SHA256SUMS.txt` to its GitHub release. Describe unsigned Firefox installation clearly.
5. Verify that the published hashes match local artifacts and that README download links resolve.
6. For stores, submit those audited source builds through the maintainer's publisher accounts and complete each store's own review/signing requirements. GitHub publication does not imply store availability.

Builds contain only bundled extension code and the MIT license. ZIP timestamps/permissions are normalized; dependency code is not bundled. `scripts/verify_package.py` checks exact source contents, browser-specific manifests, version alignment, and deterministic hashes. An initial public release can have a CI commit separate from its implementation; the release tag must include both.
