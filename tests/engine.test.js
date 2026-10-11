import test from 'node:test';
import assert from 'node:assert/strict';
import {TranslationEngine} from '../extension/shared/engine.js';
import {Scheduler} from '../extension/shared/scheduler.js';
import {DEFAULTS} from '../extension/shared/core.js';
const config = {...DEFAULTS, apiKey: 'test', model: 'test-model'};
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
function cache() { const values = new Map(); return {epoch: 0, get: async key => values.get(key), put: async (key, value) => values.set(key, value)}; }
test('scheduler reserves capacity for immediate selection requests', async () => {
  const scheduler = new Scheduler(4, 3), releases = [], started = [];
  const run = name => scheduler.schedule(() => new Promise(resolve => { started.push(name); releases.push(resolve); }), {priority: name === 'selection' ? 10 : 0});
  const pending = ['page1', 'page2', 'page3', 'page4', 'selection'].map(run);
  await tick(); assert.deepEqual(started, ['page1', 'page2', 'page3', 'selection']);
  releases.splice(0).forEach(resolve => resolve()); await tick(); assert.ok(started.includes('page4'));
  releases.splice(0).forEach(resolve => resolve()); await Promise.all(pending);
});
test('queued cancellation never starts its request', async () => {
  const scheduler = new Scheduler(1, 1); let release;
  const first = scheduler.schedule(() => new Promise(resolve => { release = resolve; }));
  const controller = new AbortController(); let executed = false;
  const second = scheduler.schedule(() => { executed = true; }, {signal: controller.signal});
  controller.abort(); await assert.rejects(second, {name: 'AbortError'}); await tick(); release(); await first;
  assert.equal(executed, false);
});
test('concurrent duplicate translations share one network call; cache reuses result', async () => {
  let calls = 0;
  const engine = new TranslationEngine(cache(), async (_, __, {onText}) => { calls++; await tick(); onText('译文'); return '译文'; });
  const results = await Promise.all([engine.translate('Hello world', config), engine.translate('Hello world', config)]);
  assert.equal(calls, 1); assert.equal(results[0].text, '译文');
  const again = await engine.translate('Hello world', config); assert.equal(again.cached, true); assert.equal(calls, 1);
});
test('cancelling one shared subscriber does not abort the other', async () => {
  let release, aborted = false;
  const engine = new TranslationEngine(cache(), async (_, __, {signal}) => { signal.addEventListener('abort', () => { aborted = true; }); await new Promise(resolve => { release = resolve; }); return '译文'; });
  const controller = new AbortController();
  const one = engine.translate('Hello world', config, {signal: controller.signal});
  const two = engine.translate('Hello world', config);
  await tick(); controller.abort(); await assert.rejects(one, {name: 'AbortError'});
  assert.equal(aborted, false); release(); assert.equal((await two).text, '译文');
});
test('all subscribers cancelling aborts the request', async () => {
  let aborted = false;
  const engine = new TranslationEngine(cache(), async (_, __, {signal}) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); });
  }));
  const controller = new AbortController();
  const promise = engine.translate('Hello world', config, {signal: controller.signal});
  await tick(); controller.abort(); await assert.rejects(promise, {name: 'AbortError'}); await tick(); assert.equal(aborted, true);
});
test('chunk ordering remains stable when later chunks finish first', async () => {
  const input = 'A'.repeat(1600) + 'B'.repeat(1600) + 'C'.repeat(100);
  const engine = new TranslationEngine(cache(), async text => { if (text[0] === 'A') await new Promise(resolve => setTimeout(resolve, 20)); return text[0] + '-translated'; });
  const result = await engine.translate(input, config);
  assert.equal(result.text, 'A-translated\n\nB-translated\n\nC-translated');
});

test('streaming long text only grows at the end even when later chunks arrive first', async () => {
  const input = 'A'.repeat(1600) + 'B'.repeat(1600) + 'C'.repeat(100), updates = [];
  const engine = new TranslationEngine(cache(), async (text, _, {onText}) => {
    if (text[0] === 'A') await new Promise(resolve => setTimeout(resolve, 25));
    onText(text[0]); await tick(); onText(text[0] + '-translated');
    return text[0] + '-translated';
  });
  const result = await engine.translate(input, config, {onUpdate: event => updates.push(event.text)});
  let previous = '';
  for (const text of updates) { assert.ok(text.startsWith(previous), 'visible text must not be inserted above earlier output'); previous = text; }
  assert.equal(updates.find(Boolean), 'A');
  assert.equal(previous, result.text);
});
test('oversized or empty text rejected before network', async () => {
  let calls = 0; const engine = new TranslationEngine(cache(), async () => { calls++; return ''; });
  await assert.rejects(engine.translate('X'.repeat(60001), config), /60,000/);
  await assert.rejects(engine.translate(' ', config), /文字/);
  assert.equal(calls, 0);
});
