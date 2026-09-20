// ============================================================
//  GitHub Cloud Database Service (Debugged & Enhanced)
// ============================================================

const CONFIG_KEY = 'cs_github_sync_config';

// Safety boundary: GitHub must never be used as the source of truth for live
// restaurant operations. These paths stay local/server-side.
const GITHUB_BLOCKED_PATHS = new Set([
  'data/tables/tables.json',
  'data/inventory/stock.json',
  'data/transactions/orders.json',
  'data/transactions/expenses.json',
  'data/transactions/guard-logs.json',
  'data/transactions/shifts-log.json',
  'data/transactions/active-shift.json'
]);

function assertGitHubPathAllowed(path) {
  if (GITHUB_BLOCKED_PATHS.has(path)) {
    throw new Error(`حماية البيانات: الملف ${path} خاص ببيانات التشغيل ولا يُسمح بمزامنته مع GitHub.`);
  }
}

export function getGitHubConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : { token: '', repo: '', branch: 'main', autoSync: true };
  } catch {
    return { token: '', repo: '', branch: 'main', autoSync: true };
  }
}

export function saveGitHubConfig(cfg) {
  // إزالة أي مسافات زائدة وتنسيق اسم المستودع
  if (cfg.token) cfg.token = cfg.token.trim();
  if (cfg.repo) {
    cfg.repo = cfg.repo.trim()
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/\.git$/, '')
      .replace(/\/$/, '');
  }
  if (cfg.branch) cfg.branch = cfg.branch.trim() || 'main';
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// دالة فحص وتأكيد صلاحية الاتصال بمستودع GitHub مع رسائل خطأ دقيقة
export async function checkGitHubRepoAccess(customCfg = null) {
  const cfg = customCfg || getGitHubConfig();
  if (!cfg.token || !cfg.repo) {
    throw new Error('لم يتم إدخال اسم المستودع (Repository) أو رمز الوصول السري (Token)');
  }

  const cleanRepo = cfg.repo.trim()
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');

  const url = `https://api.github.com/repos/${cleanRepo}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${cfg.token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (res.status === 401) {
    throw new Error('رمز الـ Token غير صحيح أو انتهت صلاحيته (401 Bad Credentials)');
  }
  if (res.status === 403) {
    throw new Error('تم رفض الوصول (403 Forbidden). تأكد من إعطاء الـ Token صلاحية "repo" أو "Contents: Read & Write"');
  }
  if (res.status === 404) {
    throw new Error(`المستودع (${cleanRepo}) غير موجود، أو أنه مستودع خاص (Private) والـ Token لا يمتلك صلاحية قراءته (404 Not Found)`);
  }
  if (!res.ok) {
    throw new Error(`خطأ من خادم GitHub (${res.status}): ${res.statusText}`);
  }

  const data = await res.json();
  return {
    ok: true,
    fullName: data.full_name,
    defaultBranch: data.default_branch || 'main',
    isPrivate: data.private
  };
}

// دالة لجلب محتوى ملف من مستودع GitHub
export async function fetchFileFromGitHub(path) {
  assertGitHubPathAllowed(path);
  const cfg = getGitHubConfig();
  if (!cfg.token || !cfg.repo) return null;

  const cleanRepo = cfg.repo.trim()
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');

  const url = `https://api.github.com/repos/${cleanRepo}/contents/${path}?ref=${cfg.branch || 'main'}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('رمز الـ Token غير صالح أو منتهي الصلاحية (401)');
      }
      if (res.status === 403) {
        throw new Error('تم رفض إذن القراءة من GitHub للـ Token الحالي (403)');
      }
      if (res.status === 404) {
        return null; // الملف غير موجود في هذا المسار بعد
      }
      return null;
    }

    const data = await res.json();
    if (data && data.content) {
      const binaryString = atob(data.content.replace(/\s/g, ''));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decodedText = new TextDecoder('utf-8').decode(bytes);
      return {
        sha: data.sha,
        content: JSON.parse(decodedText)
      };
    }
    return null;
  } catch (err) {
    if (err.message && (err.message.includes('401') || err.message.includes('403'))) {
      throw err;
    }
    console.warn(`[GitHubSync] خطأ أثناء جلب الملف ${path}:`, err);
    return null;
  }
}

// دالة لحفظ/تحديث ملف في مستودع GitHub مع إرجاع الخطأ بالتفصيل
export async function saveFileToGitHub(path, contentObject, commitMessage = 'Auto-sync from Cashier System') {
  assertGitHubPathAllowed(path);
  const cfg = getGitHubConfig();
  if (!cfg.token || !cfg.repo) {
    throw new Error('يرجى ملء بيانات المستودع والـ Token أولاً');
  }

  const cleanRepo = cfg.repo.trim()
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');

  const url = `https://api.github.com/repos/${cleanRepo}/contents/${path}`;
  
  // 1. معرفة sha الحالي إذا كان الملف موجوداً مسبقاً
  let sha = null;
  try {
    const checkRes = await fetch(`${url}?ref=${cfg.branch || 'main'}`, {
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (checkRes.ok) {
      const existing = await checkRes.json();
      sha = existing.sha;
    }
  } catch (e) {}

  // 2. تشفير المحتوى إلى Base64 مع مراعاة الحروف العربية UTF-8
  const jsonStr = JSON.stringify(contentObject, null, 2);
  const utf8Bytes = new TextEncoder().encode(jsonStr);
  let binaryStr = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binaryStr += String.fromCharCode(utf8Bytes[i]);
  }
  const base64Content = btoa(binaryStr);

  const payload = {
    message: commitMessage,
    content: base64Content,
    branch: cfg.branch || 'main'
  };
  if (sha) payload.sha = sha;

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${cfg.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!putRes.ok) {
    const errData = await putRes.json().catch(() => ({}));
    throw new Error(`GitHub Error (${putRes.status}): ${errData.message || 'فشل حفظ الملف'}`);
  }

  return true;
}
