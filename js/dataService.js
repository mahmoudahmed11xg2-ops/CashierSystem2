// ============================================================
// DataService: إدارة البيانات والتخزين الدائم والمزامنة اللحظية
// ============================================================

export const DOMAINS = {
  categories: { key: 'cs_cats', isObject: false },
  items: { key: 'cs_items', isObject: false },
  recipes: { key: 'cs_recipes', isObject: false },
  stock: { key: 'cs_stock', isObject: false },
  tables: { key: 'cs_tables', isObject: false },
  customers: { key: 'cs_customers', isObject: false },
  suppliers: { key: 'cs_suppliers', isObject: false },
  captains: { key: 'cs_captains', isObject: false },
  staff: { key: 'cs_staff', isObject: false },
  users: { key: 'cs_users', isObject: false },
  storeConfig: { key: 'cs_configs', isObject: true },
  orders: { key: 'cs_orders', isObject: false },
  expenses: { key: 'cs_expenses', isObject: false },
  guardLogs: { key: 'cs_guard_logs', isObject: false },
  shiftsLog: { key: 'cs_shifts_log', isObject: false },
  activeShift: { key: 'cs_active_shift', isObject: true, nullable: true }
};

// البيانات الأولية المتكاملة للمطعم والكافيه (Default Restaurant Seed Data)
export const DEFAULT_CATEGORIES = [
  { id: 'c1', name: 'وجبات وساندوتشات', icon: '🍔', sort: 1 },
  { id: 'c2', name: 'بيتزا وفطائر', icon: '🍕', sort: 2 },
  { id: 'c3', name: 'مقبلات وسلطات', icon: '🍟', sort: 3 },
  { id: 'c4', name: 'مشروبات وقهوة', icon: '🥤', sort: 4 },
  { id: 'c5', name: 'حلويات', icon: '🍰', sort: 5 }
];

export const DEFAULT_ITEMS = [
  { id: 'i1', name: 'برجر لحم كلاسيك سنجل', catId: 'c1', price: 120, cost: 65, tax: 14, unit: 'ساندوتش', barcode: '1001', prepTime: 12 },
  { id: 'i2', name: 'برجر دبل تشيز بيف', catId: 'c1', price: 160, cost: 90, tax: 14, unit: 'ساندوتش', barcode: '1002', prepTime: 15 },
  { id: 'i3', name: 'ساندوتش دجاج كرسبي مقرمش', catId: 'c1', price: 110, cost: 55, tax: 14, unit: 'ساندوتش', barcode: '1003', prepTime: 12 },
  { id: 'i4', name: 'بيتزا مارجريتا إيطالي', catId: 'c2', price: 115, cost: 50, tax: 14, unit: 'فطيرة', barcode: '2001', prepTime: 18 },
  { id: 'i5', name: 'بيتزا بيبروني سجق', catId: 'c2', price: 145, cost: 70, tax: 14, unit: 'فطيرة', barcode: '2002', prepTime: 18 },
  { id: 'i6', name: 'مكرونة ألفريدو دجاج ومشروم', catId: 'c1', price: 130, cost: 60, tax: 14, unit: 'طبق', barcode: '1004', prepTime: 15 },
  { id: 'i7', name: 'بطاطس مقلية كرسبي كبير', catId: 'c3', price: 40, cost: 15, tax: 14, unit: 'طبق', barcode: '3001', prepTime: 6 },
  { id: 'i8', name: 'أصابع موتزاريلا مقلية (5 قطع)', catId: 'c3', price: 65, cost: 30, tax: 14, unit: 'طبق', barcode: '3002', prepTime: 8 },
  { id: 'i9', name: 'سلطة سيزر دجاج مشوي', catId: 'c3', price: 75, cost: 35, tax: 14, unit: 'طبق', barcode: '3003', prepTime: 8 },
  { id: 'i10', name: 'كولا / بيبسي مبرد', catId: 'c4', price: 25, cost: 15, tax: 14, unit: 'علبة', barcode: '4001', prepTime: 2 },
  { id: 'i11', name: 'عصير برتقال طازج فريش', catId: 'c4', price: 45, cost: 20, tax: 14, unit: 'كوب', barcode: '4002', prepTime: 4 },
  { id: 'i12', name: 'قهوة إسبريسو دوبل', catId: 'c4', price: 40, cost: 12, tax: 14, unit: 'فنجان', barcode: '4003', prepTime: 3 },
  { id: 'i13', name: 'مولتن كيك شيكولاتة ساخنة', catId: 'c5', price: 75, cost: 30, tax: 14, unit: 'طبق', barcode: '5001', prepTime: 10 },
  { id: 'i14', name: 'تشيز كيك صوص لوتس', catId: 'c5', price: 65, cost: 25, tax: 14, unit: 'قطعة', barcode: '5002', prepTime: 3 }
];

export const DEFAULT_TABLES = [
  { id: 1, number: 1, name: 'طاولة 1', seats: 4, zone: 'indoor', status: 'available', total: 0, waiter: '—' },
  { id: 2, number: 2, name: 'طاولة 2', seats: 2, zone: 'indoor', status: 'available', total: 0, waiter: '—' },
  { id: 3, number: 3, name: 'طاولة 3', seats: 6, zone: 'indoor', status: 'available', total: 0, waiter: '—' },
  { id: 4, number: 4, name: 'طاولة 4', seats: 4, zone: 'indoor', status: 'available', total: 0, waiter: '—' },
  { id: 5, number: 5, name: 'طاولة 5 (تراس)', seats: 4, zone: 'outdoor', status: 'available', total: 0, waiter: '—' },
  { id: 6, number: 6, name: 'طاولة 6 (تراس)', seats: 4, zone: 'outdoor', status: 'available', total: 0, waiter: '—' },
  { id: 7, number: 7, name: 'VIP عائلات', seats: 8, zone: 'vip', status: 'available', total: 0, waiter: '—' },
  { id: 8, number: 8, name: 'طاولة 8', seats: 4, zone: 'indoor', status: 'available', total: 0, waiter: '—' }
];

export const DEFAULT_STORE_CONFIG = {
  storeName: 'مطعم ومقهى السرايا',
  storePhone: '01012345678',
  storeAddress: 'فرع المعادي - شارع النصر، القاهرة',
  tax: 14,
  deliveryFee: 25,
  serviceCharge: 12,
  currency: 'ج.م',
  paperWidth: '80mm',
  autoPrint: 'manual',
  receiptFooter: 'شكراً لزيارتكم ونتمنى لكم يوماً سعيداً'
};

export const DEFAULT_STOCK = [
  { id: 'st1', name: 'لحم برجر بلدي طازج', qty: 25, unit: 'كجم', minAlert: 5, cost: 220 },
  { id: 'st2', name: 'صدور دجاج مخلية فريش', qty: 30, unit: 'كجم', minAlert: 6, cost: 160 },
  { id: 'st3', name: 'جبنة موتزاريلا طبيعي', qty: 18, unit: 'كجم', minAlert: 4, cost: 175 },
  { id: 'st4', name: 'خبز برجر سمسم طري', qty: 120, unit: 'حبة', minAlert: 25, cost: 4 },
  { id: 'st5', name: 'بطاطس نصف مقلية كرسبي', qty: 45, unit: 'كجم', minAlert: 10, cost: 40 },
  { id: 'st6', name: 'علب مشروبات غازية كانز', qty: 96, unit: 'علبة', minAlert: 24, cost: 15 },
  { id: 'st7', name: 'حبوب بن إسبريسو ممتازة', qty: 12, unit: 'كجم', minAlert: 2, cost: 350 }
];

export const DEFAULT_RECIPES = [
  { id: 'r1', itemId: 'i1', ingredients: [{ stockId: 'st1', qty: 0.15 }, { stockId: 'st4', qty: 1 }] },
  { id: 'r2', itemId: 'i2', ingredients: [{ stockId: 'st1', qty: 0.25 }, { stockId: 'st3', qty: 0.04 }, { stockId: 'st4', qty: 1 }] },
  { id: 'r3', itemId: 'i3', ingredients: [{ stockId: 'st2', qty: 0.18 }, { stockId: 'st4', qty: 1 }] },
  { id: 'r4', itemId: 'i4', ingredients: [{ stockId: 'st3', qty: 0.18 }] },
  { id: 'r5', itemId: 'i5', ingredients: [{ stockId: 'st3', qty: 0.18 }] },
  { id: 'r6', itemId: 'i7', ingredients: [{ stockId: 'st5', qty: 0.25 }] },
  { id: 'r7', itemId: 'i10', ingredients: [{ stockId: 'st6', qty: 1 }] }
];

export const DEFAULT_CAPTAINS = [
  { id: 'cap1', name: 'وليد صبحي صالة', phone: '01099887766', section: 'الصالة الداخلية', active: true },
  { id: 'cap2', name: 'أحمد ربيع صالة', phone: '01122334455', section: 'التراس الخارجي', active: true },
  { id: 'cap3', name: 'كابتن حسن دليفري', phone: '01233445566', section: 'الطيارين والتوصيل', active: true }
];

export const DEFAULT_CUSTOMERS = [
  { id: 'cust1', name: 'م. أحمد الشناوي', phone: '01005544332', address: 'عمارة 15 - دجلة المعادي', points: 140, totalOrders: 12 },
  { id: 'cust2', name: 'د. نورهان المهدي', phone: '01122998877', address: 'فيلا 8 - حي النرجس', points: 85, totalOrders: 7 },
  { id: 'cust3', name: 'أستاذ طارق إبراهيم', phone: '01288776655', address: 'شارع 9 - المعادي', points: 210, totalOrders: 18 }
];

export const DEFAULT_SUPPLIERS = [
  { id: 'sup1', name: 'مزرعة اللحوم البلدية الفاخرة', phone: '01011122233', category: 'لحوم ودواجن', balance: 0 },
  { id: 'sup2', name: 'شركة الألبان والموتزاريلا', phone: '01044455566', category: 'أجبان ومخبوزات', balance: 0 }
];

export const DEFAULT_STAFF = [
  { id: 'stf1', name: 'وليد صبحي', role: 'كاشير صالة', phone: '01099887766', salary: 4500, active: true },
  { id: 'stf2', name: 'شيف مصطفى كمال', role: 'شيف عمومي (مطبخ)', phone: '01122334455', salary: 7500, active: true },
  { id: 'stf3', name: 'علاء جلال', role: 'محاسب مالي', phone: '01288990011', salary: 5500, active: true }
];

export const DEFAULT_USERS = [
  { id: 'usr_admin', username: 'admin', fullName: 'مدير النظام', role: 'admin', active: true, password: btoa('123456'), createdAt: new Date().toISOString() },
  { id: '3SNhsc2ilvc42YWXhKpLzBO5Yu32', username: 'mahmoud.mostfa', email: 'mahmoud.mostfa@app.com', fullName: 'Mahmoud Mostafa', role: 'admin', active: true, password: btoa('123456'), createdAt: new Date().toISOString() },
  { id: 'usr_cashier', username: 'cashier', fullName: 'وليد صبحي (كاشير)', role: 'cashier', active: true, password: btoa('123456'), createdAt: new Date().toISOString() },
  { id: 'usr_manager', username: 'manager', fullName: 'يوسف الصباغ (مشرف فرع)', role: 'manager', active: true, password: btoa('123456'), createdAt: new Date().toISOString() },
  { id: 'usr_accounts', username: 'accounts', fullName: 'علاء جلال (محاسب)', role: 'accounts', active: true, password: btoa('123456'), createdAt: new Date().toISOString() }
];

const SEED_MAP = {
  categories: DEFAULT_CATEGORIES,
  items: DEFAULT_ITEMS,
  tables: DEFAULT_TABLES,
  storeConfig: DEFAULT_STORE_CONFIG,
  stock: DEFAULT_STOCK,
  recipes: DEFAULT_RECIPES,
  captains: DEFAULT_CAPTAINS,
  customers: DEFAULT_CUSTOMERS,
  suppliers: DEFAULT_SUPPLIERS,
  staff: DEFAULT_STAFF,
  users: DEFAULT_USERS,
  orders: [],
  expenses: [],
  guardLogs: [],
  shiftsLog: [],
  activeShift: null
};

// قناة المزامنة الحية بين النوافذ والتبويبات
let syncChannel = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('cs_pos_sync');
    syncChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'datachange') {
        const { domain, value } = event.data;
        // إشعار الصفحة محلياً بالتغيير القادم من نافذة أخرى دون عمل reload
        window.dispatchEvent(new CustomEvent('cs:datachange', {
          detail: { domain, value, remote: true }
        }));
      }
    };
  }
} catch (e) {
  console.warn('BroadcastChannel sync initialized with fallback:', e);
}

// مراقبة Storage Event لتزامن المتصفح التلقائي بين التبويبات
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key) return;
    for (const [name, domain] of Object.entries(DOMAINS)) {
      if (domain.key === e.key && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          window.dispatchEvent(new CustomEvent('cs:datachange', {
            detail: { domain: name, value: parsed, remote: true }
          }));
        } catch {}
      }
    }
  });
}

function emptyFor(domain) {
  return domain.isObject ? (domain.nullable ? null : {}) : [];
}

function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

// قراءة البيانات من التخزين الدائم LocalStorage مع زراعة البيانات الافتراضية إن كانت فارغة
export function get(name) {
  const domain = DOMAINS[name];
  if (!domain) return [];

  try {
    const raw = localStorage.getItem(domain.key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      // إذا كانت مصفوفة وتحتوي عناصر، أو كائن غير فارغ، أرجعها
      if (domain.isObject) {
        if (parsed !== null && Object.keys(parsed).length > 0) return parsed;
      } else if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`Error reading domain ${name}:`, e);
  }

  // إذا لم تكن موجودة أو فارغة، نأخذ البيانات الافتراضية ونحفظها تلقائياً
  if (SEED_MAP[name] !== undefined) {
    const defaultVal = clone(SEED_MAP[name]);
    try {
      localStorage.setItem(domain.key, JSON.stringify(defaultVal));
    } catch {}
    return defaultVal;
  }

  return emptyFor(domain);
}

// حفظ البيانات في التخزين الدائم LocalStorage وإرسال إشعار لحظي بدون ريفريش للصفحة
export function set(name, value) {
  const domain = DOMAINS[name];
  if (!domain) return;

  try {
    localStorage.setItem(domain.key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving domain ${name} to localStorage:`, e);
  }

  // إرسال حدث محلي للصفحة الحالية
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cs:datachange', {
      detail: { domain: name, value: clone(value), remote: false }
    }));

    // إرسال للتبويبات والنوافذ الأخرى المفتوحة (POS، الطاولات، شاشة العميل، الطلبات)
    if (syncChannel) {
      try {
        syncChannel.postMessage({
          type: 'datachange',
          domain: name,
          value: clone(value)
        });
      } catch (e) {
        console.warn('BroadcastChannel postMessage error:', e);
      }
    }
  }
}

// تحميل دومين معين
export async function loadDomain(name) {
  return get(name);
}

// تهيئة الدومينات المطلوبة
export async function init(names = []) {
  return Promise.all(names.map(loadDomain));
}

// الاستماع لتغييرات البيانات لأي شاشة
export function on(domainName, callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => {
    if (!domainName || e.detail?.domain === domainName) {
      callback(e.detail?.value, e.detail?.remote);
    }
  };
  window.addEventListener('cs:datachange', handler);
  return () => window.removeEventListener('cs:datachange', handler);
}

export const DataService = {
  init,
  loadDomain,
  get,
  set,
  on,
  DOMAINS,
  pushAllToGitHub: async () => ({ success: true, message: 'البيانات محفوظة ومزامنة محلياً بالكامل.' }),
  pullAllFromGitHub: async () => ({ success: true, message: 'البيانات محدثة محلياً.' }),
  syncFromGitHubQuietly: async () => ({ success: true }),
  syncFromServer: async () => ({ success: true })
};

export default DataService;
