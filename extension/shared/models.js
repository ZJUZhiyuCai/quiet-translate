import {t} from './i18n.js';
import {DEFAULTS, MODEL_ID, endpointURL, validateSettings, throwIfAborted} from './core.js';
import {providerForEndpoint} from './providers.js';

const MAX_BYTES = 4 * 1024 * 1024, MAX_MODELS = 2000, MAX_PAGES = 20;

// Discovery is a temporary draft. A saved credential is reusable only on the exact
// saved base URL, and only when the settings page explicitly asks to use it.
export function modelConnection(draft, saved = DEFAULTS) {
  const endpoint = endpointURL(draft?.endpoint);
  const apiKey = typeof draft.apiKey === 'string' ? draft.apiKey : '';
  const reuse = draft.useSavedKey === true && endpoint === saved.endpoint && saved.authMode !== 'none';
  const connection = validateSettings({endpoint, authMode: draft.authMode, apiKey: apiKey.trim() ? apiKey : reuse ? saved.apiKey : ''});
  if (connection.authMode !== 'none' && !connection.apiKey) throw new Error(t('请先填写此服务的 API 密钥，再获取模型。'));
  return connection;
}

export function modelListPlan(endpoint) {
  const base = endpointURL(endpoint), provider = providerForEndpoint(base);
  // Model Studio's catalog uses its native API on the same regional host.
  // Never derive a new host from an API key or follow a server-supplied next URL.
  if (provider?.id === 'qwen' || provider?.id === 'qwen-intl') {
    return {kind: 'qwen', url: new URL('/api/v1/models', base).href};
  }
  return {kind: 'openai', url: base + '/models'};
}

function modelItems(payload, kind) {
  const items = kind === 'qwen' ? payload?.output?.models : payload?.data;
  if (payload?.error || payload?.success === false || !Array.isArray(items)) throw new Error(t('此接口未返回兼容的模型列表，可以继续手动填写。'));
  return items;
}

export function normalizeModels(items) {
  const unique = new Map();
  for (const item of items) {
    const id = typeof item === 'string' ? item : item?.id ?? item?.model;
    if (typeof id !== 'string' || !MODEL_ID.test(id) || unique.has(id)) continue;
    const output = item.output_modalities ?? item.architecture?.output_modalities ?? item.inference_metadata?.response_modality;
    if (Array.isArray(output) && !output.some(v => String(v).toLowerCase() === 'text')) continue;
    // Unknown capabilities remain selectable;
    // a catalog listing is not proof of account access or Chat Completions support.
    const name = typeof item.name === 'string' ? item.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160) : '';
    unique.set(id, {id, name: name === id ? '' : name});
    if (unique.size >= MAX_MODELS) break;
  }
  return [...unique.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function readJSON(response, budget, signal) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error(t('此接口未返回兼容的模型列表，可以继续手动填写。'));
  const decoder = new TextDecoder(); let text = '';
  try {
    if (Number(response.headers.get('content-length')) > budget.remaining) throw new Error(t('模型列表过大，请手动填写模型 ID。'));
    while (true) {
      throwIfAborted(signal);
      const {value, done} = await reader.read();
      if (done) break;
      budget.remaining -= value.byteLength;
      if (budget.remaining < 0) throw new Error(t('模型列表过大，请手动填写模型 ID。'));
      text += decoder.decode(value, {stream: true});
    }
    text += decoder.decode();
    try { return JSON.parse(text); }
    catch { throw new Error(t('此接口未返回兼容的模型列表，可以继续手动填写。')); }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

function discoveryHTTPError(status) {
  if ([404, 405, 501].includes(status)) return new Error(t('此服务不支持获取模型列表，请手动填写模型 ID。'));
  if ([401, 403].includes(status)) return new Error(t('无法读取模型列表，请检查密钥或权限；也可继续手填。'));
  if (status === 429) return new Error(t('模型列表请求过于频繁，请稍后重试或手动填写。'));
  return new Error(t('获取模型失败（{0}），可重试或手动填写。', status));
}

export async function fetchModels(connection, {signal, fetcher = fetch, timeoutMs = 12000} = {}) {
  const plan = modelListPlan(connection.endpoint), controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), timeoutMs);
  const budget = {remaining: MAX_BYTES}, all = []; let partial = false;
  const headers = {Accept: 'application/json'};
  if (connection.authMode !== 'none') headers.Authorization = 'Bearer ' + connection.apiKey;
  try {
    throwIfAborted(signal);
    for (let page = 1; page <= MAX_PAGES; page++) {
      throwIfAborted(controller.signal);
      const url = new URL(plan.url);
      if (plan.kind === 'qwen') {
        url.searchParams.set('capabilities', 'TG'); url.searchParams.set('page_size', '100'); url.searchParams.set('page_no', String(page));
      }
      const response = await fetcher(url.href, {method: 'GET', headers, signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer'});
      if (!response.ok) { await response.body?.cancel().catch(() => {}); throw discoveryHTTPError(response.status); }
      const payload = await readJSON(response, budget, controller.signal), items = modelItems(payload, plan.kind);
      const remaining = MAX_MODELS - all.length;
      all.push(...items.slice(0, remaining));
      const more = plan.kind === 'qwen' ? Number(payload.output.total) > all.length : payload.has_more === true;
      partial = more || items.length > remaining;
      if (!more || !items.length || plan.kind !== 'qwen' || all.length >= MAX_MODELS) break;
    }
    throwIfAborted(controller.signal);
    return {models: normalizeModels(all), partial};
  } catch (error) {
    if (controller.signal.reason?.name === 'TimeoutError') throw new Error(t('获取模型超时，可重试或继续手动填写。'));
    if (error instanceof TypeError) throw new Error(t('暂时无法获取模型，请检查网络或接口地址；也可手动填写。'));
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
