# Demo assets

## README screenshots

Captured on October 12, 2026 in Comet 139.1.7258.19069 on Windows, using the actual v1.3.0 extension with separate disposable English and Chinese profiles. The page is the original [Fieldnotes fixture](../../tests/fixtures/article.html). Chinese translations are [authored demo text](../../tests/fixtures/readme-translations.json), replayed through a localhost OpenAI-compatible SSE endpoint.

The two **setup** screenshots were refreshed on October 13, 2026 using **v1.4.0 in Chrome 154.0.8037.99**, again in disposable Chinese/English profiles. They show the new model dropdown populated by a localhost GET response containing three `demo-*` IDs. No private key or live-provider catalog was used. Reading, selection and workspace screenshots retain the v1.3.0 capture above.

| Image | Contents |
|---|---|
| `bilingual.png` | English passages with Chinese translations underneath; shared by both READMEs |
| `selection-en.png` / `selection.png` | Pinned selection card with English / Chinese controls, captured with the surrounding source paragraph |
| `workspace-en.png` / `workspace.png` | English / Chinese workspace with a complete translation beside the original |
| `setup-en.png` / `setup.png` | v1.4.0 API settings with model discovery, an editable dropdown and Save & test connection; localhost demo catalog, no live-provider test result |

The model label `demo-replay` identifies this local fixture, not a hosted model or a bundled translation account. Selection and workspace screenshots show real cache hits after the demo responses pass through the extension. No latency label has been edited into the images. These are interface demonstrations, not live-provider output, benchmarks, or customer testimonials. They contain no personal browser tabs, browsing data, or credentials. Fonts depend on the operating system and installed faces.

### Reproduce

After `npm ci`, run:

```sh
npm run docs:screenshots
```

The script uses Playwright CLI and finds an installed Chrome/Chromium, or accepts `QT_CHROMIUM_BINARY` to select a browser such as Comet. It reads no personal profiles or API keys and makes no model-provider requests. Screenshots, a version/locale report, and disposable profiles go into a unique ignored `output/playwright/readme-*/` directory. Review the images, then copy the seven PNGs from its `images/` directory here. The script does not overwrite published assets automatically.

## Frontend QA figures

The other images support [frontend validation](../FRONTEND-QA.md), rather than the README product gallery:

- `frontend-workspace-en.png` and `frontend-workspace-zh-narrow.png` show empty workspace layouts in the final frontend revision before its version number changed from 1.1.1 to 1.2.0. They use a dummy API configuration.
- `typography-before.png` and `typography-after.png` compare the same fixed, authored bilingual specimen before and after the font refinement. Their specimen text is directly seeded for typography inspection; it is not model output.

All demo text and screenshots are provided under the repository's MIT license.
