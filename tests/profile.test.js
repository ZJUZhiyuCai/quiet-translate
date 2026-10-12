import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS} from '../extension/shared/core.js';
import {makeProfile, encryptProfile, readProfile, MAX_PROFILE_BYTES} from '../extension/shared/profile.js';

const settings = {...DEFAULTS, model: 'model-1', apiKey: 'private-test-key', glossary: 'token = 词元', autoSites: ['example.com']};
const password = 'a sufficiently long test passphrase';
test('portable preferences round-trip without a credential or runtime state', async () => {
  const profile = makeProfile({...settings, configured: true});
  const text = JSON.stringify(profile);
  assert.ok(!text.includes('private-test-key') && !text.includes('configured'));
  const imported = await readProfile(text);
  assert.equal(imported.settings.model, settings.model);
  assert.equal(imported.settings.apiKey, '');
  assert.equal(imported.settings.glossary, settings.glossary);
  assert.deepEqual(imported.settings.autoSites, settings.autoSites);
});
test('encrypted backup restores all settings, uses fresh salt/IV, rejects a wrong password and tampering', async () => {
  const first = await encryptProfile(settings, password), second = await encryptProfile(settings, password);
  assert.notEqual(first.salt, second.salt); assert.notEqual(first.iv, second.iv);
  const text = JSON.stringify(first);
  assert.ok(!text.includes(settings.apiKey) && !text.includes(settings.endpoint));
  assert.deepEqual((await readProfile(text, password)).settings, settings);
  await assert.rejects(readProfile(text, 'wrong password value'), /口令/);
  first.ciphertext = (first.ciphertext[0] === 'A' ? 'B' : 'A') + first.ciphertext.slice(1);
  await assert.rejects(readProfile(JSON.stringify(first), password), /口令/);
});
test('imports reject secrets in plaintext, future formats, prototype keys, invalid endpoints and hostile types', async () => {
  const wrap = value => JSON.stringify({format: 'quiet-translate-profile', version: 1, settings: value});
  for (const text of [wrap({apiKey: 'secret'}), wrap({endpoint: 'http://evil.example'}), wrap({autoSites: [4]}), wrap({selection: 'yes'}), wrap({model: '<script>'}), wrap({removeKey: true}), wrap(JSON.parse('{"__proto__":{}}')), JSON.stringify({...makeProfile(settings), version: 2}), 'x'.repeat(MAX_PROFILE_BYTES + 1)]) {
    await assert.rejects(readProfile(text));
  }
  assert.equal({}.polluted, undefined);
});
test('encrypted import has bounded parameters and key derivation; weak export passwords are rejected', async () => {
  await assert.rejects(encryptProfile(settings, 'short'), /口令/);
  const profile = await encryptProfile(settings, password);
  await assert.rejects(readProfile(JSON.stringify({...profile, iterations: 2 ** 30}), password));
  await assert.rejects(readProfile(JSON.stringify({...profile, salt: 'AAAA'}), password));
});
