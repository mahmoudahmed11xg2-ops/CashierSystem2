// تخزين مؤقت داخل الذاكرة فقط.
// لا يوجد سيرفر، ولا Local Storage، ولا مزامنة خارجية في هذا الإصدار.
// لذلك البيانات تختفي عند إعادة تحميل الصفحة أو إغلاق البرنامج.

export const DOMAINS = {
  categories:{key:'cs_cats'}, items:{key:'cs_items'}, recipes:{key:'cs_recipes'}, stock:{key:'cs_stock'}, tables:{key:'cs_tables'}, customers:{key:'cs_customers'}, suppliers:{key:'cs_suppliers'}, captains:{key:'cs_captains'}, staff:{key:'cs_staff'}, users:{key:'cs_users'}, storeConfig:{key:'cs_configs',isObject:true}, orders:{key:'cs_orders'}, expenses:{key:'cs_expenses'}, guardLogs:{key:'cs_guard_logs'}, shiftsLog:{key:'cs_shifts_log'}, activeShift:{key:'cs_active_shift',isObject:true,nullable:true}
};

const memory = new Map();
const nativeStorage = {
  getItem: Storage.prototype.getItem.bind(window.localStorage),
  setItem: Storage.prototype.setItem.bind(window.localStorage),
  removeItem: Storage.prototype.removeItem.bind(window.localStorage)
};

// امسح بقايا نسخ النظام القديمة مرة واحدة، ثم امنع أي بيانات cs_ من
// الوصول إلى Local Storage. الصفحات القديمة تظل متوافقة لكنها تستخدم RAM.
for (let i = window.localStorage.length - 1; i >= 0; i--) {
  const key = window.localStorage.key(i);
  if (key?.startsWith('cs_')) nativeStorage.removeItem(key);
}
const originalGet = Storage.prototype.getItem;
const originalSet = Storage.prototype.setItem;
const originalRemove = Storage.prototype.removeItem;
Storage.prototype.getItem = function(key) {
  return String(key).startsWith('cs_') ? (memory.has(key) ? memory.get(key) : null) : originalGet.call(this, key);
};
Storage.prototype.setItem = function(key, value) {
  if (String(key).startsWith('cs_')) { memory.set(key, String(value)); return; }
  return originalSet.call(this, key, value);
};
Storage.prototype.removeItem = function(key) {
  if (String(key).startsWith('cs_')) { memory.delete(key); return; }
  return originalRemove.call(this, key);
};

function emptyFor(domain) { return domain.isObject ? (domain.nullable ? null : {}) : []; }
function clone(value) { return value === undefined ? value : JSON.parse(JSON.stringify(value)); }
function get(name) { const domain = DOMAINS[name]; return domain ? (memory.has(domain.key) ? JSON.parse(memory.get(domain.key)) : emptyFor(domain)) : []; }
function set(name, value) {
  const domain = DOMAINS[name]; if (!domain) return;
  const saved = JSON.stringify(value); memory.set(domain.key, saved);
  window.dispatchEvent(new CustomEvent('cs:datachange', { detail: { domain: name, value: clone(value), remote: false } }));
}
async function loadDomain(name) { return get(name); }
async function init(names = []) { return Promise.all(names.map(loadDomain)); }
async function unavailable() { throw new Error('المزامنة غير متاحة: النظام يعمل محلياً بدون سيرفر أو تخزين دائم.'); }

export const DataService = { init, loadDomain, get, set, DOMAINS, pushAllToGitHub: unavailable, pullAllFromGitHub: unavailable, syncFromGitHubQuietly: unavailable, syncFromServer: unavailable };
export default DataService;
