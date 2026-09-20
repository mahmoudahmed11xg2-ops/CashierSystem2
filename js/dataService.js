// ============================================================
//  Data Service — طبقة التخزين الذكية (مُصلحة)
//  1) لا يمسح أي بيانات محلية لم تُرفع للسحابة بعد
//  2) رفع أسرع + فلاش عند إغلاق الصفحة
//  3) مزامنة لحظية بين أجهزة المحل عبر السيرفر لو موجود
// ============================================================
import { fetchFileFromGitHub, saveFileToGitHub, getGitHubConfig, checkGitHubRepoAccess } from './githubSync.js';

export const DOMAINS = {
  categories:  { key: 'cs_cats',         file: 'data/catalog/categories.json' },
  items:       { key: 'cs_items',        file: 'data/catalog/items.json' },
  recipes:     { key: 'cs_recipes',      file: 'data/catalog/recipes.json' },
  stock:       { key: 'cs_stock',        file: 'data/inventory/stock.json' },
  tables:      { key: 'cs_tables',       file: 'data/tables/tables.json' },
  customers:   { key: 'cs_customers',    file: 'data/crm/customers.json' },
  suppliers:   { key: 'cs_suppliers',    file: 'data/crm/suppliers.json' },
  captains:    { key: 'cs_captains',     file: 'data/crm/captains.json' },
  staff:       { key: 'cs_staff',        file: 'data/crm/staff.json' },
  storeConfig: { key: 'cs_configs',      file: 'data/settings/store-config.json', isObject: true },
  orders:        { key: 'cs_orders',       file: 'data/transactions/orders.json' },
  expenses:      { key: 'cs_expenses',     file: 'data/transactions/expenses.json' },
  guardLogs:     { key: 'cs_guard_logs',   file: 'data/transactions/guard-logs.json' },
  shiftsLog:     { key: 'cs_shifts_log',   file: 'data/transactions/shifts-log.json' },
  activeShift:   { key: 'cs_active_shift', file: 'data/transactions/active-shift.json', isObject: true, nullable: true }
};

// GitHub is used only for master/configuration data. Live operational data
// (tables, open sessions, rounds, orders, shifts, expenses, guard logs and
// current stock) must never be pulled from GitHub or pushed there by Auto Sync.
// The local/server data layer remains authoritative for those domains.
export const GITHUB_SYNC_DOMAINS = new Set([
  'categories', 'items', 'recipes',
  'customers', 'suppliers', 'captains', 'staff',
  'storeConfig'
]);

export const LIVE_OPERATION_DOMAINS = new Set([
  'tables', 'orders', 'expenses', 'guardLogs', 'shiftsLog', 'activeShift', 'stock'
]);

export const DEFAULT_CATEGORIES = [
  { id: 1, name: "مشويات" },
  { id: 2, name: "مقبلات وسلطات" },
  { id: 3, name: "مشروبات" },
  { id: 4, name: "حلويات" },
  { id: 5, name: "ساندوتشات ووجبات سريعة" }
];

const KEY_TO_DOMAIN = {};
for (const [n, d] of Object.entries(DOMAINS)) KEY_TO_DOMAIN[d.key] = n;

// ── إدارة "بيانات لم تُرفع بعد" (dirty flags تدوم بين تحديثات الصفحات) ──
const DIRTY_KEY = 'cs_dirty_domains';
function getDirtySet() {
  try {
    const raw = JSON.parse(localStorage.getItem(DIRTY_KEY) || '[]');
    return new Set(raw.filter(name => GITHUB_SYNC_DOMAINS.has(name)));
  } catch { return new Set(); }
}
function markDirty(name) {
  const s = getDirtySet(); s.add(name);
  localStorage.setItem(DIRTY_KEY, JSON.stringify([...s]));
}
function clearDirty(name) {
  const s = getDirtySet(); s.delete(name);
  localStorage.setItem(DIRTY_KEY, JSON.stringify([...s]));
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (err) { console.warn('DataService: تعذر الحفظ المحلي', key, err); }
}

// ── مزامنة لحظية بين أجهزة المحل عبر سيرفر Socket.io ──
let socket = null;
function connectRealtimeServer() {
  if (typeof window === 'undefined' || socket) return;

  function initSocket() {
    try {
      socket = window.io();
      socket.on('connect', () => {
        console.log('[Realtime] متصل بسيرفر النظام بنجاح');
      });
      socket.on('cs:update', ({ file, domain, value }) => {
        let domName = domain;
        if (!domName && file) {
          for (const [n, d] of Object.entries(DOMAINS)) {
            if (d.file === file) { domName = n; break; }
          }
        }
        if (domName && DOMAINS[domName]) {
          writeCache(DOMAINS[domName].key, value);
          window.dispatchEvent(new CustomEvent('cs:datachange', { detail: { domain: domName, value, remote: true } }));
          broadcastChange(domName, value, true);
        }
      });
      socket.on('cs:reload', () => {
        window.location.reload();
      });
    } catch (e) {
      console.warn('[Realtime] خطأ في تهيئة Socket.io:', e);
    }
  }

  if (window.io) {
    initSocket();
  } else {
    const s = document.createElement('script');
    s.src = '/socket.io/socket.io.js';
    s.onload = initSocket;
    s.onerror = () => { console.warn('[Realtime] تعذر تحميل مكتبة Socket.io'); };
    document.head.appendChild(s);
  }
}

// ── سحب هادئ من GitHub: لا يمسح أبداً بيانات "متسخة" (لم تُرفع) ──
async function syncFromGitHubQuietly(domainNames = []) {
  const cfg = getGitHubConfig();
  if (!cfg.token || !cfg.repo || !cfg.autoSync) return;

  const dirty = getDirtySet();
  const requested = domainNames.length ? domainNames : [...GITHUB_SYNC_DOMAINS];
  const list = requested.filter(name => GITHUB_SYNC_DOMAINS.has(name));

  for (const name of list) {
    const domain = DOMAINS[name];
    if (!domain || !domain.file) continue;
    if (dirty.has(name)) {
      // عندنا نسخة أحدث لم تُرفع → ارفعها بدل ما تسحب القديمة فوقها
      schedulePushToGitHub(name, get(name));
      continue;
    }
    try {
      const res = await fetchFileFromGitHub(domain.file);
      if (res && res.content !== undefined) {
        writeCache(domain.key, res.content);
        window.dispatchEvent(new CustomEvent('cs:datachange', { detail: { domain: name, value: res.content, remote: true } }));
      }
    } catch (e) { console.warn(`[SilentSync] تعذرت مزامنة ${name}`, e); }
  }
}

// ── بث بين تبويبات نفس المتصفح ──
let syncChannel = null;
try {
  syncChannel = new BroadcastChannel('cs_pos_sync_channel');
  syncChannel.onmessage = (event) => {
    if (event.data && event.data.domain) {
      const domName = event.data.domain;
      const domCfg = DOMAINS[domName];
      if (domCfg && event.data.value !== undefined) {
        writeCache(domCfg.key, event.data.value);
      }
      window.dispatchEvent(new CustomEvent('cs:datachange', {
        detail: { domain: domName, value: event.data.value, remote: !!event.data.remote, fromOtherTab: true }
      }));
    }
  };
} catch (e) {}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key) return;
    for (const [domName, domCfg] of Object.entries(DOMAINS)) {
      if (domCfg.key === e.key) {
        const val = readCache(domCfg.key);
        window.dispatchEvent(new CustomEvent('cs:datachange', {
          detail: { domain: domName, value: val, remote: false, fromStorageEvent: true }
        }));
        break;
      }
    }
  });
}

function broadcastChange(name, value, remote = false) {
  if (syncChannel) {
    try {
      syncChannel.postMessage({
        domain: name,
        value,
        remote: !!remote,
        timestamp: Date.now()
      });
    } catch (err) {}
  }
}

export function onDataChange(domains, callback) {
  const domainList = Array.isArray(domains) ? domains : [domains];
  const listener = (event) => {
    const changed = event.detail?.domain;
    if (domainList.includes(changed) || domainList.includes('*')) {
      try { callback(event.detail); } catch (err) { console.error('listener error ' + changed, err); }
    }
  };
  window.addEventListener('cs:datachange', listener);
  return () => window.removeEventListener('cs:datachange', listener);
}

// ── رفع للسحابة: 800ms فقط + فلاش عند قفل الصفحة ──
const pendingSyncTimers = {};
function schedulePushToGitHub(name, value) {
  if (!GITHUB_SYNC_DOMAINS.has(name)) return;
  const cfg = getGitHubConfig();
  const domain = DOMAINS[name];
  if (!domain || !domain.file) return;

  // Mark it dirty until GitHub explicitly confirms the write. This is
  // intentionally independent from the local/server persistence status.
  markDirty(name);
  if (!cfg.token || !cfg.repo || !cfg.autoSync) return;

  if (pendingSyncTimers[name]) clearTimeout(pendingSyncTimers[name]);
  pendingSyncTimers[name] = setTimeout(async () => {
    try {
      await saveFileToGitHub(domain.file, value, `Auto update: ${name}`);
      clearDirty(name);
    } catch (err) {
      console.warn(`[SilentPush] تعذر رفع ${name}`, err); // يفضل متسخ → محمي من السحب العكسي
    }
  }, 800);
}

// فلاش: لو قفلت الصفحة قبل ما الرفع يحصل
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    const dirty = getDirtySet();
    const cfg = getGitHubConfig();
    if (!cfg.token || !cfg.repo) return;
    for (const name of dirty) {
      if (!GITHUB_SYNC_DOMAINS.has(name)) continue;
      const domain = DOMAINS[name];
      const value = readCache(domain.key);
      if (value === null) continue;
      try {
        const jsonStr = JSON.stringify(value, null, 2);
        const bytes = new TextEncoder().encode(jsonStr);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        fetch(`https://api.github.com/repos/${cfg.repo}/contents/${domain.file}`, {
          method: 'PUT', keepalive: true,
          headers: {
            'Authorization': `Bearer ${cfg.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: `Flush: ${name}`, content: btoa(bin), branch: cfg.branch || 'main' })
        });
      } catch (e) {}
    }
  });
}

async function loadDomain(name) {
  const domain = DOMAINS[name];
  if (!domain) return [];

  // 1. المحاولة الأولى: قراءة أحدث بيانات من ديسك السيرفر المباشر (تضمن عدم ضياع أي طلبات أو تعديلات)
  try {
    const res = await fetch('/api/data/' + name);
    if (res.ok) {
      const serverData = await res.json();
      if (serverData !== undefined && serverData !== null) {
        if (name === 'categories' && Array.isArray(serverData) && serverData.length === 0) {
          writeCache(domain.key, DEFAULT_CATEGORIES);
          return DEFAULT_CATEGORIES;
        }
        writeCache(domain.key, serverData);
        return serverData;
      }
    }
  } catch (apiErr) {
    // السيرفر غير متوفر مؤقتاً، نكمل بالتخزين المحلي
  }

  // 2. المحاولة الثانية: الكاش المحلي في المتصفح
  let cached = readCache(domain.key);
  if (cached !== null) {
    if (name === 'categories' && Array.isArray(cached) && cached.length === 0) {
      cached = DEFAULT_CATEGORIES;
      writeCache(domain.key, cached);
    }
    return cached;
  }

  // 3. المحاولة الثالثة: الملف الاستاتيكي
  try {
    const res = await fetch('/' + domain.file);
    if (res.ok) {
      const data = await res.json();
      if (data !== undefined && data !== null) {
        writeCache(domain.key, data);
        return data;
      }
    }
  } catch (err) { console.warn(`تعذر قراءة ${domain.file}`, err); }

  if (name === 'categories') { writeCache(domain.key, DEFAULT_CATEGORIES); return DEFAULT_CATEGORIES; }
  const fallback = domain.isObject ? (domain.nullable ? null : {}) : [];
  writeCache(domain.key, fallback);
  return fallback;
}

async function init(names = []) {
  await Promise.all(names.map(loadDomain));
  connectRealtimeServer();
  syncFromGitHubQuietly(names).catch(() => {});
}

function get(name) {
  const domain = DOMAINS[name];
  if (!domain) return [];
  const value = readCache(domain.key);
  return value ?? (domain.isObject ? (domain.nullable ? null : {}) : []);
}

function set(name, value) {
  const domain = DOMAINS[name];
  if (!domain) return;

  // 1) تحديث فوري للكاش المحلي في نافذة المتصفح الحالية (0ms)
  writeCache(domain.key, value);

  // 2) إطلاق حدث التحديث داخل الصفحة
  window.dispatchEvent(new CustomEvent('cs:datachange', { detail: { domain: name, value, remote: false } }));

  // 3) بث التحديث اللحظي لجميع التبويبات الأخرى المفتوحة في المتصفح
  broadcastChange(name, value, false);

  // 4) حفظ دائم وحقيقي على القرص الصلب للسيرفر عبر API لضمان بقائها حتى لو قفلت الصفحة
  fetch('/api/data/' + name, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  }).then(res => {
    if (!res.ok && GITHUB_SYNC_DOMAINS.has(name)) {
      markDirty(name);
    }
  }).catch(() => {
    if (GITHUB_SYNC_DOMAINS.has(name)) markDirty(name);
  });

  // 5) بث فوري عبر Socket.io لجميع الأجهزة والشاشات المتصلة بالسيرفر
  if (socket && socket.connected) {
    try {
      socket.emit('cs:update', { file: domain.file, domain: name, value });
      clearDirty(name);
    } catch (e) {}
  }

  // 6) جدولة الرفع للسحابة (GitHub) إن وُجد
  schedulePushToGitHub(name, value);
}

// ── بدائل آمنة للكتابة/القراءة المباشرة في الصفحات ──
export function setByKey(key, value) {
  const name = KEY_TO_DOMAIN[key];
  if (name) set(name, value);
  else writeCache(key, value);
}
export function getByKey(key) {
  const name = KEY_TO_DOMAIN[key];
  if (name) return get(name);
  return readCache(key);
}

async function pushAllToGitHub() {
  const cfg = getGitHubConfig();
  if (!cfg.token || !cfg.repo) throw new Error('يرجى ملء بيانات المستودع والـ Token في صفحة الإعدادات.');
  const repoInfo = await checkGitHubRepoAccess(cfg);
  const results = [];

  for (const name of GITHUB_SYNC_DOMAINS) {
    const domain = DOMAINS[name];
    const val = get(name);
    if (val === undefined || val === null) continue;
    await saveFileToGitHub(domain.file, val, `Manual Push: ${name}`);
    clearDirty(name);
    results.push({ name, file: domain.file, ok: true });
  }

  return { results, totalPushed: results.length, repoName: repoInfo.fullName };
}

async function pullAllFromGitHub() {
  const cfg = getGitHubConfig();
  if (!cfg.token || !cfg.repo) throw new Error('يرجى ملء بيانات المستودع والـ Token في صفحة الإعدادات.');
  const repoInfo = await checkGitHubRepoAccess(cfg);
  const results = [];
  const dirty = getDirtySet();

  for (const name of GITHUB_SYNC_DOMAINS) {
    if (dirty.has(name)) {
      // Never replace a local copy whose GitHub update is still pending.
      continue;
    }
    const domain = DOMAINS[name];
    const res = await fetchFileFromGitHub(domain.file);
    if (res && res.content !== undefined) {
      writeCache(domain.key, res.content);
      window.dispatchEvent(new CustomEvent('cs:datachange', { detail: { domain: name, value: res.content, remote: true } }));
      broadcastChange(name, res.content, true);
      results.push({ name, file: domain.file, ok: true });
    }
  }

  if (results.length === 0) {
    throw new Error(`لم يتم سحب أي ملف. إما أن بيانات GitHub غير موجودة أو توجد تعديلات محلية لم تُرفع بعد.`);
  }
  return { results, totalPulled: results.length, repoName: repoInfo.fullName };
}

export const DataService = {
  init, loadDomain, get, set, getByKey, setByKey,
  on: onDataChange, DOMAINS,
  pushAllToGitHub, pullAllFromGitHub, syncFromGitHubQuietly
};
export default DataService;