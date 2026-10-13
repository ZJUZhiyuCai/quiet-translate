import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS} from '../extension/shared/core.js';
import {benchmarkPlan, probeModel, runBenchmark, BENCHMARK_TEXT} from '../extension/shared/model-benchmark.js';
import {Scheduler} from '../extension/shared/scheduler.js';

const settings = {...DEFAULTS, endpoint: 'https://example.test/v1', apiKey: 'private-test-key', model: 'saved'};
const event = value => 'data: ' + JSON.stringify(value) + '\n\n';
const piece = (content, finish) => event({choices: [{delta: {content}, finish_reason: finish}]});
const sse = text => new Response(text, {headers: {'content-type': 'text/event-stream'}});

test('benchmark plans isolate draft keys, bound and deduplicate IDs, and exclude private glossary/cache', () => {
  const draft = {...settings, apiKey: '', useSavedKey: true, glossary: 'private glossary', cache: true};
  const plan = benchmarkPlan(draft, ['a', 'a', 'b'], settings);
  assert.deepEqual(plan.models, ['a', 'b']);
  assert.equal(plan.settings.apiKey, settings.apiKey);
  assert.equal(plan.settings.glossary, ''); assert.equal(plan.settings.cache, false);
  assert.throws(() => benchmarkPlan({...draft, endpoint: 'https://example.test/other'}, ['a'], settings));
  for (const ids of [[], ['bad id'], Array(2001).fill('a'), 'a']) assert.throws(() => benchmarkPlan(draft, ids, settings));
  assert.equal(benchmarkPlan({...draft, apiKey: 'draft-key'}, ['a'], settings).settings.apiKey, 'draft-key');
  assert.equal(settings.apiKey, 'private-test-key'); assert.equal(settings.model, 'saved');
});

test('TTFT starts at dispatch and excludes role, reasoning and whitespace events', async () => {
  let clock = 0, index = 0, request;
  const chunks = [event({choices: [{delta: {role: 'assistant', reasoning_content: 'thinking'}}]}), piece('   '), piece('译文'), piece('', 'stop')];
  const stream = new ReadableStream({pull(controller) {
    if (index === chunks.length) { controller.close(); return; }
    clock += 100; controller.enqueue(new TextEncoder().encode(chunks[index++]));
  }}, {highWaterMark: 0});
  const result = await probeModel(settings, 'candidate', {now: () => clock, fetcher: async (url, init) => {
    request = {url, ...init}; return new Response(stream, {headers: {'content-type': 'text/event-stream'}});
  }});
  assert.equal(result.status, 'ok'); assert.equal(result.firstMs, 300); assert.equal(result.elapsedMs, 400);
  assert.equal(result.streaming, true); assert.equal(result.model, 'candidate');
  const body = JSON.parse(request.body);
  assert.equal(body.model, 'candidate'); assert.equal(body.max_tokens, 512); assert.equal(body.messages.at(-1).content, BENCHMARK_TEXT);
  assert.equal(request.redirect, 'error'); assert.equal(request.credentials, 'omit'); assert.equal(request.cache, 'no-store'); assert.equal(request.referrerPolicy, 'no-referrer');
  assert.equal(JSON.stringify(result).includes('private-test-key'), false); assert.equal(JSON.stringify(result).includes('译文'), false);
});

test('non-streaming responses report full-response time without inventing TTFT', async () => {
  const result = await probeModel(settings, 'json', {fetcher: async () => Response.json({choices: [{message: {content: '译文'}, finish_reason: 'stop'}]})});
  assert.equal(result.status, 'ok'); assert.equal(result.streaming, false); assert.equal(result.firstMs, null); assert.ok(result.elapsedMs >= 0);
});

test('receiving a first token is insufficient when a stream fails, truncates or returns only reasoning', async () => {
  for (const response of [sse(piece('partial')), sse(piece('partial', 'length')), sse(piece('partial', 'content_filter')),
    sse(event({choices: [{delta: {reasoning_content: 'thinking'}, finish_reason: 'stop'}]})),
    Response.json({choices: [{message: {content: ''}, finish_reason: 'stop'}]}),
    Response.json({choices: [{message: {content: 'partial'}, finish_reason: 'content_filter'}]})]) {
    const result = await probeModel(settings, 'broken', {fetcher: async () => response});
    assert.equal(result.status, 'failed'); assert.equal(result.firstMs, null);
  }
});

test('HTTP outcomes remain distinct, make one request and never expose provider bodies', async () => {
  for (const [code, status] of [[401, 'auth'], [402, 'balance'], [403, 'denied'], [404, 'missing'], [429, 'limited'], [503, 'server'], [400, 'rejected']]) {
    let calls = 0;
    const result = await probeModel(settings, 'model', {fetcher: async () => { calls++; return new Response('private-test-key provider echo', {status: code}); }});
    assert.equal(result.status, status); assert.equal(calls, 1); assert.ok(!JSON.stringify(result).includes('private-test-key'));
  }
});

test('a request deadline aborts the network and reports timeout', async () => {
  let aborted = false;
  const result = await probeModel(settings, 'slow', {timeoutMs: 5, fetcher: async (_, {signal}) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, {once: true});
  })});
  assert.equal(result.status, 'timeout'); assert.equal(aborted, true);
});

test('manual cancellation aborts a probe instead of labeling a model unavailable', async () => {
  const controller = new AbortController();
  const pending = probeModel(settings, 'cancel', {signal: controller.signal, fetcher: async (_, {signal}) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), {once: true});
  })});
  controller.abort(); await assert.rejects(pending, {name: 'AbortError'});
});

test('bounded JSON and streaming responses cannot grow without limit', async () => {
  for (const response of [Response.json({choices: [{message: {content: 'x'.repeat(66000)}}]}), sse(piece('x'.repeat(66000), 'stop'))]) {
    assert.equal((await probeModel(settings, 'large', {fetcher: async () => response})).status, 'failed');
  }
});

test('candidate reasoning parameters match choosing that model in the settings picker', async () => {
  const glm = {...settings, endpoint: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3-flash', reasoningEffort: 'low'};
  const bodies = [];
  const fetcher = async (_, init) => { bodies.push(JSON.parse(init.body)); return sse(piece('译文', 'stop')); };
  const same = await probeModel(glm, 'glm-5.3-flash', {fetcher});
  const other = await probeModel(glm, 'another-model', {fetcher});
  assert.equal(bodies[0].reasoning_effort, 'low'); assert.equal(bodies[1].reasoning_effort, undefined);
  assert.equal(same.reasoningEffort, 'low'); assert.equal(other.reasoningEffort, 'default');
});

test('batch concurrency never exceeds two and all results are emitted once', async () => {
  let active = 0, peak = 0; const results = [];
  const plan = {settings, models: ['a', 'b', 'c', 'd', 'e']};
  const done = await runBenchmark(plan, {onResult: result => results.push(result), probe: async (_, model) => {
    peak = Math.max(peak, ++active); await new Promise(resolve => setTimeout(resolve, 2)); active--;
    return {model, status: 'ok'};
  }});
  assert.equal(peak, 2); assert.equal(done.completed, 5); assert.equal(done.stopReason, null);
  assert.equal(results.filter(result => result.status === 'ok').length, 5);
});

test('auth, balance and rate limits stop queued and in-flight probes', async () => {
  for (const reason of ['auth', 'balance', 'limited']) {
    const started = [], results = [];
    const done = await runBenchmark({settings, models: ['a', 'b', 'c', 'd']}, {onResult: result => results.push(result), probe: async (_, model, {signal}) => {
      started.push(model);
      if (model === 'a') return {model, status: reason};
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once: true}));
    }});
    assert.equal(done.stopReason, reason); assert.equal(done.completed, 1); assert.deepEqual(started, ['a', 'b']);
    assert.equal(results.filter(result => result.status === reason).length, 1);
  }
});

test('batch cancellation stops queue dispatch and keeps completed measurements', async () => {
  const controller = new AbortController(), started = [], complete = [];
  const result = await runBenchmark({settings, models: ['a', 'b', 'c', 'd']}, {signal: controller.signal,
    onResult: value => { if (value.status === 'ok') { complete.push(value); controller.abort(); } },
    probe: async (_, model) => { started.push(model); return {model, status: 'ok'}; },
  });
  assert.equal(result.stopReason, 'cancelled'); assert.equal(result.completed, 1); assert.equal(complete.length, 1); assert.equal(started.length, 2);
});

test('queued benchmarks leave the reserved selection slot free and cancel without starting probes', async () => {
  const scheduler = new Scheduler(), releases = [], controller = new AbortController();
  const readers = Array.from({length: 3}, () => scheduler.schedule(() => new Promise(resolve => releases.push(resolve))));
  await new Promise(resolve => setTimeout(resolve, 0));
  let calls = 0;
  const tests = runBenchmark({settings, models: ['a', 'b']}, {scheduler, signal: controller.signal, probe: async () => { calls++; return {}; }});
  assert.equal(await scheduler.schedule(() => 'selection ready', {priority: 10}), 'selection ready');
  assert.equal(calls, 0);
  controller.abort(); assert.equal((await tests).stopReason, 'cancelled');
  releases.forEach(resolve => resolve()); await Promise.all(readers);
  assert.equal(calls, 0);
});
