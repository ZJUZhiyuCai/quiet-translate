// Network, editable-combobox and credential isolation checks in a disposable profile.
async page => {
  const context = page.context(), worker = context.serviceWorkers()[0];
  const origin = worker.url().replace('/background.js', ''), output = "__QT_OUTPUT__";
  const article = context.pages().find(p => p.url().includes('/article')), base = new URL(article.url()).origin;
  const options = await context.newPage(), report = [];
  const check = (value, label) => { if (!value) throw new Error(label); report.push({check: label, pass: true}); };
  const send = (type, settings) => options.evaluate(async ({type, settings}) => chrome.runtime.sendMessage({type, settings}), {type, settings});
  const stats = () => options.evaluate(async base => (await fetch(base + '/stats')).json(), base);
  const waitState = state => options.waitForFunction(state => document.querySelector('#models-status').dataset.state === state, state);
  await options.goto(origin + '/options.html');
  await options.waitForFunction(() => document.querySelector('[name=model]').value);
  const original = (await send('qt-settings')).settings;
  await send('qt-save', {endpoint: base + '/v1', model: 'mock-model', apiKey: 'dummy-local-test-key', authMode: 'bearer', theme: 'light'});
  await options.reload();
  await options.waitForFunction(() => document.querySelector('[name=model]').value === 'mock-model');
  const model = options.locator('[name=model]'), key = options.locator('[name=apiKey]'), toggle = options.locator('#model-toggle');
  const before = await stats(); await options.waitForTimeout(1000);
  check((await stats()).modelRequests === before.modelRequests, 'Opening preferences makes no model-list request');
  check(await key.inputValue() === '' && await toggle.isDisabled(), 'Saved key stays masked and model remains editable before discovery');
  await options.locator('#fetch-models').click(); await waitState('ok');
  check(await model.inputValue() === 'mock-model' && await key.inputValue() === '', 'Manual refresh uses the saved exact-endpoint credential without exposing it or changing the model');
  await toggle.click();
  check(await options.locator('#model-list [role=option]').count() === 4, 'Catalog removes duplicate and malformed IDs and explicitly non-text models');
  check(await options.locator('#model-list img').count() === 0 && (await options.locator('#model-list').innerText()).includes('<img src=x'), 'Untrusted model names are rendered as literal text');
  await model.fill('fast'); await model.press('ArrowDown');
  check(await model.getAttribute('aria-activedescendant') !== null, 'Arrow keys expose the highlighted option to assistive technology');
  await model.press('Enter');
  check(await model.inputValue() === 'fast-model' && await model.getAttribute('aria-expanded') === 'false', 'Enter selects a filtered model and closes the dropdown');
  check((await send('qt-settings')).settings.model === 'mock-model' && await options.locator('#save-state').getAttribute('data-state') === 'dirty', 'Choosing a model is a draft until saved');
  await model.fill('custom-not-listed');
  check((await options.locator('#model-list').innerText()).includes('ID'), 'No-match search keeps the manual ID with a clear fallback');
  await model.press('Escape');
  check(await model.inputValue() === 'custom-not-listed' && await options.locator('#model-list').isHidden(), 'Escape closes suggestions without discarding manual input');
  await toggle.click(); await model.press('ArrowUp'); await model.press('Enter');
  check((await model.inputValue()).startsWith('vendor/'), 'ArrowUp from an unhighlighted list selects the last model');

  const burst = await stats();
  await key.fill('dummy-partial'); await options.waitForTimeout(100); await key.fill('dummy-complete');
  await waitState('ok');
  check((await stats()).modelRequests === burst.modelRequests + 1, 'Typing a key is debounced into one automatic request');
  check((await send('qt-export-settings')).settings.model === 'mock-model', 'Automatic discovery never persists the draft model or settings');
  const credential = await options.evaluate(async () => (await chrome.runtime.sendMessage({type: 'qt-export-settings', includeKey: true})).settings.apiKey);
  check(credential === 'dummy-local-test-key', 'Automatic discovery does not replace the saved API key');
  check(await model.inputValue() === 'vendor/a-model-with-a-long-identifier-for-responsive-layout-testing', 'A fetched list never silently picks the first model');

  await key.fill('dummy-slow'); await waitState('loading');
  await options.waitForFunction(async base => (await (await fetch(base + '/stats')).json()).modelRequests > 0, base);
  await options.waitForTimeout(180); await model.fill('typed-while-loading');
  await waitState('ok');
  check(await model.inputValue() === 'typed-while-loading', 'A slow response preserves text typed while the request was in flight');
  await key.fill('dummy-slow'); await waitState('loading'); await options.waitForTimeout(180);
  await key.fill('dummy-new'); await waitState('ok'); await options.waitForTimeout(1900);
  await toggle.click();
  check(await options.locator('#model-list [role=option]').count() === 1 && (await options.locator('#model-list').innerText()).includes('new-account-model'), 'A cancelled old account response cannot replace the latest account list');
  check((await stats()).modelAborted > 0, 'Changing the key aborts the old network request');
  await model.press('Escape');
  await key.fill('dummy-slow'); await waitState('loading'); await options.waitForTimeout(180);
  await options.locator('[name=endpoint]').fill(base + '/unsupported/v1');
  await options.waitForTimeout(2000);
  check(await toggle.isDisabled() && await options.locator('#models-status').getAttribute('data-state') === 'idle', 'Changing the endpoint invalidates pending and displayed model lists');
  const changed = await stats(); await options.waitForTimeout(1000);
  check((await stats()).modelRequests === changed.modelRequests, 'Editing the endpoint never auto-sends the previous draft key to the new destination');
  await options.locator('#fetch-models').click(); await waitState('error');
  check(await model.isEditable() && await model.inputValue() === 'typed-while-loading', 'Unsupported model-list endpoint preserves a fully editable model field');
  await options.locator('[name=endpoint]').fill(base + '/v1');
  for (const [value, state] of [['dummy-invalid', 'error'], ['dummy-malformed', 'error'], ['dummy-empty', 'idle']]) {
    await key.fill(value);
    if (state === 'idle') await options.waitForFunction(() => !document.querySelector('#fetch-models').disabled && /没有|No selectable/.test(document.querySelector('#models-status').textContent));
    else await waitState(state);
    check(await toggle.isDisabled() && await model.isEditable() && !(await options.locator('#models-status').innerText()).includes(value), `${value} offers manual entry without echoing the credential`);
  }

  // Denied permissions stay inline. Only an explicit button click requests access.
  await options.evaluate(() => {
    window.__permissions = {contains: chrome.permissions.contains, request: chrome.permissions.request};
    window.__permissionRequests = 0;
    chrome.permissions.contains = async () => false;
    chrome.permissions.request = async () => { window.__permissionRequests++; window.__permissionGesture = navigator.userActivation.isActive; return false; };
  });
  const deniedBefore = await stats(); await key.fill('dummy-permission'); await waitState('permission');
  check(await options.evaluate(() => window.__permissionRequests === 0) && (await stats()).modelRequests === deniedBefore.modelRequests, 'Auto-discovery never prompts for permission or requests an ungranted host');
  await options.locator('#fetch-models').click(); await waitState('permission');
  check(await options.evaluate(() => window.__permissionRequests === 1 && window.__permissionGesture) && await model.isEditable(), 'Explicit allow button runs in a user gesture and denial leaves manual entry available');
  await options.evaluate(() => Object.assign(chrome.permissions, window.__permissions));

  // An ordinary content script cannot invoke discovery with the saved key.
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({})).find(tab => tab.url?.includes('/article')).id);
  const blocked = await worker.evaluate(async tabId => (await chrome.scripting.executeScript({target: {tabId}, func: () => new Promise(resolve => {
    const port = chrome.runtime.connect({name: 'qt-models'});
    port.onMessage.addListener(() => resolve(false));
    port.onDisconnect.addListener(() => { void chrome.runtime.lastError; resolve(true); });
    port.postMessage({type: 'list', settings: {endpoint: 'https://attacker.example/v1', useSavedKey: true}});
  })}))[0].result, tabId);
  check(blocked, 'Website content scripts are refused access to the model-discovery channel');

  await key.fill('dummy-complete'); await waitState('ok');
  for (const theme of ['light', 'dark']) {
    await options.locator('[name=theme]').selectOption(theme);
    for (const width of [360, 1360]) {
      await options.setViewportSize({width, height: 820});
      await model.fill(''); await toggle.click();
      if (await options.locator('#model-list').isHidden()) await toggle.click();
      check(await options.evaluate(() => {
        const list = document.querySelector('#model-list').getBoundingClientRect(), bar = document.querySelector('.save-bar').getBoundingClientRect();
        return document.documentElement.scrollWidth <= innerWidth && list.left >= 0 && list.right <= innerWidth && list.top >= 0 && list.bottom <= bar.top + 1;
      }), `Model dropdown fits the viewport and stays above Save at ${width}px in ${theme}`);
      await options.screenshot({path: output + `/models-${theme}-${width}.png`});
      await model.press('Escape');
    }
  }
  await options.setViewportSize({width: 1360, height: 1000});
  await model.fill('fast'); await model.press('ArrowDown'); await model.press('Enter');
  await options.locator('#save-test').click(); await options.locator('#setup-success').waitFor({state: 'visible'});
  check((await send('qt-settings')).settings.model === 'fast-model', 'A discovered model saves and translates successfully through the existing setup flow');
  await options.reload(); await options.waitForFunction(() => document.querySelector('[name=model]').value === 'fast-model');
  check(await model.inputValue() === 'fast-model' && await key.inputValue() === '', 'Selected model persists after reload while its API key stays hidden');
  await send('qt-save', {...original, apiKey: 'dummy-local-test-key'});
  await options.close();
  return report;
}
