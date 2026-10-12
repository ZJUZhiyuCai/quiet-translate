async page => {
  const capture = "__QT_CAPTURE__";
  const context = page.context();
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const origin = worker.url().replace('/background.js', '');
  const article = await context.newPage();
  await article.goto(capture.base + '/article');
  const workspace = await context.newPage();
  await workspace.goto(origin + '/workspace.html');
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({})).find(t => t.url?.includes('/article')).id);
  await worker.evaluate(async id => { const tab = await chrome.tabs.update(id, {active: true}); await chrome.windows.update(tab.windowId, {focused: true}); }, tabId);
  await article.bringToFront();
  await article.waitForFunction(() => document.visibilityState === 'visible');
  await worker.evaluate(id => chrome.tabs.sendMessage(id, {type: 'qt-toggle'}), tabId);
  await article.locator('#first qt-line .text[data-loading=false]').waitFor();
  await article.locator('#second qt-line .text[data-loading=false]').waitFor();
  await article.locator('qt-overlay .toast').waitFor({state: 'hidden'});
  if (await article.locator('#first qt-line .text').innerText() !== capture.firstResult) throw new Error('Unexpected bilingual output');
  if (capture.locale === 'zh-CN') await article.screenshot({path: capture.output + '/bilingual.png'});
  await worker.evaluate(id => chrome.tabs.sendMessage(id, {type: 'qt-toggle'}), tabId);
  await article.locator('qt-line').waitFor({state: 'detached'});
  await article.locator('qt-overlay .toast').waitFor({state: 'hidden'});
  await article.locator('#first').evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    getSelection().removeAllRanges(); getSelection().addRange(range);
    element.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
  });
  await article.locator('qt-overlay .launch').click();
  await article.locator('qt-overlay .translation[data-loading=false]').waitFor();
  if (await article.locator('qt-overlay .translation').innerText() !== capture.firstResult) throw new Error('Unexpected selection output');
  await article.locator('qt-overlay .pin').click();
  await article.locator('h1').click();
  const paragraph = await article.locator('#first').boundingBox();
  const panel = await article.locator('qt-overlay .panel').boundingBox();
  await article.screenshot({path: capture.output + (capture.locale === 'zh-CN' ? '/selection.png' : '/selection-en.png'), clip: {x: paragraph.x - 24, y: paragraph.y - 24, width: paragraph.width + 48, height: panel.y + panel.height - paragraph.y + 48}});
  await workspace.bringToFront();
  await workspace.setViewportSize({width: 1360, height: 900});
  await workspace.locator('#model').filter({hasText: 'demo-replay'}).waitFor();
  await workspace.locator('#source').fill(capture.source);
  // The second actual request reads the extension cache; screenshots do not advertise a mock latency.
  for (let i = 0; i < 2; i++) {
    await workspace.locator('#translate').click();
    await workspace.waitForFunction(() => !document.querySelector('#copy').disabled && !document.querySelector('#translate').disabled);
  }
  if (await workspace.locator('#result').innerText() !== capture.result) throw new Error('Unexpected workspace output');
  await workspace.locator('h1').click();
  await workspace.screenshot({path: capture.output + (capture.locale === 'zh-CN' ? '/workspace.png' : '/workspace-en.png')});
  const options = await context.newPage();
  await options.goto(origin + '/options.html');
  await options.setViewportSize({width: 1360, height: 960});
  await options.waitForFunction(() => document.querySelector('[name=model]').value === 'demo-replay');
  // Show the actual setup controls, without advertising replay latency as an API benchmark.
  await options.evaluate(() => scrollTo(0, 0));
  await options.screenshot({path: capture.output + (capture.locale === 'zh-CN' ? '/setup.png' : '/setup-en.png')});
  const version = await worker.evaluate(() => chrome.runtime.getManifest().version);
  return {version, locale: capture.locale, browser: context.browser().version(), replay: true, selected: await article.locator('qt-overlay .meta').innerText(), workspaceStatus: await workspace.locator('#status').innerText(), sourcePreserved: await workspace.locator('#source').inputValue() === capture.source};
}
