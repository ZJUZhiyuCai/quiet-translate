import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS} from '../extension/shared/core.js';
import {modelConnection, modelListPlan, normalizeModels, fetchModels} from '../extension/shared/models.js';

const saved = {...DEFAULTS, endpoint: 'https://provider.example/v1', model: 'kept-model', apiKey: 'private-saved-key'};
const draft = {endpoint: saved.endpoint, authMode: 'bearer', apiKey: 'draft-key'};

test('model discovery validates a draft without saving or requiring a model', () => {
  const snapshot = JSON.stringify(saved), connection = modelConnection(draft, saved);
  assert.equal(connection.apiKey, 'draft-key'); assert.equal(connection.model, '');
  assert.equal(JSON.stringify(saved), snapshot);
  assert.throws(() => modelConnection({...draft, apiKey: 'bad\r\nheader'}, saved));
  assert.throws(() => modelConnection({...draft, endpoint: 'https://x:y@example.com/v1'}, saved));
  assert.throws(() => modelConnection({...draft, authMode: 'none'}, saved));
});

test('saved-key reuse is explicit and confined to the exact endpoint', () => {
  for (const patch of [{useSavedKey: false}, {endpoint: 'https://other.example/v1'}, {endpoint: 'https://provider.example/another-path'}]) {
    assert.throws(() => modelConnection({...draft, apiKey: '', useSavedKey: true, ...patch}, saved));
  }
  assert.equal(modelConnection({...draft, apiKey: '', useSavedKey: true}, saved).apiKey, saved.apiKey);
  assert.equal(modelConnection({...draft, useSavedKey: true}, saved).apiKey, 'draft-key');
  assert.equal(modelConnection({...draft, endpoint: 'http://localhost:11434/v1', authMode: 'none'}, saved).apiKey, '');
});

test('discovery paths stay on the selected origin, including regional Model Studio hosts', () => {
  for (const [base, kind, pathname] of [
    ['https://api.deepseek.com', 'openai', '/models'],
    ['https://api.minimax.cn/v1/chat/completions/', 'openai', '/v1/models'],
    ['https://gateway.example/prefix/v1', 'openai', '/prefix/v1/models'],
    ['https://space.cn-beijing.maas.aliyuncs.com/compatible-mode/v1', 'qwen', '/api/v1/models'],
    ['https://dashscope-intl.aliyuncs.com/compatible-mode/v1', 'qwen', '/api/v1/models'],
    ['https://space.cn-beijing.maas.aliyuncs.com.attacker.example/compatible-mode/v1', 'openai', '/compatible-mode/v1/models'],
  ]) {
    const plan = modelListPlan(base);
    assert.equal(plan.kind, kind); assert.equal(new URL(plan.url).origin, new URL(base).origin); assert.equal(new URL(plan.url).pathname, pathname);
  }
});

test('catalog normalization deduplicates IDs, filters explicit non-text output and keeps names inert', () => {
  assert.deepEqual(normalizeModels([
    {id: 'z-model', name: '<img src=x onerror=alert(1)>'}, {id: 'z-model'}, {id: 'a-model'}, {model: 'qwen-model'},
    {id: 'image-only', output_modalities: ['image']}, {id: 'router-image', architecture: {output_modalities: ['image']}},
    {model: 'native-image', inference_metadata: {response_modality: ['Image']}},
    {id: 'native-text', inference_metadata: {response_modality: ['Text']}}, {id: 'bad id'}, {id: 'x'.repeat(121)}, null, {}, 4,
  ]).map(m => [m.id, m.name]), [['a-model', ''], ['native-text', ''], ['qwen-model', ''], ['z-model', '<img src=x onerror=alert(1)>']]);
});

test('model GET sends only draft authentication and never follows redirects or includes cookies', async () => {
  const result = await fetchModels(modelConnection(draft, saved), {fetcher: async (url, init) => {
    assert.equal(url, saved.endpoint + '/models'); assert.equal(init.method, 'GET'); assert.equal(init.body, undefined);
    assert.equal(init.headers.Authorization, 'Bearer draft-key'); assert.equal(init.redirect, 'error');
    assert.equal(init.credentials, 'omit'); assert.equal(init.cache, 'no-store'); assert.equal(init.referrerPolicy, 'no-referrer');
    return Response.json({data: [{id: 'kept-model'}]});
  }});
  assert.deepEqual(result, {models: [{id: 'kept-model', name: ''}], partial: false});
});

test('keyless loopback listing omits Authorization', async () => {
  const connection = modelConnection({endpoint: 'http://localhost:11434/v1', authMode: 'none'}, saved);
  await fetchModels(connection, {fetcher: async (_, init) => {
    assert.equal(init.headers.Authorization, undefined); return Response.json({data: []});
  }});
});

test('Model Studio pagination uses only locally constructed URLs and collects later pages', async () => {
  let count = 0;
  const result = await fetchModels({...saved, endpoint: 'https://space.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'}, {fetcher: async url => {
    const parsed = new URL(url); count++;
    assert.equal(parsed.hostname, 'space.cn-beijing.maas.aliyuncs.com');
    assert.equal(parsed.searchParams.get('capabilities'), 'TG'); assert.equal(parsed.searchParams.get('page_no'), String(count));
    return Response.json({output: {models: [{model: 'qwen-' + count}], total: 2}, next: 'https://evil.example/?key=secret'});
  }});
  assert.equal(count, 2); assert.equal(result.models.length, 2); assert.equal(result.partial, false);
  const emptyPage = await fetchModels({...saved, endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'}, {fetcher: async () => Response.json({output: {models: [], total: 10}})});
  assert.equal(emptyPage.partial, true);
});

test('unknown pagination is disclosed without following remote next URLs', async () => {
  let count = 0;
  const result = await fetchModels(saved, {fetcher: async () => { count++; return Response.json({data: [{id: 'one'}], has_more: true, next: 'https://evil.example'}); }});
  assert.equal(count, 1); assert.equal(result.partial, true);
});

test('unsupported, authentication, rate-limit and invalid responses have safe manual-entry fallbacks', async () => {
  for (const code of [400, 401, 403, 404, 405, 429, 500, 501]) {
    await assert.rejects(fetchModels(saved, {fetcher: async () => new Response('private-saved-key', {status: code})}), error => !error.message.includes(saved.apiKey) && /手|模型/.test(error.message));
  }
  for (const body of ['<html>not an API</html>', '{}', '{"error":"private-saved-key"}', '{"data":{},"message":"private-saved-key"}']) {
    await assert.rejects(fetchModels(saved, {fetcher: async () => new Response(body)}), /兼容/);
  }
  assert.deepEqual((await fetchModels(saved, {fetcher: async () => Response.json({data: []})})).models, []);
});

test('bounded response sizes and model counts avoid unbounded work', async () => {
  await assert.rejects(fetchModels(saved, {fetcher: async () => new Response('x'.repeat(4 * 1024 * 1024 + 1))}), /过大/);
  const result = await fetchModels(saved, {fetcher: async () => Response.json({data: Array.from({length: 2001}, (_, i) => ({id: 'm-' + i}))})});
  assert.equal(result.models.length, 2000); assert.equal(result.partial, true);
  let page = 0;
  const paged = await fetchModels({...saved, endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'}, {fetcher: async () => {
    page++;
    return Response.json({output: {models: Array.from({length: 1500}, (_, i) => ({model: `page-${page}-${i}`})), total: 2000}});
  }});
  assert.equal(paged.models.length, 2000); assert.equal(paged.partial, true);
});

test('timeouts and cancellation stop a request instead of leaving the settings page waiting', async () => {
  const waiting = (_, {signal}) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once: true}));
  await assert.rejects(fetchModels(saved, {fetcher: waiting, timeoutMs: 10}), /超时/);
  const controller = new AbortController();
  const pending = fetchModels(saved, {fetcher: waiting, signal: controller.signal}); controller.abort();
  await assert.rejects(pending, {name: 'AbortError'});
  let requests = 0;
  await assert.rejects(fetchModels(saved, {signal: controller.signal, fetcher: () => { requests++; }}), {name: 'AbortError'});
  assert.equal(requests, 0);
});
