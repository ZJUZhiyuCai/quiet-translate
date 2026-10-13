// Public configuration only. Reviewed against the linked official docs on 2026-10-12.
// Selecting a preset fills a draft; it never retrieves credentials or contacts a provider.
const preset = (id, name, endpoint, model, docs, hint, extra = {}) => Object.freeze({
  id, name, endpoint, model, docs, hint, group: '国产服务',
  tokenParameter: 'max_tokens', authMode: 'bearer', reasoningEffort: 'default', ...extra,
});
export const PROVIDERS = Object.freeze([
  preset('deepseek', 'DeepSeek', 'https://api.deepseek.com', 'deepseek-flash',
    'https://api-docs.deepseek.com/', '已填入翻译起始模型，可按账户权限修改。',
    {reasoningEffort: 'none', aliases: ['https://api.deepseek.com/v1'], thinking: 'thinking'}),
  preset('glm', '智谱 GLM', 'https://open.bigmodel.cn/api/paas/v4', 'glm-5.3-flash',
    'https://docs.bigmodel.cn/cn/guide/models/vlm/glm-5.3-flash', 'GLM 5.3 Flash 保留必要思考，预设为较低推理强度。',
    {reasoningEffort: 'low', thinking: 'thinking'}),
  preset('qwen', '通义千问 · 北京', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen3.8-flash',
    'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope', '请使用北京地域的百炼 API 密钥；也可替换为业务空间专属地址。',
    {reasoningEffort: 'low', thinking: 'enable_thinking'}),
  preset('qwen-intl', '通义千问 · 新加坡', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', 'qwen3.8-flash',
    'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope', '请使用新加坡地域的百炼 API 密钥；北京密钥不能混用。',
    {reasoningEffort: 'low', thinking: 'enable_thinking'}),
  preset('moonshot', 'Kimi · 月之暗面', 'https://api.moonshot.cn/v1', 'kimi-k2.6',
    'https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart', 'Kimi K2.6 预设关闭深度思考，适合直接翻译。',
    {reasoningEffort: 'none', thinking: 'thinking'}),
  preset('minimax', 'MiniMax', 'https://api.minimax.cn/v1', 'MiniMax-M3',
    'https://platform.minimaxi.com/docs/api-reference/text-openai-api', 'MiniMax M3 预设直接回答；思考内容与译文分开。',
    {reasoningEffort: 'none', thinking: 'thinking', aliases: ['https://api.minimaxi.com/v1']}),
  preset('siliconflow', '硅基流动 · SiliconFlow', 'https://api.siliconflow.cn/v1', 'deepseek-ai/DeepSeek-V4-Flash',
    'https://docs.siliconflow.cn/docs/api/chat-completions-post', '模型名包含厂商前缀，请保留完整名称。',
    {reasoningEffort: 'none', thinking: 'enable_thinking'}),
  preset('doubao', '豆包 · 火山方舟', 'https://ark.cn-beijing.volces.com/api/v3', '',
    'https://docs.volcengine.com/docs/ark/online-inference-standard?lang=zh', '填写已开通的 Model ID，或你自己的 ep- 接入点 ID。',
    {modelPlaceholder: 'Model ID 或 ep- 接入点 ID', thinking: 'thinking'}),
  preset('openai', 'OpenAI', 'https://api.openai.com/v1', '',
    'https://platform.openai.com/docs/api-reference/chat/create', '填写账户中可用的 Chat Completions 模型。',
    {group: '其他服务', tokenParameter: 'max_completion_tokens'}),
  preset('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', '',
    'https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request', '填写完整模型 ID，例如厂商名/模型名。', {group: '其他服务'}),
  preset('local', 'Ollama / 本机服务', 'http://localhost:11434/v1', '',
    'https://docs.ollama.com/openai', '填写本机已安装的模型名；请先启动 Ollama，无需 API 密钥。',
    {group: '本机服务', authMode: 'none'}),
]);

export function providerForEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
    if (url.username || url.password || url.search || url.hash) return;
  } catch { return; }
  const normalized = url.href.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  const known = PROVIDERS.find(provider => [provider.endpoint, ...(provider.aliases || [])].includes(normalized));
  if (known) return known;
  // Documented workspace domains; never match arbitrary subdomains or gateways.
  if (url.protocol === 'https:' && !url.port && /^\/compatible-mode\/v1(?:\/chat\/completions)?\/?$/.test(url.pathname)) {
    if (/^[a-z0-9-]+\.cn-beijing\.maas\.aliyuncs\.com$/.test(url.hostname)) return PROVIDERS.find(p => p.id === 'qwen');
    if (/^[a-z0-9-]+\.ap-southeast-1\.maas\.aliyuncs\.com$/.test(url.hostname)) return PROVIDERS.find(p => p.id === 'qwen-intl');
  }
}

export function providerParameters(settings) {
  const provider = providerForEndpoint(settings.endpoint), result = {};
  const effort = settings.reasoningEffort;
  if (effort === 'none' && provider?.thinking) {
    if (provider.thinking === 'thinking') result.thinking = {type: 'disabled'};
    else result.enable_thinking = false;
  } else if (effort && effort !== 'default') result.reasoning_effort = effort;
  // MiniMax can otherwise mix <think> text into content. Keep only visible translation.
  if (provider?.id === 'minimax') result.reasoning_split = true;
  return result;
}

// Keep the settings picker and its speed test on the same reasoning dialect.
export function settingsForModel(settings, model) {
  const provider = providerForEndpoint(settings.endpoint);
  const reset = provider && model !== provider.model && settings.reasoningEffort === provider.reasoningEffort;
  return {...settings, model, reasoningEffort: reset ? 'default' : settings.reasoningEffort};
}
