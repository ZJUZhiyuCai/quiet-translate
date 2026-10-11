import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS, publicSettings, validateSettings} from '../extension/shared/core.js';
import {streamTranslation} from '../extension/shared/transport.js';

const configured = {...DEFAULTS, apiKey: 'old-provider-secret', model: 'translation-model'};
test('public installation requires a user-supplied model and credential', () => {
  assert.equal(publicSettings(DEFAULTS).configured, false);
  assert.equal(publicSettings({...DEFAULTS, apiKey: 'test-key'}).configured, false);
  assert.equal(publicSettings(configured).configured, true);
});
test('changing provider origin never silently carries the old credential', () => {
  assert.throws(() => validateSettings({endpoint: 'https://different.example/v1', apiKey: ''}, configured), /重新填写/);
  assert.equal(validateSettings({endpoint: 'https://different.example/v1', apiKey: 'new-secret'}, configured).apiKey, 'new-secret');
  assert.equal(validateSettings({endpoint: 'https://different.example/v1', removeKey: true}, configured).apiKey, '');
  assert.equal(validateSettings({endpoint: 'https://api.openai.com/another-path'}, configured).apiKey, configured.apiKey);
});
test('keyless mode is confined to loopback endpoints and clears credentials', () => {
  assert.throws(() => validateSettings({authMode: 'none'}, configured), /本机/);
  const local = validateSettings({authMode: 'none', endpoint: 'http://localhost:11434/v1'}, configured);
  assert.equal(local.apiKey, ''); assert.equal(publicSettings(local).configured, true);
  assert.throws(() => validateSettings({endpoint: 'https://example.com/v1'}, local), /本机/);
});
test('parameter choices are validated before reaching the network', () => {
  for (const patch of [{reasoningEffort: 'arbitrary'}, {tokenParameter: 'messages'}, {authMode: 'query'}]) assert.throws(() => validateSettings(patch));
});
test('configured reasoning and completion token parameters reach compatible providers', async () => {
  let request;
  await streamTranslation('Test', {...configured, reasoningEffort: 'low', tokenParameter: 'max_completion_tokens'}, {fetcher: async (_, init) => {
    request = init;
    return Response.json({choices: [{message: {content: '测试'}, finish_reason: 'stop'}]});
  }});
  const body = JSON.parse(request.body);
  assert.equal(body.reasoning_effort, 'low'); assert.ok(body.max_completion_tokens > 0);
  assert.equal(body.max_tokens, undefined); assert.equal(body.temperature, undefined);
  assert.equal(request.headers.Authorization, 'Bearer old-provider-secret');
});
test('keyless requests omit Authorization entirely', async () => {
  await streamTranslation('Test', {...configured, authMode: 'none'}, {fetcher: async (_, init) => {
    assert.equal(init.headers.Authorization, undefined);
    return Response.json({choices: [{message: {content: '测试'}, finish_reason: 'stop'}]});
  }});
});
