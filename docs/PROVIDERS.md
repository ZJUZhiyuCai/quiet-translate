# Connect your own API

Quiet Translate speaks the **OpenAI-compatible Chat Completions** protocol. It posts to `<base URL>/chat/completions`, requests streaming text, and supports JSON completion fallback. A native Anthropic Messages, Gemini, or OpenAI Responses endpoint is not interchangeable; use a compatible endpoint/gateway if your provider offers one.

Enter your own model ID and API key. Presets fill the URL and compatibility defaults, not credentials or a guaranteed available model. Copy a model ID from your provider's current documentation/account. No paid service is bundled, and the extension itself does not sell credits.

| Preset | Base URL | Reference |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | [Chat Completions](https://platform.openai.com/docs/api-reference/chat/create) |
| DeepSeek | `https://api.deepseek.com/v1` | [API documentation](https://api-docs.deepseek.com/) |
| OpenRouter | `https://openrouter.ai/api/v1` | [Chat Completions](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request) |
| SiliconFlow | `https://api.siliconflow.cn/v1` | [Chat Completions](https://docs.siliconflow.cn/docs/api/chat-completions-post) |
| Ollama / local | `http://localhost:11434/v1` | [OpenAI compatibility](https://docs.ollama.com/openai) |
| Custom | Your compatible base URL | Your provider's documentation |

These are protocol/URL presets. Live paid-provider validation for the initial release used GLM 5.3 Flash through a compatible gateway; this is not a claim that every model from every listed provider has been tested.

## Compatibility controls

- **Reasoning effort** defaults to provider behavior. Choose Low only when your model supports `reasoning_effort`; some models require reasoning and reject attempts to disable it. Low was used in the recorded GLM tests. Unsupported parameters typically produce HTTP 400.
- **Output token parameter** defaults to `max_tokens`. The OpenAI preset selects `max_completion_tokens`. Select the name supported by your model. No temperature is forced, because some models reject that parameter.
- **Authentication** normally sends a Bearer API key. Keyless mode works only with `localhost` or `127.0.0.1`, and removes any saved key. Your local model must already be installed and running with a compatible endpoint. The extension does not install a local model.
- HTTPS is required outside loopback. The URL may include `/chat/completions`; it is normalized to the base URL. Credentials, query parameters, and fragments in URLs are rejected.

Use **Save & test connection** to save and verify in one action. The separate **Test saved connection** button checks the persisted configuration while preserving any unsaved draft. Tests bypass cache and measure when the first visible translation arrives. Changing domains requires a new credential; the previous service's key is never silently forwarded.

Agents may prepare a [key-free profile](../examples/preferences.json) with the endpoint, model and preferences, then use Preferences → Backup & migration → Import. Importing is a draft until saved. For a full migration, the old installation can export a password-encrypted backup containing the key. See [installation and migration](../INSTALL.md#move-to-another-folder-or-browser).

## Troubleshooting

| Symptom | Check |
|---|---|
| 401/403 | API key, account permissions, model access |
| 402 | Provider balance/quota |
| 404 | Base URL and exact model ID |
| 400 | Reasoning effort and token-parameter compatibility |
| Network error | Host permission, HTTPS URL, connectivity, local-server availability |
| Slow first text | Provider queue, model reasoning, network latency; test a short uncached passage |
| Partial translation | Retry; interrupted/truncated responses are deliberately not marked complete |

There are at most four active API requests, with one slot reserved from normal page/workspace traffic so a selection can start promptly. Long text is split at natural boundaries. Later chunks buffer until earlier chunks finish; the displayed translation grows in order. These design choices reduce avoidable waiting but cannot remove provider latency.
