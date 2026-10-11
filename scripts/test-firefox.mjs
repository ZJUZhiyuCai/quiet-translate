// Real Firefox integration: a fresh temporary profile and a localhost-only dummy API.
import {Builder, By, until} from 'selenium-webdriver';
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
    form.elements.endpoint.value=endpoint;form.elements.model.value='mock-model';form.elements.apiKey.value='dummy-local-test-key';
    form.elements.cache.checked=false;
  }, base+'/v1');
  await driver.findElement(By.id('save')).click();
  await driver.wait(async () => (await driver.findElement(By.id('save-state')).getText())==='Saved', 10000);
  await driver.findElement(By.id('test-connection')).click();
  await driver.wait(async()=> (await driver.findElement(By.id('connection-status')).getText()).startsWith('Connected'),10000);
  check(true,'Save and connection test work through Firefox Promise APIs');
  await writeFile(path.join(output, 'firefox-settings.png'), await driver.takeScreenshot(), 'base64');
  const optionsHandle=await driver.getWindowHandle();
  await driver.switchTo().newWindow('tab');await driver.get(base+'/article');
  const articleHandle=await driver.getWindowHandle();
  await driver.executeScript(() => {window.__source=document.querySelector('#first').textContent;window.__link=document.querySelector('#original-link');});
  await driver.switchTo().window(optionsHandle);
  const articleTab = await driver.executeScript(async () => (await browser.tabs.query({})).find(t=>t.url?.includes('/article')).id);
  console.log('Toggle', await driver.executeScript(async id => {await browser.tabs.update(id,{active:true});return browser.tabs.sendMessage(id,{type:'qt-toggle'});},articleTab));
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
