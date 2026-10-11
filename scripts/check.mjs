import {readFile, readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve('extension');
async function files(dir) {
  const all = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const name = path.join(dir, entry.name);
    all.push(...(entry.isDirectory() ? await files(name) : [name]));
  }
  return all;
}
const list = await files(root);
for (const file of list) {
  if (file.endsWith('.js')) {
    const check = spawnSync(process.execPath, ['--check', file], {encoding: 'utf8'});
    assert.equal(check.status, 0, check.stderr);
  }
  if (file.endsWith('.html')) {
    const html = await readFile(file, 'utf8');
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>\s*\S/i.test(html), 'No inline executable script: ' + file);
    assert.ok(!/\son\w+=/i.test(html), 'No inline event handlers: ' + file);
  }
}
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json')));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(JSON.parse(await readFile(path.join(root, 'bootstrap.json'))), {});
assert.equal(await readFile(path.join(root, 'LICENSE'), 'utf8'), await readFile('LICENSE', 'utf8'));
assert.ok(!manifest.web_accessible_resources, 'Credentials/resources must not be web accessible');
for (const resource of [manifest.background.service_worker, manifest.action.default_popup, manifest.options_page, ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap(s => s.js)]) {
  assert.ok(list.includes(path.join(root, resource)), 'Missing manifest asset: ' + resource);
}
console.log(`Checked ${list.length} extension files: syntax, CSP, manifest resources, public bootstrap.`);
