// Portable preferences are explicit files, never automatic exports or browser sync.
import {DEFAULTS, validateSettings} from './core.js';
import {t} from './i18n.js';

const FORMAT = 'quiet-translate-profile';
const ENCRYPTED = 'quiet-translate-encrypted';
const ITERATIONS = 310000;
export const MAX_PROFILE_BYTES = 128 * 1024;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const fail = () => new Error(t('这不是受支持的轻译配置文件。'));

export function profileSettings(value) {
  if (!object(value) || Object.keys(value).some(key => !(key in DEFAULTS) || !Object.hasOwn(DEFAULTS, key))) throw fail();
  for (const [key, item] of Object.entries(value)) {
    const expected = DEFAULTS[key];
    if (Array.isArray(expected) ? !Array.isArray(item) || item.some(v => typeof v !== 'string') : typeof item !== typeof expected) throw fail();
  }
  if (JSON.stringify(value).length > MAX_PROFILE_BYTES) throw fail();
  return validateSettings(value, DEFAULTS);
}

export function makeProfile(settings, includeKey = false) {
  const clean = profileSettings(Object.fromEntries(Object.keys(DEFAULTS).map(key => [key, settings[key] ?? DEFAULTS[key]])));
  if (!includeKey) delete clean.apiKey;
  const profile = {format: FORMAT, version: 1, settings: clean};
  if (new TextEncoder().encode(JSON.stringify(profile, null, 2)).length + 1 > MAX_PROFILE_BYTES) throw fail();
  return profile;
}

const encode = value => {
  let binary = '';
  for (let start = 0; start < value.length; start += 8192) binary += String.fromCharCode(...value.subarray(start, start + 8192));
  return btoa(binary);
};
function decode(value, length) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length > MAX_PROFILE_BYTES) throw fail();
  const bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0));
  if (length && bytes.length !== length) throw fail();
  return bytes;
}
async function keyFor(password, salt) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 1024) throw new Error(t('备份口令请使用 10 至 1024 个字符。'));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256'}, material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}

export async function encryptProfile(settings, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(makeProfile(settings, true)));
  if (plaintext.length > 90000) throw fail(); // Keep the base64 envelope within the import limit.
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(ENCRYPTED + ':1')}, key, plaintext);
  return {format: ENCRYPTED, version: 1, algorithm: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext))};
}

export async function readProfile(text, password = '') {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_PROFILE_BYTES) throw fail();
  let data;
  try { data = JSON.parse(text); } catch { throw fail(); }
  if (!object(data) || data.version !== 1) throw fail();
  const encrypted = data.format === ENCRYPTED;
  if (encrypted) {
    if (data.algorithm !== 'AES-256-GCM' || data.kdf !== 'PBKDF2-SHA256' || data.iterations !== ITERATIONS) throw fail();
    const salt = decode(data.salt, 16), iv = decode(data.iv, 12), ciphertext = decode(data.ciphertext);
    const key = await keyFor(password, salt);
    try {
      const decrypted = await crypto.subtle.decrypt({name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(ENCRYPTED + ':1')}, key, ciphertext);
      data = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(decrypted));
    } catch { throw new Error(t('口令不正确，或备份文件已损坏。')); }
  }
  if (data.format !== FORMAT || data.version !== 1 || !object(data.settings)) throw fail();
  if (!encrypted && data.settings.apiKey) throw new Error(t('请使用不含密钥的配置文件，或加密备份。'));
  const settings = profileSettings(data.settings);
  return {settings, hasKey: Boolean(settings.apiKey), encrypted};
}
