const TTL = 7 * 86400000;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_ENTRIES = 600;

export class TranslationCache {
  constructor() { this.memory = new Map(); this.dbPromise = null; this.writes = 0; this.epoch = 0; }
  database() {
    return this.dbPromise ||= new Promise((resolve, reject) => {
      const req = indexedDB.open('quiet-translations', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('entries', {keyPath: 'key'});
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
  }
  async operation(mode, action) {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('entries', mode);
      const request = action(tx.objectStore('entries'));
      tx.oncomplete = () => resolve(request?.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  remember(entry) {
    this.memory.delete(entry.key); this.memory.set(entry.key, entry);
    while (this.memory.size > 100) this.memory.delete(this.memory.keys().next().value);
  }
  async get(key) {
    let entry = this.memory.get(key);
    if (!entry) try { entry = await this.operation('readonly', store => store.get(key)); } catch {}
    if (!entry || Date.now() - entry.at > TTL) { this.memory.delete(key); return null; }
    this.remember(entry); return entry.value;
  }
  async put(key, value, epoch = this.epoch) {
    if (epoch !== this.epoch) return;
    const entry = {key, value, at: Date.now(), bytes: value.length * 2 + key.length * 2 + 64};
    this.remember(entry);
    try {
      await this.operation('readwrite', store => store.put(entry));
      if (++this.writes % 10 === 0) await this.prune();
    } catch { /* A full/unavailable cache must never break translation. */ }
  }
  async prune() {
    const all = (await this.operation('readonly', store => store.getAll())).sort((a, b) => b.at - a.at);
    let bytes = 0, count = 0;
    const remove = [];
    for (const entry of all) {
      bytes += entry.bytes; count++;
      if (Date.now() - entry.at > TTL || bytes > MAX_BYTES || count > MAX_ENTRIES) remove.push(entry.key);
    }
    if (remove.length) await this.operation('readwrite', store => { for (const key of remove) { store.delete(key); this.memory.delete(key); } });
  }
  async stats() {
    try {
      await this.prune();
      const entries = await this.operation('readonly', store => store.getAll());
      return {entries: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0)};
    } catch { return {entries: this.memory.size, bytes: 0}; }
  }
  async clear() { this.epoch++; this.memory.clear(); await this.operation('readwrite', store => store.clear()).catch(() => {}); }
}
