// ============================================================
//  GitHub Cloud Database Service (Debugged & Enhanced)
// ============================================================

const CONFIG_KEY = 'cs_github_sync_config';

export function getGitHubConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : { token: '', repo: '', branch: 'main', autoSync: true };
  } catch {
    return { token: '', repo: '', branch: 'main', autoSync: true };
  }
}

export function saveGitHubConfig(cfg) {
  // إزالة أي مسافات زائدة
  if (cfg.token) cfg.token = cfg.token.trim();
  if (cfg.repo) cfg.repo = cfg.repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
  if (cfg.branch) cfg.branch = cfg.branch.trim();
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// دالة لجلب محتوى ملف من مستودع GitHub
export async function fetchFileFromGitHub(path) {
  const cfg = getGitHubConfig();
  if (!cfg.token || !cfg.repo) return null;

  const url = `https://api.github.com/repos/${cfg.repo}/contents/${path}?ref=${cfg.branch || 'main'}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) {
      if (res.status === 404) return null;
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
    console.warn(`[GitHubSync] خطأ أثناء جلب الملف ${path}:`, err);
    return null;
  }
}

// دالة لحفظ/تحديث ملف في مستودع GitHub مع إرجاع الخطأ بالتفصيل
export async function saveFileToGitHub(path, contentObject, commitMessage = 'Auto-sync from Cashier System') {
  const cfg = getGitHubConfig();
  if (!cfg.token || !cfg.repo) {
    throw new Error('يرجى ملء بيانات المستودع والـ Token أولاً');
  }

  const url = `https://api.github.com/repos/${cfg.repo}/contents/${path}`;
  
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
