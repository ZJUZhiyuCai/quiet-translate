import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS, splitText, endpointURL, validateSettings, publicSettings, cacheKey, translationPrompt} from '../extension/shared/core.js';

test('long multilingual text splits losslessly at safe Unicode boundaries', () => {
  const text = ('One complete sentence. Another sentence with an emoji 🌿.\n\n' + '長い文章も読めます。'.repeat(11) + '\n').repeat(120).trim();
  const chunks = splitText(text, 220);
  assert.equal(chunks.join(''), text);
  assert.ok(chunks.every(chunk => chunk.length <= 220));
  assert.ok(chunks.every(chunk => !/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(chunk)));
});
test('unbroken text is bounded and never silently dropped', () => {
  const input = '🚀'.repeat(4000);
  assert.equal(splitText(input, 97).join(''), input);
  assert.ok(splitText(input, 97).every(chunk => chunk.length <= 97));
});
test('prefer paragraphs and preserve blank lines', () => {
  const input = 'a'.repeat(100) + '\n\n' + 'b'.repeat(110);
  assert.deepEqual(splitText(input, 180), ['a'.repeat(100) + '\n\n', 'b'.repeat(110)]);
  assert.deepEqual(splitText(' \r\n '), []);
});
test('credential-bearing or insecure endpoints cannot be saved', () => {
  for (const url of ['http://example.com', 'https://key:secret@example.com', 'https://example.com?key=secret', 'file:///a', 'javascript:alert(1)']) assert.throws(() => endpointURL(url));
  assert.equal(endpointURL('https://example.com/v1/chat/completions/'), 'https://example.com/v1');
  assert.equal(endpointURL('http://localhost:8888/v1'), 'http://localhost:8888/v1');
});
test('public settings never return the API credential', () => {
  const settings = {...DEFAULTS, model: 'test-model', apiKey: 'test-secret'};
  assert.equal(publicSettings(settings).configured, true);
  assert.ok(!JSON.stringify(publicSettings(settings)).includes('test-secret'));
  assert.equal(validateSettings({apiKey: ''}, settings).apiKey, 'test-secret');
  assert.equal(validateSettings({removeKey: true}, settings).apiKey, '');
});
test('validate enums, cap lists, reject dangerous models', () => {
  assert.throws(() => validateSettings({target: 'unknown'}));
  assert.throws(() => validateSettings({model: 'bad\nmodel'}));
  const settings = validateSettings({fontSize: 300, autoSites: ['a.com', 'a.com', 'evil.com/<img>']});
  assert.equal(settings.fontSize, 125);
  assert.deepEqual(settings.autoSites, ['a.com']);
});
test('cache separates provider, model, language and glossary; ignores display style', async () => {
  const baseline = await cacheKey(' Hello ', DEFAULTS);
  assert.equal(baseline, await cacheKey('Hello', {...DEFAULTS, style: 'soft'}));
  for (const patch of [{endpoint: 'https://other.com/v1'}, {model: 'other'}, {target: 'ja'}, {glossary: 'hello=hi'}]) assert.notEqual(baseline, await cacheKey('Hello', {...DEFAULTS, ...patch}));
});
test('prompt treats source content as data, never an instruction', () => {
  const prompt = translationPrompt('zh-CN', 'token = 词元');
  assert.match(prompt, /untrusted content/);
  assert.match(prompt, /token = 词元/);
  assert.match(prompt, /Do not summarize/);
});
