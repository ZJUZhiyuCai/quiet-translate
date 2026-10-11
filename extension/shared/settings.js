// Extension-origin IndexedDB is inaccessible to website-origin content scripts.
// Comet 139 does not expose storage.local.setAccessLevel, so credentials must not
// rely on that optional Chrome API for isolation.
export class SettingsStore {
  constructor() { this.dbPromise = null; }
  database() {
    return this.dbPromise ||= new Promise((resolve, reject) => {
      const request = indexedDB.open('quiet-private-settings', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('config');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('无法打开本地设置，请重新启用扩展。'));
    });
  }
  async access(mode, callback) {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('config', mode);
      const request = callback(tx.objectStore('config'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(new Error('无法保存本地设置，请检查浏览器存储空间。'));
    });
  }
  get() { return this.access('readonly', store => store.get('settings')); }
  set(settings) { return this.access('readwrite', store => store.put(settings, 'settings')); }
}
