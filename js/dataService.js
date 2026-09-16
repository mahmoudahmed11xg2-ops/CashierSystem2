// ============================================================
//  Data Service — طبقة التخزين الذكية (Local Cache + Silent GitHub Sync)
// ============================================================
// 1. يقرأ ويكتب فوراً في التخزين المحلي (سريع جداً 0ms وبدون أي تعليق).
// 2. مزامنة صامتة تماماً مع GitHub في الخلفية دون أي تدخل من الكاشير.
// 3. عند فتح النظام يسحب فوراً أي تعديلات سحابية حدثت من الهاتف/المنزل.

import { fetchFileFromGitHub, saveFileToGitHub, getGitHubConfig } from './githubSync.js';

export const DOMAINS = {
  categories:  { key: 'cs_cats', file: 'data/catalog/categories.json' },
  items:       { key: 'cs_items', file: 'data/catalog/items.json' },
  recipes:     { key: 'cs_recipes', file: 'data/catalog/recipes.json' },
  stock:       { key: 'cs_stock', file: 'data/inventory/stock.json' },
  tables:      { key: 'cs_tables', file: 'data/tables/tables.json' },
  customers:   { key: 'cs_customers', file: 'data/crm/customers.json' },
  suppliers:   { key: 'cs_suppliers', file: 'data/crm/suppliers.json' },
  captains:    { key: 'cs_captains', file: 'data/crm/captains.json' },
  staff:       { key: 'cs_staff', file: 'data/crm/staff.json' },
  storeConfig: { key: 'cs_configs', file: 'data/settings/store-config.json', isObject: true },
  orders:      { key: 'cs_orders', file: 'data/transactions/orders.json' },
  expenses:    { key: 'cs_expenses', file: 'data/transactions/expenses.json' },
  guardLogs:   { key: 'cs_guard_logs', file: 'data/transactions/guard-logs.json' },
  shiftsLog:   { key: 'cs_shifts_log', file: 'data/transactions/shifts-log.json' },
  activeShift: { key: 'cs_active_shift', file: 'data/transactions/active-shift.json', isObject: true, nullable: true }
};

// أقسام المنيو الافتراضية الجاهزة إذا كان النظام جديداً أو فارغاً
export const DEFAULT_CATEGORIES = [
  { id: 1, name: "مشويات" },
  { id: 2, name: "مقبلات وسلطات" },
  { id: 3, name: "مشروبات" },
  { id: 4, name: "حلويات" },
  { id: 5, name: "ساندوتشات ووجبات سريعة" }
];

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('DataService: تعذر الحفظ في التخزين المحلي', key, err);
  }
}

// مزامنة صامتة في الخلفية لجلب البيانات من GitHub عند بدء التشغيل
async function syncFromGitHubQuietly(domainNames = []) {
  const cfg = getGitHubConfig();
  if (!cfg.token || !cfg.repo || !cfg.autoSync) return;

  const domainsToSync = domainNames.length ? domainNames : Object.keys(DOMAINS);
  
  for (const name of domainsToSync) {
    const domain = DOMAINS[name];
    if (!domain || !domain.file) continue;

    try {
      const res = await fetchFileFromGitHub(domain.file);
      if (res && res.content !== undefined) {
        // تحديث الكاش المحلي بالبيانات الجديدة القادمة من GitHub
        writeCache(domain.key, res.content);
        window.dispatchEvent(new CustomEvent('cs:datachange', {
          detail: { domain: name, value: res.content, remote: true }
        }));
      }
    } catch (e) {
      console.warn(`[SilentSync] لم يتمكن من مزامنة ${name}`, e);
    }
  }
}

// دالة debounce لحفظ التعديلات على GitHub في الخلفية دون تعطيل واجهة المستخدم
const pendingSyncTimers = {};
function schedulePushToGitHub(name, value) {
  const cfg = getGitHubConfig();
  if (!cfg.token || !cfg.repo || !cfg.autoSync) return;

  const domain = DOMAINS[name];
  if (!domain || !domain.file) return;

  if (pendingSyncTimers[name]) {
    clearTimeout(pendingSyncTimers[name]);
  }

  // ننتظر ثانيتين بعد آخر كتابة للحفظ الهادئ
  pendingSyncTimers[name] = setTimeout(async () => {
    try {
      await saveFileToGitHub(domain.file, value, `Auto update: ${name}`);
    } catch (err) {
      console.warn(`[SilentPush] تعذر الرفع السحابي لـ ${name}`, err);
    }
  }, 2000);
}

async function loadDomain(name) {
  const domain = DOMAINS[name];
  if (!domain) return [];

  let cached = readCache(domain.key);
  if (cached !== null) {
    // إذا كان كاش الأقسام موجوداً لكنه مصفوفة فارغة
    if (name === 'categories' && Array.isArray(cached) && cached.length === 0) {
      cached = DEFAULT_CATEGORIES;
      writeCache(domain.key, cached);
    }
    return cached;
  }

  // إذا لم يكن مخزناً في localStorage نهائياً، نقرأ الملف المحلي الافتراضي
  try {
    const res = await fetch('/' + domain.file);
    if (res.ok) {
      const data = await res.json();
      if (data !== undefined && data !== null) {
        writeCache(domain.key, data);
        return data;
      }
    }
  } catch (err) {
    console.warn(`تعذر القراءة المباشرة للملف ${domain.file}`, err);
  }

  // Fallback للأقسام إذا تعذر قراءة الملف
  if (name === 'categories') {
    writeCache(domain.key, DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  }

  const fallback = domain.isObject ? (domain.nullable ? null : {}) : [];
  writeCache(domain.key, fallback);
  return fallback;
}

async function init(names = []) {
  // 1. نقرأ الكاش المحلي فوراً (0 مللي ثانية) ليعمل النظام فوراً أمام الكاشير
  await Promise.all(names.map(loadDomain));

  // 2. نبدأ مزامنة صامتة في الخلفية لجلب أي تعديل تم من المنزل عبر GitHub
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
  
  // حفظ محلي فوري
  writeCache(domain.key, value);
  window.dispatchEvent(new CustomEvent('cs:datachange', {
    detail: { domain: name, value, remote: false }
  }));

  // مزامنة سحابية صامتة في الخلفية مع GitHub
  schedulePushToGitHub(name, value);
}

// دالة تصدير لكل البيانات الحالية ورفعها دفعة واحدة إلى GitHub
async function pushAllToGitHub() {
  const cfg = getGitHubConfig();
  if (!cfg.token || !cfg.repo) throw new Error('يرجى ضبط بيانات GitHub أولاً');

  const results = [];
  for (const [name, domain] of Object.entries(DOMAINS)) {
    const val = get(name);
    if (val !== undefined && val !== null) {
      const ok = await saveFileToGitHub(domain.file, val, `Initial Push: ${name}`);
      results.push({ name, ok });
    }
  }
  return results;
}

// دالة سحب كل البيانات دفعة واحدة من GitHub
async function pullAllFromGitHub() {
  const cfg = getGitHubConfig();
  if (!cfg.token || !cfg.repo) throw new Error('يرجى ضبط بيانات GitHub أولاً');

  const results = [];
  for (const [name, domain] of Object.entries(DOMAINS)) {
    const res = await fetchFileFromGitHub(domain.file);
    if (res && res.content !== undefined) {
      writeCache(domain.key, res.content);
      window.dispatchEvent(new CustomEvent('cs:datachange', {
        detail: { domain: name, value: res.content, remote: true }
      }));
      results.push({ name, ok: true });
    }
  }
  return results;
}

export const DataService = {
  init,
  loadDomain,
  get,
  set,
  DOMAINS,
  pushAllToGitHub,
  pullAllFromGitHub,
  syncFromGitHubQuietly
};

export default DataService;
