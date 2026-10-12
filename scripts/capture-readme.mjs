// Capture the actual extension UI with authored translations replayed on localhost.
// This never reads a personal browser profile or contacts a model provider.
import http from 'node:http';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {readFile, writeFile, mkdir, cp} from 'node:fs/promises';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'output/playwright/readme-' + Date.now() + '-' + randomUUID().slice(0, 8));
const images = path.join(output, 'images');
await mkdir(images, {recursive: true});
const entries = JSON.parse(await readFile(path.join(root, 'tests/fixtures/readme-translations.json'), 'utf8'));
const normalize = value => value.replace(/\s+/g, ' ').trim();
const translations = new Map(entries.map(([source, result]) => [normalize(source), result]));
const passages = [entries[2], entries[3], entries[6]];
const source = passages.map(pair => pair[0]).join('\n\n');
const result = passages.map(pair => pair[1]).join('\n\n');
translations.set(normalize(source), result);
const article = await readFile(path.join(root, 'tests/fixtures/article.html'));
const unknownSources = [];
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/article') {
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); return res.end(article);
    }
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') { res.writeHead(404); return res.end(); }
    let body = ''; for await (const part of req) body += part;
    const input = JSON.parse(body).messages.at(-1).content;
    const text = translations.get(normalize(input));
    if (text === undefined) { unknownSources.push(input); res.writeHead(422); return res.end('{}'); }
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache'});
    res.write('data: ' + JSON.stringify({choices: [{delta: {content: text}}]}) + '\n\n');
    res.end('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
  } catch { res.writeHead(400); res.end('{}'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const binary = process.env.QT_CHROMIUM_BINARY || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/google/chrome/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync);
if (!binary) { server.close(); throw new Error('Set QT_CHROMIUM_BINARY to a Chromium executable.'); }
const cli = path.join(root, 'node_modules/@playwright/cli/playwright-cli.js');
const legacy = /comet|msedge|brave/i.test(binary);
const reports = [];
try {
  for (const locale of ['en-US', 'zh-CN']) {
    const dir = path.join(output, locale), extension = path.join(dir, 'extension');
    const session = 'readme-' + locale + '-' + randomUUID().slice(0, 8);
    await mkdir(dir, {recursive: true}); await cp(path.join(root, 'extension'), extension, {recursive: true});
    const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
    manifest.host_permissions = ['http://127.0.0.1/*'];
    await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
    await writeFile(path.join(extension, 'bootstrap.json'), JSON.stringify({endpoint: base + '/v1', model: 'demo-replay', authMode: 'none', cache: true, theme: 'light'}));
    const args = legacy ? ['--load-extension=' + extension, '--disable-extensions-except=' + extension] : ['--enable-unsafe-extension-debugging'];
    await writeFile(path.join(dir, 'config.json'), JSON.stringify({browser: {browserName: 'chromium', launchOptions: {executablePath: binary, headless: true, args, ignoreDefaultArgs: ['--disable-extensions']}, contextOptions: {viewport: {width: 1280, height: 960}, locale}}, outputDir: dir}));
    const command = (...args) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, '-s=' + session, ...args], {cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
      let text = ''; child.stdout.on('data', data => text += data); child.stderr.on('data', data => text += data);
      child.once('error', reject); child.once('exit', code => code || text.includes('### Error') ? reject(new Error(text)) : resolve(text));
    });
    try {
      await command('open', 'about:blank', '--config', path.join(dir, 'config.json'), '--persistent', '--profile', path.join(dir, 'profile'));
      if (!legacy) {
        await writeFile(path.join(dir, 'load.js'), `async page => {const c = await page.context().browser().newBrowserCDPSession(); return c.send('Extensions.loadUnpacked', {path: ${JSON.stringify(extension)}});}`);
        await command('run-code', '--filename', path.join(dir, 'load.js'));
      }
      const payload = {base, output: images, locale, source, result, firstResult: entries[2][1]};
      const code = (await readFile(path.join(root, 'scripts/capture-readme-browser.js'), 'utf8')).replace('"__QT_CAPTURE__"', JSON.stringify(payload));
      await writeFile(path.join(dir, 'capture.js'), code);
      const log = await command('run-code', '--filename', path.join(dir, 'capture.js'));
      await writeFile(path.join(dir, 'capture.log'), log);
      reports.push(JSON.parse(log.split('### Result\n')[1].split('\n###')[0].trim()));
      console.log(locale + ': captured bilingual reading, selection, and workspace');
    } finally { await command('close').catch(() => {}); }
  }
  if (unknownSources.length) throw new Error('Missing demo translations: ' + JSON.stringify(unknownSources));
  await writeFile(path.join(output, 'report.json'), JSON.stringify(reports, null, 2) + '\n');
  console.log('Review screenshots before copying into docs/assets/: ' + images);
} finally { await new Promise(resolve => server.close(resolve)); }
