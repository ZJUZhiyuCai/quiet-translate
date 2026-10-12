import test from 'node:test';
import assert from 'node:assert/strict';
import {PROVIDERS, providerForEndpoint} from '../extension/shared/providers.js';
import {DEFAULTS, validateSettings, publicSettings} from '../extension/shared/core.js';
import {streamTranslation} from '../extension/shared/transport.js';

test('public presets are valid credential-free drafts; manual model IDs stay explicitly empty', () => {
  for (const preset of PROVIDERS) {
    const settings = validateSettings(preset);
    assert.equal(settings.apiKey, '');
    assert.equal(publicSettings(settings).configured, false);
    assert.equal(new URL(preset.docs).protocol, 'https:');
  }
  assert.equal(PROVIDERS.find(p => p.id === 'doubao').model, '');
  assert.equal(PROVIDERS.find(p => p.id === 'local').model, '');
});

test('endpoint recognition is exact and supports documented aliases without matching lookalike gateways', () => {
  for (const preset of PROVIDERS) {
    assert.equal(providerForEndpoint(preset.endpoint + '/chat/completions')?.id, preset.id);
    for (const alias of preset.aliases || []) assert.equal(providerForEndpoint(alias)?.id, preset.id);
  }
  assert.equal(providerForEndpoint('https://workspace-123.cn-beijing.maas.aliyuncs.com/compatible-mode/v1')?.id, 'qwen');
  assert.equal(providerForEndpoint('https://space.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1')?.id, 'qwen-intl');
  for (const endpoint of ['https://api.deepseek.com.attacker.example', 'https://api.minimax.cn/custom', 'https://api.minimax.cn/v1?key=x', 'https://x:y@api.minimax.cn/v1', 'http://api.deepseek.com', 'https://cn-beijing.maas.aliyuncs.com/compatible-mode/v1', 'https://space.cn-beijing.maas.aliyuncs.com.attacker.example/compatible-mode/v1', 'https://api.example/v1', 'invalid']) {
    assert.equal(providerForEndpoint(endpoint), undefined, endpoint);
  }
});

test('preset requests use each provider’s thinking dialect and never send competing controls', async () => {
  const expected = {
    deepseek: {thinking: {type: 'disabled'}}, glm: {reasoning_effort: 'low'},
    qwen: {reasoning_effort: 'low'}, 'qwen-intl': {reasoning_effort: 'low'},
    moonshot: {thinking: {type: 'disabled'}}, minimax: {thinking: {type: 'disabled'}, reasoning_split: true},
    siliconflow: {enable_thinking: false}, doubao: {}, openai: {}, openrouter: {}, local: {},
  };
  for (const preset of PROVIDERS) {
    const settings = {...DEFAULTS, ...preset, model: preset.model || 'user-model', apiKey: 'dummy-key'};
    let body;
    const result = await streamTranslation('Hello', settings, {fetcher: async (url, init) => {
      assert.equal(url, preset.endpoint + '/chat/completions');
      body = JSON.parse(init.body);
      return Response.json({choices: [{message: {content: '你好', reasoning_content: 'not a translation'}, finish_reason: 'stop'}]});
    }});
    assert.equal(result, '你好');
    const controls = Object.fromEntries(Object.entries(body).filter(([key]) => ['thinking', 'reasoning_effort', 'enable_thinking', 'reasoning_split'].includes(key)));
    assert.deepEqual(controls, expected[preset.id], preset.id);
  }
});

test('custom compatible endpoints keep the standard reasoning dialect', async () => {
  await streamTranslation('Hello', {...DEFAULTS, model: 'custom-model', endpoint: 'https://api.example/v1', apiKey: 'dummy', reasoningEffort: 'none'}, {fetcher: async (_, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.reasoning_effort, 'none');
    assert.equal(body.thinking, undefined); assert.equal(body.enable_thinking, undefined); assert.equal(body.reasoning_split, undefined);
    return Response.json({choices: [{message: {content: '你好'}, finish_reason: 'stop'}]});
  }});
});
