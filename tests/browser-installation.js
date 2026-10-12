// Actual onboarding and file-transfer flows in an isolated browser with dummy keys.
async page => {
  const context = page.context(), worker = context.serviceWorkers()[0];
  const origin = worker.url().replace('/background.js', '');
  const article = context.pages().find(p => p.url().includes('/article'));
  const base = new URL(article.url()).origin, output = "__QT_OUTPUT__";
  const report = [], check = (value, label) => { if (!value) throw new Error(label); report.push({check: label, pass: true}); };
  const options = await context.newPage();
  await options.goto(origin + '/options.html');
  await options.waitForFunction(() => document.querySelector('[name=model]').value);
  const send = (type, values = {}) => options.evaluate(async ({type, values}) => chrome.runtime.sendMessage({type, ...values}), {type, values});
  await send('qt-save', {settings: {removeKey: true, model: '', autoSites: [], excludedSites: [], theme: 'light'}});
  await options.reload();
  await options.waitForFunction(() => document.activeElement.id === 'provider');
  check(await options.locator('#test-connection').isDisabled(), 'Fresh setup starts with the provider and cannot test an empty saved connection');
  await options.locator('[name=endpoint]').fill(base + '/v1');
  await options.locator('[name=model]').fill('mock-model');
  await options.locator('#save-test').click();
  await options.waitForFunction(() => document.querySelector('#connection-status').dataset.state === 'error');
  check(!(await send('qt-settings')).settings.configured && await options.locator('#setup-success').isHidden(), 'Missing API key produces an actionable setup error without claiming success');
  await options.locator('[name=apiKey]').fill('dummy-migration-key');
  await options.locator('#save-test').click();
  await options.locator('#setup-success').waitFor({state: 'visible'});
  check((await send('qt-settings')).settings.configured && await options.locator('#save-state').getAttribute('data-state') === 'ok', 'One action saves and verifies a new connection, then offers the workspace');
  await options.setViewportSize({width: 1360, height: 960});
  await options.evaluate(() => scrollTo(0, 0));
  await options.locator('#notice').waitFor({state: 'hidden'});
  await options.screenshot({path: output + '/onboarding-connected.png'});
  await options.locator('[name=model]').fill('TEST_401');
  check(await options.locator('#setup-success').isHidden(), 'Editing invalidates the ready-to-read action immediately');
  await options.locator('#save-test').click();
  await options.waitForFunction(() => document.querySelector('#connection-status').dataset.state === 'error');
  check(await options.locator('#save-state').getAttribute('data-state') === 'ok' && await options.locator('#setup-success').isHidden(), 'Failed onboarding probe keeps saved preferences but never claims connection success');
  await options.locator('[name=model]').fill('mock-model');
  await options.locator('#save-test').click();
  await options.locator('#setup-success').waitFor({state: 'visible'});

  const groups = options.locator('#transfer details');
  await groups.nth(0).locator('summary').click();
  const download = async name => {
    const pending = options.waitForEvent('download');
    await options.locator('#export-profile').click();
    const file = await pending; await file.saveAs(output + '/' + name);
    return output + '/' + name;
  };
  await download('preferences.json');
  const plain = await send('qt-export-settings');
  check(!('apiKey' in plain.settings), 'Default settings export omits the saved key');
  await options.locator('#include-key').check();
  await options.locator('#backup-password').fill('a private migration test password');
  const backup = await download('encrypted-backup.json');
  check(await options.locator('#backup-password').inputValue() === '', 'Encrypted export clears the passphrase field');

  await groups.nth(1).locator('summary').click();
  await options.locator('#profile-file').setInputFiles(output + '/preferences.json');
  await options.locator('#import-profile').click();
  await options.locator('#import-summary').waitFor({state: 'visible'});
  check((await send('qt-settings')).settings.configured && await options.locator('[name=apiKey]').inputValue() === '', 'Reading a key-free profile is a draft and leaves the saved connection untouched');
  await options.locator('#save').click();
  await options.waitForFunction(() => document.querySelector('#save-state').dataset.state === 'ok' && !document.querySelector('#save').disabled);
  check(!(await send('qt-settings')).settings.configured, 'Saving a key-free import clears the previous key, even on the same endpoint');

  await options.locator('#profile-file').setInputFiles(backup);
  await options.locator('#import-password').fill('the wrong migration password');
  await options.locator('#import-profile').click();
  await options.waitForFunction(() => !document.querySelector('#import-profile').disabled);
  check(!(await send('qt-settings')).settings.configured && await options.locator('#notice').getAttribute('data-error') === 'true', 'A wrong backup passphrase does not change the existing configuration');
  await options.locator('#import-password').fill('a private migration test password');
  await options.locator('#import-profile').click();
  await options.locator('#import-summary').waitFor({state: 'visible'});
  check(!(await send('qt-settings')).settings.configured && await options.locator('[name=apiKey]').inputValue() === 'dummy-migration-key', 'Encrypted import stages the recovered key without applying it');
  await options.locator('#save-test').click();
  await options.locator('#setup-success').waitFor({state: 'visible'});
  check((await send('qt-export-settings', {includeKey: true})).settings.apiKey === 'dummy-migration-key', 'Encrypted migration restores a usable credential after explicit save');

  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({})).find(t => t.url?.includes('/article')).id);
  const denied = await worker.evaluate(async tabId => {
    const replies = await chrome.scripting.executeScript({target: {tabId}, func: () => chrome.runtime.sendMessage({type: 'qt-export-settings', includeKey: true})});
    return replies[0].result;
  }, tabId);
  check(denied.ok === false && !denied.settings, 'A website content-script context cannot request a credential export');
  for (const width of [360, 1360]) {
    await options.setViewportSize({width, height: 820});
    await options.locator('#import-password').focus();
    check(await options.evaluate(() => {
      const field = document.querySelector('#import-password').getBoundingClientRect(), bar = document.querySelector('.save-bar').getBoundingClientRect();
      return document.documentElement.scrollWidth <= innerWidth && field.bottom <= bar.top && field.top >= 0;
    }), `Migration fields fit and stay above the save bar at ${width}px`);
  }
  await options.reload();
  await options.waitForFunction(() => document.querySelector('[name=model]').value === 'mock-model');
  check((await send('qt-settings')).settings.configured && await options.locator('[name=apiKey]').inputValue() === '' && await options.locator('#setup-success').isHidden(), 'Reload preserves migrated settings, hides the key and does not invent a new connection test');
  await options.close();
  return report;
}
