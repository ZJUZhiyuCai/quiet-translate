// Executed through playwright-cli in the same isolated profile as the reading regression.
async page => {
  const context = page.context(), worker = context.serviceWorkers()[0];
  const origin = worker.url().replace('/background.js', '');
  const workspace = context.pages().find(p => p.url().endsWith('/workspace.html'));
  const article = context.pages().find(p => p.url().includes('/article'));
  const base = new URL(article.url()).origin, output = "__QT_OUTPUT__";
  const report = [], check = (value, label) => {
    if (!value) throw new Error(label);
    report.push({check: label, pass: true});
  };
  const config = {endpoint: base + '/v1', model: 'mock-model', apiKey: 'dummy-local-test-key', cache: false, theme: 'light', selection: true, selectionMode: 'button'};
  const saveSettings = values => workspace.evaluate(async settings => chrome.runtime.sendMessage({type: 'qt-save', settings}), values);
  await saveSettings(config);
  const options = await context.newPage();
  await options.goto(origin + '/options.html');
  await options.waitForFunction(() => document.querySelector('[name=model]').value === 'mock-model');
  const model = options.locator('[name=model]');
  const save = async () => {
    await options.locator('#save').click();
    await options.waitForFunction(() => document.querySelector('#save-state').dataset.state === 'ok' && !document.querySelector('#save').disabled);
  };
  const probe = async state => {
    await options.locator('#test-connection').click();
    await options.waitForFunction(state => document.querySelector('#connection-status').dataset.state === state, state);
  };
  await model.fill('unsaved-draft');
  await probe('ok');
  check(await options.locator('#save-state').getAttribute('data-state') === 'dirty' && await model.inputValue() === 'unsaved-draft', 'Testing saved connection preserves unsaved draft and dirty state');
  check((await options.evaluate(async () => (await chrome.runtime.sendMessage({type: 'qt-settings'})).settings)).model === 'mock-model', 'Connection test never persists draft fields');
  await model.fill('TEST_401'); await save();
  check(await options.locator('#connection-status').getAttribute('data-state') === 'idle', 'Saving clears previously verified connection state');
  await probe('error');
  check(await options.locator('#save-state').getAttribute('data-state') === 'ok', 'Failed connection remains distinct from successful settings save');
  await model.fill('TEST_SLOW'); await save();
  await options.locator('#test-connection').click();
  await model.fill('draft-kept-after-key-removal');
  await options.locator('#remove-key').click();
  await options.waitForFunction(() => document.querySelector('#remove-key').disabled && !document.querySelector('#save').disabled);
  await options.waitForTimeout(3300);
  check(await model.inputValue() === 'draft-kept-after-key-removal' && await options.locator('#save-state').getAttribute('data-state') === 'dirty', 'Removing a key preserves other unsaved fields');
  check(await options.locator('#test-connection').isDisabled() && await options.locator('#connection-status').getAttribute('data-state') === 'idle', 'Cancelled old probe cannot verify or re-enable a removed connection');
  await saveSettings(config); await options.reload();
  await options.waitForFunction(() => document.querySelector('[name=model]').value === 'mock-model');
  await options.locator('#remove-key').click();
  await options.waitForFunction(() => document.querySelector('#save-state').dataset.state === 'ok');
  check(await options.locator('#test-connection').isDisabled(), 'Removing a saved key without a draft reports a completed change');

  await workspace.reload();
  await workspace.locator('#setup').waitFor({state: 'visible'});
  check(await workspace.locator('#translate').isDisabled() && await workspace.locator('#setup a').count() > 0, 'Unconfigured workspace has a persistent usable setup link');
  const popup = await context.newPage();
  await popup.goto(origin + '/popup.html');
  await popup.locator('#setup').waitFor({state: 'visible'});
  check(await popup.locator('#model .status-dot.off').count() === 1, 'Unconfigured popup does not show a connected status');

  await saveSettings(config); await options.reload(); await workspace.reload(); await popup.reload();
  await workspace.waitForFunction(() => document.querySelector('#setup').hidden);
  for (const width of [360, 430, 1360]) {
    await workspace.setViewportSize({width, height: 820});
    const layout = await workspace.evaluate(() => {
      const bounds = selector => document.querySelector(selector).getBoundingClientRect();
      const source = bounds('.source-pane'), target = bounds('.target-pane'), action = bounds('#translate');
      return {overflow: document.documentElement.scrollWidth > innerWidth, actionVisible: action.top >= 0 && action.bottom < innerHeight,
        headingsInside: ['.source-pane', '.target-pane'].every(selector => document.querySelector(selector + ' .pane-header')),
        stacked: target.top >= source.bottom - 1, sideBySide: Math.abs(target.top - source.top) <= 1};
    });
    check(!layout.overflow && layout.actionVisible && layout.headingsInside && (width <= 760 ? layout.stacked : layout.sideBySide), `Workspace actions and pane headings fit at ${width}px`);
    await workspace.screenshot({path: output + `/workspace-${width}.png`, fullPage: true});
    await options.setViewportSize({width, height: 820});
    await options.locator('[name=excludedSites]').focus();
    const settingsLayout = await options.evaluate(() => {
      const field = document.querySelector('[name=excludedSites]').getBoundingClientRect(), bar = document.querySelector('.save-bar').getBoundingClientRect();
      return {overflow: document.documentElement.scrollWidth > innerWidth, visible: field.bottom <= bar.top && field.top >= 0,
        ordered: [...document.querySelectorAll('.section-nav a')].map(a => a.hash.slice(1)).join() === [...document.querySelectorAll('form > section')].map(s => s.id).join()};
    });
    check(!settingsLayout.overflow && settingsLayout.visible && settingsLayout.ordered, `Settings focus stays above save bar and navigation follows sections at ${width}px`);
    await options.screenshot({path: output + `/settings-${width}.png`, fullPage: true});
  }
  await popup.setViewportSize({width: 360, height: 700});
  check(await popup.locator('.workspace-link small').evaluate(e => e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight), 'Popup workspace description remains fully readable');
  await popup.screenshot({path: output + '/popup.png'});
  await options.setViewportSize({width: 1360, height: 820});
  await options.locator('[name=theme]').selectOption('dark'); await save();
  await workspace.reload(); await workspace.setViewportSize({width: 430, height: 820});
  await workspace.screenshot({path: output + '/workspace-dark.png', fullPage: true});
  await saveSettings(config);

  // Use an actual DOM selection so scrolling exercises the retained Range, not fabricated coordinates.
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({})).find(t => t.url?.includes('/article')).id);
  await article.reload();
  await worker.evaluate(async id => { const tab = await chrome.tabs.update(id, {active: true}); await chrome.windows.update(tab.windowId, {focused: true}); }, tabId);
  await article.bringToFront();
  await article.waitForFunction(() => document.visibilityState === 'visible');
  await article.setViewportSize({width: 800, height: 800});
  await article.evaluate(() => {
    document.body.innerHTML = '<main style="padding:380px 24px 1400px"><p id="anchor">Quiet software helps readers keep their place and understand a long article without distraction.</p></main>';
    const range = document.createRange(); range.selectNodeContents(document.querySelector('#anchor'));
    getSelection().removeAllRanges(); getSelection().addRange(range);
    document.querySelector('#anchor').dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
  });
  const panel = article.locator('qt-overlay .panel'), body = article.locator('qt-overlay .body');
  await article.locator('qt-overlay .launch').click();
  await article.locator('qt-overlay .translation[data-loading=false]').waitFor();
  const panelAppearance = () => article.locator('qt-overlay .translation').evaluate(e => {
    const style = getComputedStyle(e), panel = getComputedStyle(e.closest('.panel'));
    const luminance = color => {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map(v => Number(v) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const fg = luminance(style.color), bg = luminance(panel.backgroundColor);
    return {contrast: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05), sansSerif: style.fontFamily.includes('sans-serif')};
  });
  const light = await panelAppearance();
  check(light.contrast >= 4.5 && light.sansSerif, 'Light selection text remains readable and keeps its own font after host isolation');
  const first = await panel.boundingBox();
  await article.evaluate(() => scrollBy(0, 60)); await article.waitForTimeout(120);
  const moved = await panel.boundingBox();
  check(Math.abs(first.y - moved.y - 60) < 3, 'Unpinned selection panel tracks the current range when the page scrolls');
  await article.locator('qt-overlay .pin').click();
  const pinned = await panel.boundingBox();
  await article.evaluate(() => scrollBy(0, 60)); await article.waitForTimeout(120);
  check(Math.abs(pinned.y - (await panel.boundingBox()).y) < 1, 'Pinned selection panel remains still during page scrolling');
  await article.keyboard.press('Escape');
  const longText = 'A long paragraph deserves patient reading, complete context, and a translation that keeps its original meaning. '.repeat(65);
  for (const viewport of [{width: 360, height: 820}, {width: 430, height: 820}, {width: 360, height: 240}]) {
    await article.setViewportSize(viewport);
    await worker.evaluate(({id, text}) => { chrome.tabs.sendMessage(id, {type: 'qt-selection', text}); }, {id: tabId, text: longText});
    await article.locator('qt-overlay .translation[data-loading=false]').waitFor({timeout: 15000});
    const bounds = await panel.boundingBox(), footer = await article.locator('qt-overlay footer').boundingBox();
    check(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1 && footer.y + footer.height <= viewport.height && await article.locator('qt-overlay .copy').isEnabled(), `Long selection keeps complete-result actions in view at ${viewport.width}×${viewport.height}`);
    await body.evaluate(e => { e.scrollTop = e.scrollHeight; }); await article.waitForTimeout(80);
    check(Math.abs(bounds.y - (await panel.boundingBox()).y) < 1, `Scrolling long translation does not reposition its panel at ${viewport.width}×${viewport.height}`);
    await article.screenshot({path: output + `/selection-${viewport.width}-${viewport.height}.png`});
    await article.keyboard.press('Escape');
  }
  await saveSettings({theme: 'dark'});
  await worker.evaluate(id => { chrome.tabs.sendMessage(id, {type: 'qt-selection', text: 'A dark reading surface still needs readable text.'}); }, tabId);
  await article.locator('qt-overlay .translation[data-loading=false]').waitFor();
  const dark = await panelAppearance();
  check(dark.contrast >= 4.5 && dark.sansSerif, 'Dark selection text has at least 4.5:1 contrast after host isolation');
  await article.screenshot({path: output + '/selection-dark.png'});
  await article.keyboard.press('Escape');
  await worker.evaluate(id => { chrome.tabs.sendMessage(id, {type: 'qt-selection', text: 'TEST_401 this deliberately fails.'}); }, tabId);
  await article.locator('qt-overlay .retry').waitFor({state: 'visible'});
  check(await article.locator('qt-overlay .copy').isDisabled(), 'Failed selection never offers copying an incomplete result');
  await article.keyboard.press('Escape');
  check(await panel.isHidden(), 'Escape dismisses the selection panel');
  await options.close(); await popup.close();
  return report;
}
