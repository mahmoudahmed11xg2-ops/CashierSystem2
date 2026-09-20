// ============================================================
//  Local JSON Database Engine
// ============================================================
// قاعدة بيانات بسيطة مبنية على ملفات JSON تحت مجلد data/. كل
// "Collection" (نطاق بيانات) بيكون ملف واحد. الكتابة بتتم بشكل
// ذري (Atomic) عن طريق كتابة ملف مؤقت ثم استبدال الملف الأصلي،
// عشان نتجنب تلف الملف لو حصل Crash أثناء الكتابة.
//
// ده بديل خفيف لقاعدة بيانات حقيقية (زي SQLite) مناسب لحجم مطعم
// واحد. ملفات data/ تفضل قابلة للقراءة والتعديل يدويًا في أي وقت
// (تفتحها بأي محرر نصوص وتعدل فيها مباشرة، بالظبط زي ما طلبت).
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '..', 'data');

// خريطة كل نطاق بيانات -> مسار الملف بتاعه تحت data/
export const COLLECTIONS = {
  categories:  'catalog/categories.json',
  items:       'catalog/items.json',
  recipes:     'catalog/recipes.json',
  stock:       'inventory/stock.json',
  tables:      'tables/tables.json',
  customers:   'crm/customers.json',
  suppliers:   'crm/suppliers.json',
  captains:    'crm/captains.json',
  staff:       'crm/staff.json',
  users:       'settings/users.json',
  storeConfig: 'settings/store-config.json',
  orders:      'transactions/orders.json',
  expenses:    'transactions/expenses.json',
  guardLogs:   'transactions/guard-logs.json',
  shiftsLog:   'transactions/shifts-log.json',
  activeShift: 'transactions/active-shift.json'
};

function filePathFor(collection) {
  const rel = COLLECTIONS[collection];
  if (!rel) throw new Error('Unknown collection: ' + collection);
  return path.join(DATA_ROOT, rel);
}

export function readCollection(collection) {
  const filePath = filePathFor(collection);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('DB: JSON تالف في', filePath, err.message);
    return null;
  }
}

export function writeCollection(collection, value) {
  const filePath = filePathFor(collection);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath); // كتابة ذرية
  return value;
}

export { DATA_ROOT };
