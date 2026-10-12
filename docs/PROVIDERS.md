# Connect your own API

Quiet Translate speaks the **OpenAI-compatible Chat Completions** protocol. It posts to `<base URL>/chat/completions`, requests streaming text, and supports JSON completion fallback. A native Anthropic Messages, Gemini, or OpenAI Responses endpoint is not interchangeable; use a compatible endpoint/gateway if your provider offers one.

Choose a provider, review its filled-in base URL and starting model, then enter your own API key and use **Save & test connection**. Every value remains editable. Presets are drafts until saved; opening settings never replaces an existing custom endpoint or model. No paid service is bundled, and the extension itself does not sell credits.

| Preset | Base URL | Starting model | Official reference |
|---|---|---|---|
| DeepSeek | `https://api.deepseek.com` | `deepseek-flash` | [API documentation](https://api-docs.deepseek.com/) |
| Zhipu GLM / 智谱 | `https://open.bigmodel.cn/api/paas/v4` | `glm-5.3-flash` | [Model and parameters](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-5.3-flash) |
| Qwen / 通义千问 · Beijing | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen3.8-flash` | [OpenAI compatibility and regions](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope) |
| Qwen / 通义千问 · Singapore | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | `qwen3.8-flash` | [Chat parameters](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions/) |
| Kimi / 月之暗面 | `https://api.moonshot.cn/v1` | `kimi-k2.6` | [K2.6 and non-thinking mode](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart) |
| MiniMax | `https://api.minimax.cn/v1` | `MiniMax-M3` | [OpenAI compatibility](https://platform.minimaxi.com/docs/api-reference/text-openai-api) |
| SiliconFlow / 硅基流动 | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V4-Flash` | [Chat Completions](https://docs.siliconflow.cn/docs/api/chat-completions-post) |
| Doubao / 豆包 · 火山方舟 | `https://ark.cn-beijing.volces.com/api/v3` | Enter your enabled Model ID or `ep-` endpoint ID | [Model IDs and endpoint IDs](https://docs.volcengine.com/docs/ark/online-inference-standard?lang=zh) |
| OpenAI | `https://api.openai.com/v1` | Enter your enabled Chat Completions model | [Chat Completions](https://platform.openai.com/docs/api-reference/chat/create) |
| OpenRouter | `https://openrouter.ai/api/v1` | Enter the full provider/model ID | [Chat Completions](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request) |
| Ollama / local | `http://localhost:11434/v1` | Enter an installed model name | [OpenAI compatibility](https://docs.ollama.com/openai) |
| Custom | Your compatible base URL | Your model ID | Your provider's documentation |

Addresses, model names, and parameter choices were reviewed against the linked documentation on **October 12, 2026**. Availability and billing depend on the provider and your account; these are editable starting points, not a guarantee of access or the cheapest model. Doubao and local models deliberately have no invented default ID.

Qwen keys are region-specific. The legacy Beijing/Singapore URLs above remain supported according to Alibaba's documentation; the preferred workspace-specific endpoints are also recognized when entered manually. Never mix a Beijing key with a Singapore endpoint. Other regions can use Custom.

Presets do not scan other applications for credentials, retrieve model lists, or make network requests merely when selected. Switching presets clears any unsaved key input. A previously saved key can be retained only on the same origin; a different origin requires that service's credential. Existing custom gateways are not relabeled as official services.

Live paid-provider validation has used GLM 5.3 Flash through a compatible gateway. Other presets are verified against official documentation, captured request bodies, and isolated browser form tests; they have not all been tested with funded accounts.

## Compatibility controls

- **Reasoning effort** defaults to provider behavior for custom connections. DeepSeek, Kimi K2.6 and MiniMax M3 presets turn thinking off through `thinking.type`; SiliconFlow uses `enable_thinking`. GLM 5.3 Flash requires thinking, so its preset uses `reasoning_effort: low`. Qwen 3.8 Flash also starts at low effort. **Thinking off** maps to the documented provider dialect only on recognized endpoints; custom endpoints receive standard `reasoning_effort: none`. If you change to a model with different capabilities, choose **Service default** or the parameter supported by that model. Unsupported parameters typically produce HTTP 400.
- MiniMax requests set `reasoning_split: true`, keeping reasoning separate from visible translated text. Only visible `content` is displayed; `reasoning_content` is not treated as translation.
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
