// Real Firefox integration: a fresh temporary profile and a localhost-only dummy API.
import {Builder, By, Key, until} from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import {cp, readFile, writeFile, mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd(), output = path.join(root, 'output', 'playwright');
await mkdir(output, {recursive: true});
const extension = path.join(root, 'output', 'firefox-smoke');
await cp('dist/firefox', extension, {recursive: true});
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['http://127.0.0.1/*'];
await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
const server = spawn(process.execPath, ['scripts/test_server.mjs'], {env: {...process.env, QT_TEST_PORT: '0'}, stdio: ['ignore','pipe','pipe'], windowsHide: true});
const base = await new Promise((resolve, reject) => {
  server.stdout.on('data', data => { const url = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]; if(url) resolve(url); });
  server.once('error', reject); server.once('exit', code => reject(new Error('Test server exited: '+code)));
});
const options = new firefox.Options().addArguments('-headless').setPreference('intl.locale.requested', 'en-US');
if (process.env.QT_FIREFOX_BINARY) options.setBinary(process.env.QT_FIREFOX_BINARY);
const builder = new Builder().forBrowser('firefox').setFirefoxOptions(options);
// Geckodriver requires this flag to automate moz-extension pages in this disposable profile.
builder.setFirefoxService(new firefox.ServiceBuilder(process.env.QT_GECKODRIVER).addArguments('--allow-system-access'));
let driver;
const report = [];
const check = (value, label) => { assert.ok(value, label); report.push(label); console.log('PASS '+label); };
try {
  driver = await builder.build();
  await driver.manage().window().setRect({width: 1360, height: 1000});
  const installed = await driver.installWebExtension(extension, {permanent: false});
  check(Boolean(installed), 'Firefox installs the MV3 module background build');
  let origin;
  await driver.wait(async () => {
    for(const handle of await driver.getAllWindowHandles()) {
      await driver.switchTo().window(handle);
      const url = await driver.getCurrentUrl();
      if(url.startsWith('moz-extension:') && url.endsWith('options.html')) { origin = url.slice(0, -'options.html'.length); return true; }
    }
    return false;
  }, 15000);
  check(true, 'Fresh installation opens onboarding settings');
  await driver.wait(until.elementLocated(By.css('#provider')), 5000);
  const publicSettings = await driver.executeScript(async () => (await browser.runtime.sendMessage({type:'qt-settings'})).settings);
  check(!publicSettings.configured && !('apiKey' in publicSettings), 'Public settings are unconfigured and never expose the API key');
  await driver.executeScript((endpoint) => {
    const form=document.querySelector('form');
    form.elements.endpoint.value=endpoint;form.elements.model.value='';
    form.elements.cache.checked=false;
  }, base+'/v1');
  const keyField = await driver.findElement(By.css('[name=apiKey]')), modelField = await driver.findElement(By.css('[name=model]'));
  await keyField.sendKeys('dummy-local-test-key');
  await driver.wait(async () => (await driver.findElement(By.id('models-status')).getAttribute('data-state')) === 'ok', 10000);
  check(await driver.findElement(By.id('model-toggle')).isEnabled() && !(await driver.executeScript(async () => (await browser.runtime.sendMessage({type:'qt-settings'})).settings)).configured, 'Firefox automatically fetches models using an unsaved key without saving the connection');
  await driver.findElement(By.id('model-toggle')).click();
  check((await driver.findElements(By.css('#model-list [role=option]'))).length === 4 && (await driver.findElements(By.css('#model-list img'))).length === 0, 'Firefox model picker filters invalid entries and renders remote names safely');
  await modelField.sendKeys('fast', Key.ARROW_DOWN, Key.ENTER);
  check((await modelField.getAttribute('value')) === 'fast-model' && (await modelField.getAttribute('aria-expanded')) === 'false', 'Firefox keyboard search selects a model without submitting settings');
  await keyField.clear(); await keyField.sendKeys('dummy-unsupported');
  await driver.wait(async () => (await driver.findElement(By.id('models-status')).getAttribute('data-state')) === 'error', 10000);
  check(await modelField.isEnabled() && (await modelField.getAttribute('value')) === 'fast-model', 'Firefox unsupported providers retain manual entry and the selected model');
  await keyField.clear(); await keyField.sendKeys('dummy-benchmark');
  await driver.wait(async () => (await driver.findElement(By.id('models-status')).getAttribute('data-state')) === 'ok', 10000);
  const filter = await driver.findElement(By.id('speed-filter'));
  check((await driver.findElement(By.id('speed-start')).getText()).includes('8'), 'Firefox exposes the model count before starting a speed test');
  await filter.sendKeys('bench-fast');
  await driver.findElement(By.id('speed-start')).click();
  await driver.wait(async () => (await driver.findElement(By.css('tr[data-model="bench-fast"]')).getAttribute('data-status')) === 'ok', 10000);
  await driver.wait(async () => await driver.findElement(By.id('speed-start')).isEnabled(), 10000);
  check((await driver.findElement(By.css('tr[data-model="bench-fast"] td:nth-child(3)')).getText()).endsWith('s'), 'Firefox shows visible first-text latency after a complete translation');
  await filter.clear(); await filter.sendKeys('bench-denied');
  await driver.findElement(By.id('speed-start')).click();
  await driver.wait(async () => (await driver.findElement(By.css('tr[data-model="bench-denied"]')).getAttribute('data-status')) === 'denied', 10000);
  check(!await driver.findElement(By.css('tr[data-model="bench-denied"] button')).isEnabled(), 'Firefox distinguishes an unavailable model and prevents selecting it from results');
  await driver.findElement(By.css('tr[data-model="bench-fast"] button')).click();
  check(await modelField.getAttribute('value') === 'bench-fast' && !(await driver.executeScript(async () => (await browser.runtime.sendMessage({type:'qt-settings'})).settings)).configured, 'Firefox applies a measured model as a draft without silently saving the key');
  await keyField.clear(); await keyField.sendKeys('dummy-local-test-key');
  await driver.findElement(By.id('save-test')).click();
  await driver.wait(async () => (await driver.findElement(By.id('save-state')).getText())==='Saved', 10000);
  await driver.wait(async()=> (await driver.findElement(By.id('connection-status')).getText()).startsWith('Connected'),10000);
  check(await driver.findElement(By.id('setup-success')).isDisplayed(),'One-action setup works through Firefox Promise APIs');
  const migration = await driver.executeScript(async () => {
    const {encryptProfile, readProfile} = await import(browser.runtime.getURL('shared/profile.js'));
    const exported = await browser.runtime.sendMessage({type: 'qt-export-settings', includeKey: true});
    const encrypted = await encryptProfile(exported.settings, 'firefox migration passphrase');
    const restored = await readProfile(JSON.stringify(encrypted), 'firefox migration passphrase');
    const safe = await browser.runtime.sendMessage({type: 'qt-export-settings'});
    return {encrypted: !JSON.stringify(encrypted).includes('dummy-local-test-key'), restored: restored.settings.apiKey === 'dummy-local-test-key', safe: !('apiKey' in safe.settings)};
  });
  check(migration.encrypted && migration.restored && migration.safe, 'Firefox encrypted backup round-trip keeps the default export key-free');
  await writeFile(path.join(output, 'firefox-settings.png'), await driver.takeScreenshot(), 'base64');
  const optionsHandle=await driver.getWindowHandle();
  await driver.switchTo().newWindow('tab');await driver.get(base+'/article');
  const articleHandle=await driver.getWindowHandle();
  await driver.executeScript(() => {window.__source=document.querySelector('#first').textContent;window.__link=document.querySelector('#original-link');});
  await driver.switchTo().window(optionsHandle);
  const articleTab = await driver.executeScript(async () => (await browser.tabs.query({})).find(t=>t.url?.includes('/article')).id);
  // Exercise the popup's public control path, including its content-script
  // initialization fallback on a freshly loaded page.
  const toggled = await driver.executeScript(async id => {
    await browser.tabs.update(id, {active: true});
    return browser.runtime.sendMessage({type: 'qt-control', tabId: id, action: 'qt-toggle'});
  }, articleTab);
  assert.ok(!toggled.error, toggled.error);
  await driver.switchTo().window(articleHandle);
  await driver.wait(()=>driver.executeScript(()=>document.querySelector('#first qt-line')?.shadowRoot.querySelector('.text').dataset.loading==='false'),10000);
  check(await driver.executeScript(()=>document.querySelector('#first').firstChild.textContent===window.__source && document.querySelector('#original-link')===window.__link),'Bilingual reading preserves original text and link identity');
  check(await driver.executeScript(()=>!document.querySelector('pre qt-line, textarea qt-line, [translate=no] qt-line')),'Code, editors, and opted-out content are untouched');
  await writeFile(path.join(output,'firefox-bilingual.png'),await driver.takeScreenshot(),'base64');
  // Trigger the selection entry point using the background message used by the keyboard command.
  await driver.switchTo().window(optionsHandle);
  await driver.executeScript(async id=>browser.tabs.sendMessage(id,{type:'qt-selection',text:'A quiet tool keeps the original in sight.'}),articleTab);
  await driver.switchTo().window(articleHandle);
  await driver.wait(()=>driver.executeScript(()=>document.querySelector('qt-overlay')?.shadowRoot.querySelector('.translation').dataset.loading==='false'),10000);
  check(await driver.executeScript(()=>document.querySelector('qt-overlay').shadowRoot.querySelector('.translation').textContent.includes('测试译文')),'Selection translation streams into the floating card');
  await driver.switchTo().window(optionsHandle);
  await driver.executeScript(async id=>browser.tabs.sendMessage(id,{type:'qt-toggle'}),articleTab);
  await driver.switchTo().window(articleHandle);
  check(await driver.executeScript(()=>document.querySelectorAll('qt-line,qt-anchor').length===0),'Restore removes every injected translation and anchor');
  await driver.get(origin+'workspace.html');
  const source=Array.from({length:18},(_,i)=>`Part ${i+1}. `+'Long passages should stream in order and preserve the original text. '.repeat(5)).join('\n\n');
  await driver.findElement(By.id('source')).sendKeys(source);
  await driver.findElement(By.id('translate')).click();
  await driver.wait(async()=> (await driver.findElement(By.id('status')).getText()).startsWith('Complete'),15000);
  check((await driver.findElement(By.id('source')).getAttribute('value'))===source && await driver.findElement(By.id('copy')).isEnabled(),'Long text completes without modifying the source');
  const version=(await driver.getCapabilities()).getBrowserVersion();
  await writeFile(path.join(output,'firefox-smoke.json'),JSON.stringify({browser:'Firefox',version,checks:report},null,2));
  console.log(JSON.stringify({browser:'Firefox',version,passed:report.length}));
} catch (error) {
  if(driver) {
    await writeFile(path.join(output,'firefox-failure.png'),await driver.takeScreenshot(),'base64');
    console.log(JSON.stringify(await driver.executeScript(()=>({url:location.href,lines:document.querySelectorAll('qt-line').length,body:document.body.innerText.slice(-2000),html:document.querySelector('#first')?.outerHTML,shadows:[...document.querySelectorAll('qt-line')].slice(0,3).map(e=>e.shadowRoot.innerHTML)}))));
  }
  throw error;
} finally { if(driver) await driver.quit();server.kill(); }
