// CLI-driven integration, always in an isolated profile, using only dummy credentials.
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import path from 'node:path';
const runId=Date.now()+'-'+randomUUID().slice(0,8), session='qt-'+runId;
const output=path.resolve('output/playwright/run-'+runId);
await mkdir(output,{recursive:true});
const extension=path.join(output,'extension');await cp('extension',extension,{recursive:true});
const server=spawn(process.execPath,['scripts/test_server.mjs'],{env:{...process.env,QT_TEST_PORT:'0'},stdio:['ignore','pipe','pipe'],windowsHide:true});
const base=await new Promise((resolve,reject)=>{server.stdout.on('data',data=>{const url=data.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(url)resolve(url);});server.once('error',reject);});
const binary=process.env.QT_CHROMIUM_BINARY || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/opt/google/chrome/chrome','/usr/bin/google-chrome','/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p=>existsSync(p));
if(!binary){server.kill();throw new Error('Set QT_CHROMIUM_BINARY to a Chromium browser executable.');}
const manifest=JSON.parse(await readFile(extension+'/manifest.json','utf8'));manifest.host_permissions=['http://127.0.0.1/*'];
await writeFile(extension+'/manifest.json',JSON.stringify(manifest));
await writeFile(extension+'/bootstrap.json',JSON.stringify({endpoint:base+'/v1',model:'mock-model',apiKey:'dummy-local-test-key'}));
const legacy=/comet|msedge|brave/i.test(binary);
const args=legacy?['--load-extension='+extension,'--disable-extensions-except='+extension]:['--enable-unsafe-extension-debugging'];
const config={browser:{browserName:'chromium',launchOptions:{executablePath:binary,headless:true,args,ignoreDefaultArgs:['--disable-extensions']},contextOptions:{viewport:{width:1360,height:1000},locale:process.env.QT_BROWSER_LOCALE || 'en-US'}},outputDir:output};
await writeFile(output+'/config.json',JSON.stringify(config));
const cli=path.resolve('node_modules/@playwright/cli/playwright-cli.js');
async function command(...args){
  const result=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[cli,'-s='+session,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let data='';
    child.stdout.on('data',s=>data+=s);child.stderr.on('data',s=>data+=s);
    child.once('error',reject);child.once('exit',code=>code||data.includes('### Error')?reject(new Error(data)):resolve(data));
  });
  return result;
}
try {
  await command('open','about:blank','--config',output+'/config.json','--persistent','--profile',output+'/profile');
  if(!legacy){
    await writeFile(output+'/load.js',`async page => {const client=await page.context().browser().newBrowserCDPSession();return client.send('Extensions.loadUnpacked',{path:${JSON.stringify(extension)}});}`);
    await command('run-code','--filename',output+'/load.js');
  }
  const setup=(await readFile('tests/browser-setup.js','utf8')).replaceAll('http://127.0.0.1:63717',base);
  await writeFile(output+'/setup.js',setup);await command('run-code','--filename',output+'/setup.js');
  for(const file of ['browser-stress.js','browser-compatibility.js','browser-frontend.js','browser-installation.js','browser-providers.js']){
    const source=(await readFile('tests/'+file,'utf8')).replace('"__QT_OUTPUT__"',JSON.stringify(output));
    await writeFile(output+'/'+file,source);
    const result=await command('run-code','--filename',output+'/'+file);
    await writeFile(output+'/'+file+'.log',result);
    const checks=JSON.parse(result.split('### Result\n')[1].split('\n###')[0].trim());
    console.log(`${file}: ${checks.filter(c=>c.pass).length} checks passed`);
  }
  console.log('Browser reports: '+output);
} catch (error) {
  await writeFile(output+'/failure.log',String(error.stack || error));
  const diagnostic=`async page => {const c=page.context();const pages=[];for(const p of c.pages()){pages.push({url:p.url(),state:await p.evaluate(()=>({visibility:document.visibilityState,lines:document.querySelectorAll('qt-line').length,text:document.querySelector('qt-overlay')?.shadowRoot.querySelector('.toast')?.textContent,errors:[...document.querySelectorAll('qt-line')].map(e=>e.shadowRoot.querySelector('.error')?.textContent).filter(Boolean)})).catch(e=>({error:e.message}))});}return {pages};}`;
  await writeFile(output+'/diagnostic.js',diagnostic);
  await writeFile(output+'/diagnostic.log',await command('run-code','--filename',output+'/diagnostic.js').catch(e=>String(e)));
  throw error;
} finally {await command('close').catch(()=>{});server.kill();}
