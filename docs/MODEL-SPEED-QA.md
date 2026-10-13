# Model speed tests — v1.5.0

Validated on October 13, 2026. Speed tests compare a short translation request using the user's own endpoint, credential and candidate models. They are opt-in and can incur provider usage charges.

## What is measured

- One fixed English sentence per model, translated into the selected target language. No article, workspace draft or private glossary is included.
- First-text latency starts when the request is dispatched, excluding the local scheduler queue. It ends at the first non-whitespace visible content. Role events, HTTP headers and reasoning deltas do not count.
- A model is marked available only after a nonempty translation completes. Partial streams, truncated or filtered output, reasoning-only responses and empty responses fail. This verifies a short request with the current parameters, not translation quality or every capability of the model.
- Non-streaming responses show full-response time instead of a fabricated first-token measurement; they sort separately below streaming successes.
- Each probe requests at most 512 output tokens, has a 20-second deadline, reads at most 64 KiB, bypasses cache and makes no automatic retry. Two probes share the translation scheduler at low priority, leaving its selection slot available. A provider may count reasoning tokens within that budget.

## Verification

| Environment | Result |
|---|---|
| Node protocol, settings, transport and scheduler tests | 63 passed, including 13 benchmark tests |
| Python package/installer tests | 9 passed |
| Chrome 154.0.8037.99, Windows | 174 browser checks, including 30 benchmark checks |
| Edge 156.0.4314.15, Windows | Same 174 checks |
| Comet 139.1.7258.19069, Windows, Chinese UI | Same 174 checks |
| Firefox 157.0.1, Windows | 18 end-to-end checks, including 4 benchmark checks |
| Public packages | Syntax/resource/CSP checks, Firefox lint without warnings, exact archive contents and reproducible SHA-256 hashes |

The automated suites use disposable profiles and a localhost fixture with dummy credentials. They exercise the real extension background, port messages, network requests and UI. Fixture delays verify timing semantics; their numbers are not real-provider performance claims. GitHub CI also runs Chromium and Firefox on Linux. macOS UI operation and every paid provider account are not independently validated.

The browser cases cover:

- Model discovery makes no paid translation request; the benchmark is hidden before discovery and displays the candidate count and cost notice before starting.
- Filtering by ID/name, Enter to test, sorting, selecting a successful result as a draft and saving/testing the selected connection.
- Visible-text timing after early reasoning/whitespace events; separate non-streaming time; denial, missing models, rate limits, partial streams and reasoning-only output.
- At most two simultaneous probes, one active batch across settings tabs, Stop aborting the network and queued work, and cancelled models labeled unfinished instead of unavailable.
- Key, endpoint, target and compatibility changes invalidate results. Delayed results from an earlier connection cannot repopulate the table. Keys are never forwarded to a changed destination.
- Results never save a model or key by themselves. The chosen model uses the same tested reasoning setting. Website content scripts cannot open a benchmark port; remote names render as text.
- Chinese/English controls, light/dark themes, desktop tables and 360-pixel comparison cards without horizontal page overflow.

Unit tests additionally exercise invalid-key and depleted-balance stopping, timeout cancellation, response-size limits, bounded candidate lists, provider-specific reasoning parameters and cancellation while waiting behind normal translations. A selection can still start when normal jobs fill the shared scheduler's other slots.

## Interpreting results

One small sample reflects the current network, server queue and reasoning settings. Rerun a small filtered group when results are close. A catalog entry may not support Chat Completions or may need different compatibility parameters. A timeout or failure within this short token budget does not establish that the model can never translate.

Results remain only in the current settings tab. **Use** fills a draft; **Save & test connection** applies it. Stopping or closing the page cancels client requests, but a provider may still bill work it has already processed. See [provider setup](PROVIDERS.md#compare-model-speeds) and [privacy](../PRIVACY.md).
