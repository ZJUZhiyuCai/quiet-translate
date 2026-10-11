import test from 'node:test';
import assert from 'node:assert/strict';
import {readSSE, streamTranslation} from '../extension/shared/transport.js';
import {DEFAULTS} from '../extension/shared/core.js';
const config = {...DEFAULTS, apiKey: 'test-key'};
const enc = new TextEncoder();
function stream(value, chunk = 7) {
  const bytes = enc.encode(value);
  return new ReadableStream({start(controller) { for (let i = 0; i < bytes.length; i += chunk) controller.enqueue(bytes.slice(i, i + chunk)); controller.close(); }});
}
const event = value => 'data: ' + JSON.stringify(value) + '\n\n';
test('SSE parser handles fragmented UTF-8, CRLF, comments, multiline data, trailing event', async () => {
  const events = [];
  await readSSE(stream(':comment\r\ndata: 你好🌿\r\ndata: second\r\n\r\ndata: tail', 1), e => events.push(e));
  assert.deepEqual(events, ['你好🌿\nsecond', 'tail']);
});
test('stream only visible content, not reasoning; compatible defaults with no redirects', async () => {
  let options;
  const body = event({choices: [{delta: {reasoning_content: 'private'}}]}) + event({choices: [{delta: {content: '你好'}}]}) + event({choices: [{delta: {content: '，世界。'}, finish_reason: 'stop'}]}) + 'data: [DONE]\n\n';
  const updates = [];
  const result = await streamTranslation('Hello world', config, {onText: value => updates.push(value), fetcher: async (_, init) => { options = init; return new Response(stream(body), {headers: {'content-type': 'text/event-stream'}}); }});
  assert.equal(result, '你好，世界。');
  assert.ok(updates.every(value => !value.includes('private')));
  assert.equal(JSON.parse(options.body).reasoning_effort, undefined);
  assert.equal(JSON.parse(options.body).temperature, undefined);
  assert.equal(options.redirect, 'error');
  assert.equal(options.credentials, 'omit');
});
test('premature EOF cannot become a cached success', async () => {
  await assert.rejects(streamTranslation('hello', config, {fetcher: async () => new Response(stream(event({choices: [{delta: {content: 'partial'}}]})), {headers: {'content-type': 'text/event-stream'}})}), /连接提前结束/);
});
test('truncated output is visibly rejected', async () => {
  const body = event({choices: [{delta: {content: 'partial'}, finish_reason: 'length'}]});
  await assert.rejects(streamTranslation('hello', config, {fetcher: async () => new Response(stream(body), {headers: {'content-type': 'text/event-stream'}})}), /截断/);
});
test('non-streaming compatible endpoint returns plain completion', async () => {
  const result = await streamTranslation('hello', config, {fetcher: async () => Response.json({choices: [{message: {content: '你好'}, finish_reason: 'stop'}]})});
  assert.equal(result, '你好');
});
test('HTTP error never leaks response bodies or credentials', async () => {
  await assert.rejects(streamTranslation('hello', config, {fetcher: async () => new Response('test-key leaked server echo', {status: 401})}), error => error.message.includes('密钥无效') && !error.message.includes('test-key'));
});
test('retry transient server failure once, honor cancellation', async () => {
  let calls = 0;
  const result = await streamTranslation('hello', config, {fetcher: async () => ++calls === 1 ? new Response('', {status: 503, headers: {'retry-after': '0.001'}}) : Response.json({choices: [{message: {content: '你好'}, finish_reason: 'stop'}]})});
  assert.equal(calls, 2); assert.equal(result, '你好');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(streamTranslation('hello', config, {signal: controller.signal, fetcher: async () => { throw new Error('should not fetch'); }}), {name: 'AbortError'});
});
