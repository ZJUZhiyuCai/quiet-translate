// Preset selection never contacts a paid API; request dialects are tested with a mock fetcher.
async page => {
  const context = page.context(), worker = context.serviceWorkers()[0];
  const origin = worker.url().replace('/background.js', ''), output = "__QT_OUTPUT__";
  const options = await context.newPage(), report = [];
  const check = (value, label) => { if (!value) throw new Error(label); report.push({check: label, pass: true}); };
  await options.goto(origin + '/options.html');
  await options.waitForFunction(() => document.querySelector('[name=model]').value);
  const original = await options.evaluate(async () => (await chrome.runtime.sendMessage({type: 'qt-settings'})).settings);
  let providerRequests = 0;
  await options.route('https://**/*', route => { providerRequests++; return route.abort(); });
  const expected = [
    ['deepseek', 'https://api.deepseek.com', 'deepseek-flash', 'none'],
    ['glm', 'https://open.bigmodel.cn/api/paas/v4', 'glm-5.3-flash', 'low'],
    ['qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen3.8-flash', 'low'],
    ['qwen-intl', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', 'qwen3.8-flash', 'low'],
    ['moonshot', 'https://api.moonshot.cn/v1', 'kimi-k2.6', 'none'],
    ['minimax', 'https://api.minimax.cn/v1', 'MiniMax-M3', 'none'],
    ['siliconflow', 'https://api.siliconflow.cn/v1', 'deepseek-ai/DeepSeek-V4-Flash', 'none'],
    ['doubao', 'https://ark.cn-beijing.volces.com/api/v3', '', 'default'],
  ];
  for (const [id, endpoint, model, effort] of expected) {
    await options.locator('[name=apiKey]').fill('dummy-unsaved-provider-key');
    await options.locator('#provider').selectOption(id);
    const draft = await options.evaluate(() => Object.fromEntries(new FormData(document.querySelector('form'))));
    check(draft.endpoint === endpoint && draft.model === model && draft.reasoningEffort === effort && draft.apiKey === '' && draft.authMode === 'bearer', `${id} fills endpoint/model/compatibility and discards the previous draft key`);
    check(await options.locator('#provider-docs').isVisible() && await options.locator(model ? '[name=apiKey]' : '[name=model]').evaluate(el => el === document.activeElement), `${id} exposes official docs and focuses the next required field`);
  }
  check(providerRequests === 0, 'Browsing presets never sends a provider request');
  const saved = await options.evaluate(async () => (await chrome.runtime.sendMessage({type: 'qt-settings'})).settings);
  check(JSON.stringify(saved) === JSON.stringify(original), 'Selecting presets leaves the saved connection and credentials unchanged');
  await options.locator('#provider').selectOption('glm');
  await options.locator('[name=model]').fill('my-enabled-model');
  await options.locator('#provider').selectOption('custom');
  check(await options.locator('[name=model]').inputValue() === 'my-enabled-model' && await options.locator('#provider-docs').isHidden(), 'Custom mode retains the editable draft and hides preset-specific documentation');
  await options.locator('[name=endpoint]').fill('https://space.cn-beijing.maas.aliyuncs.com/compatible-mode/v1');
  check(await options.locator('#provider').inputValue() === 'qwen' && await options.locator('[name=model]').inputValue() === 'my-enabled-model', 'Workspace endpoint recognition never overwrites the user model');
  await options.locator('[name=endpoint]').fill('https://api.deepseek.com.attacker.example');
  check(await options.locator('#provider').inputValue() === 'custom', 'Lookalike hosts do not inherit official provider hints');
  await options.locator('#provider').selectOption('local');
  check(await options.locator('[name=authMode]').inputValue() === 'none' && await options.locator('[name=model]').inputValue() === '', 'Local preset needs the user’s installed model and explicitly disables authentication');
  await options.reload();
  await options.waitForFunction(model => document.querySelector('[name=model]').value === model, original.model);
  check(await options.locator('[name=endpoint]').inputValue() === original.endpoint, 'Reload discards preset drafts and retains the original connection');

  // Exercise rendered macOS hints in the real extension UI, without claiming a native Mac run.
  await options.addInitScript(() => {
    Object.defineProperty(navigator, 'platform', {get: () => 'MacIntel'});
    Object.defineProperty(navigator, 'userAgentData', {get: () => ({platform: 'macOS'})});
  });
  await options.reload();
  await options.waitForFunction(() => [...document.querySelectorAll('kbd')].every(el => el.textContent.includes('Option')));
  check((await options.locator('.keyboard-guide').innerText()).includes('⌥ Option'), 'macOS preferences render Option in shortcuts and hover guidance');
  await options.locator('#provider').selectOption('glm');
  for (const theme of ['light', 'dark']) {
    await options.locator('[name=theme]').selectOption(theme);
    for (const width of [360, 1360]) {
      await options.setViewportSize({width, height: 960});
      await options.locator('[name=apiKey]').focus();
      check(await options.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Provider help fits ${theme} theme at ${width}px`);
      await options.screenshot({path: output + `/providers-${theme}-${width}.png`});
    }
  }
  await options.goto(origin + '/popup.html');
  check((await options.locator('kbd').allTextContents()).every(text => text.includes('⌥ Option')), 'macOS popup shortcuts render Option');
  await options.goto(origin + '/workspace.html');
  check((await options.locator('.empty-shortcut').innerText()).includes('⌘ Cmd'), 'macOS workspace renders Command for the existing Cmd+Enter action');
  await options.close();
  return report;
}
