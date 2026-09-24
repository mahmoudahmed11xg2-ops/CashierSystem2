// ============================================================
//  Firebase Authentication & Central RBAC Security System
// ============================================================

import DataService from './js/dataService.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBBX0K_Z9rDfDUclNYB17FXywXXJi9rA0s",
  authDomain: "leads-84ea5.firebaseapp.com",
  databaseURL: "https://leads-84ea5-default-rtdb.firebaseio.com",
  projectId: "leads-84ea5",
  storageBucket: "leads-84ea5.firebasestorage.app",
  messagingSenderId: "679803805448",
  appId: "1:679803805448:web:5e31f599297f483b8b16bd",
  measurementId: "G-4WZSQFM2XZ"
};

// Initialize Firebase dynamically via official CDN to prevent bare module specifier failures
let app = null;
let analytics = null;
let auth = null;
let db = null;
let fbAuth = null;
let fbFirestore = null;
let secondaryApp = null;
let secondaryAuth = null;
let secondaryDb = null;

export const loadFirebasePromise = (async () => {
  if (app) return { app, auth, db, fbAuth, fbFirestore };
  try {
    const fbAppModule = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
    app = fbAppModule.initializeApp(firebaseConfig);

    try {
      const fbAnalyticsModule = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js");
      analytics = fbAnalyticsModule.getAnalytics(app);
    } catch (e) {
      // Analytics is optional in sandbox
    }

    fbAuth = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js");
    auth = fbAuth.getAuth(app);

    fbFirestore = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    db = fbFirestore.getFirestore(app);

    return { app, auth, db, fbAuth, fbFirestore };
  } catch (err) {
    console.warn("Firebase CDN initialization notice (offline/standalone mode fallback active):", err);
    return null;
  }
})();

// ============================================================
//  Role Definitions & Page Permissions
// ============================================================
export const ROLES = {
  ADMIN: 'admin',
  OM: 'om',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  ACCOUNTS: 'accounts'
};

export const ROLE_LABELS = {
  admin: 'مدير النظام (Admin)',
  om: 'مدير العمليات (OM)',
  manager: 'مدير الصالة (Manager)',
  cashier: 'كاشير (Cashier)',
  accounts: 'محاسب (Accounts)'
};

// Allowed pages per role (Explicit whitelist)
export const ROLE_ALLOWED_PAGES = {
  admin: [
    'dashboard.html',
    'pos.html',
    'orders.html',
    'tables.html',
    'delivery.html',
    'inventory.html',
    'accounts.html',
    'expenses.html',
    'crm.html',
    'settings.html',
    'guard.html',
    'customer-display.html'
  ],
  om: [
    'dashboard.html',
    'pos.html',
    'orders.html',
    'tables.html',
    'delivery.html',
    'inventory.html',
    'accounts.html',
    'expenses.html',
    'crm.html',
    'guard.html',
    'customer-display.html'
    // Excludes: settings.html
  ],
  manager: [
    'dashboard.html',
    'pos.html',
    'orders.html',
    'tables.html',
    'delivery.html',
    'inventory.html',
    'crm.html',
    'guard.html',
    'customer-display.html'
    // Excludes: settings.html, accounts.html, expenses.html
  ],
  cashier: [
    'dashboard.html',
    'pos.html',
    'tables.html',
    'delivery.html',
    'customer-display.html'
    // Excludes: settings.html, orders.html, accounts.html, expenses.html, inventory.html, crm.html, guard.html
  ],
  accounts: [
    'dashboard.html',
    'orders.html',
    'accounts.html',
    'expenses.html'
    // Excludes: settings.html, pos.html, tables.html, delivery.html, inventory.html, crm.html, guard.html
  ]
};

// Default Landing Page when user logs in or is redirected
export const ROLE_HOME_PAGES = {
  admin: 'dashboard.html',
  om: 'dashboard.html',
  manager: 'dashboard.html',
  cashier: 'pos.html',
  accounts: 'accounts.html'
};

// ============================================================
//  Users Database (Clean - Only Primary Admin Accounts)
// ============================================================
const DEFAULT_USERS = [
  {
    id: '3SNhsc2ilvc42YWXhKpLzBO5Yu32',
    username: 'mahmoud.mostfa',
    email: 'mahmoud.mostfa@app.com',
    fullName: 'Mahmoud Mostafa',
    role: 'admin',
    active: true,
    createdAt: new Date().toISOString(),
    permissions: ['all']
  },
  {
    id: 'user_admin',
    username: 'admin',
    email: 'admin@system.local',
    fullName: 'مدير النظام (Admin)',
    password: btoa('123456'),
    role: 'admin',
    active: true,
    createdAt: new Date().toISOString(),
    permissions: ['all']
  }
];

// Seed users if empty & purge old demo accounts as requested
export function seedUsersIfEmpty() {
  let existing = [];
  try {
    existing = JSON.parse(localStorage.getItem('cs_users') || '[]');
  } catch (e) {
    existing = [];
  }

  // Purge old demo users (om, manager, cashier, accounts) so the owner can add everything from scratch
  const demoIds = new Set(['user_om', 'user_manager', 'user_cashier', 'user_accounts', 'om', 'manager', 'cashier', 'accounts']);
  const demoEmails = new Set(['om@system.local', 'manager@system.local', 'cashier@system.local', 'accounts@system.local']);
  existing = existing.filter(u => !demoIds.has(u.id) && !demoIds.has(u.username) && !demoEmails.has(u.email));

  // Always ensure Mahmoud Mostafa is registered as primary Admin
  const mahmoudIdx = existing.findIndex(u => 
    u.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32' || 
    (u.email && u.email.toLowerCase() === 'mahmoud.mostfa@app.com') ||
    u.username === 'mahmoud.mostfa'
  );

  if (mahmoudIdx === -1) {
    existing.unshift({
      id: '3SNhsc2ilvc42YWXhKpLzBO5Yu32',
      username: 'mahmoud.mostfa',
      email: 'mahmoud.mostfa@app.com',
      fullName: 'Mahmoud Mostafa',
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString(),
      permissions: ['all']
    });
  } else {
    existing[mahmoudIdx].role = 'admin';
    existing[mahmoudIdx].active = true;
    existing[mahmoudIdx].fullName = 'Mahmoud Mostafa';
  }

  // Ensure admin user is registered with 123456 fallback password
  if (!existing.some(u => u.username === 'admin')) {
    existing.push({
      id: 'user_admin',
      username: 'admin',
      email: 'admin@system.local',
      fullName: 'مدير النظام (Admin)',
      password: btoa('123456'),
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString(),
      permissions: ['all']
    });
  }

  localStorage.setItem('cs_users', JSON.stringify(existing));
  return existing;
}

// Auto seed on load
seedUsersIfEmpty();

// ============================================================
//  Auth Service
// ============================================================
export const AuthService = {
  // Get all users
  getUsers: () => {
    let users = [];
    try {
      users = JSON.parse(localStorage.getItem('cs_users') || '[]');
    } catch (e) {
      users = [];
    }
    let dirty = false;
    users = users.map((u, i) => {
      if (!u.id) {
        u.id = u.username ? 'user_' + u.username : 'user_' + (i + 1);
        dirty = true;
      }
      return u;
    });
    if (dirty) {
      try {
        localStorage.setItem('cs_users', JSON.stringify(users));
      } catch (e) {}
    }
    return users;
  },

  // Get specific user by ID, username or email
  getUser: (id) => {
    if (!id) return null;
    const users = AuthService.getUsers();
    const strId = String(id).trim().toLowerCase();
    return users.find(u => 
      (u.id && String(u.id).trim().toLowerCase() === strId) ||
      (u.username && String(u.username).trim().toLowerCase() === strId) ||
      (u.email && String(u.email).trim().toLowerCase() === strId)
    ) || null;
  },

  // Save users
  saveUsers: (users) => {
    localStorage.setItem('cs_users', JSON.stringify(users));
  },

  // Current session
  getSession: () => {
    try {
      return JSON.parse(localStorage.getItem('cs_session') || 'null');
    } catch {
      return null;
    }
  },

  // Set session
  setSession: (sessionData) => {
    localStorage.setItem('cs_session', JSON.stringify(sessionData));
  },

  // Clear session / Logout
  clearSession: async () => {
    try {
      localStorage.removeItem('cs_session');
      sessionStorage.clear();
    } catch (e) {
      console.warn("Session clear warning:", e);
    }
    if (auth && auth.currentUser && fbAuth) {
      try {
        await fbAuth.signOut(auth);
      } catch (err) {
        console.warn("Firebase signout notice:", err);
      }
    }
  },

  // Get active shift object
  getActiveShift: () => {
    try {
      return DataService.get('activeShift') || JSON.parse(localStorage.getItem('cs_active_shift') || 'null');
    } catch (e) {
      return null;
    }
  },

  // Check if active shift is currently open
  hasActiveShift: () => {
    try {
      const activeShift = AuthService.getActiveShift();
      return Boolean(activeShift && (activeShift.id || activeShift.cashierName || activeShift.openedAt));
    } catch (e) {
      return false;
    }
  },

  // Prompt modal to switch user or close shift when attempting logout during active shift
  promptSwitchUserOrCloseShift: () => {
    let modalEl = document.getElementById('switchUserShiftModal');
    if (modalEl) modalEl.remove();

    const activeShift = AuthService.getActiveShift();
    const cashierName = activeShift?.cashierName || 'الكاشير';

    const div = document.createElement('div');
    div.id = 'switchUserShiftModal';
    div.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(15,23,42,0.65);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:'Cairo','Inter',sans-serif;">
        <div style="background:#fff;border-radius:12px;border:1px solid #cbd5e1;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);width:100%;max-width:440px;overflow:hidden;">
          
          <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:24px;">⚠️</span>
              <div>
                <div style="font-weight:800;font-size:15px;color:#0f172a;">وردية العمل لا تزال مفتوحة!</div>
                <div style="font-size:12px;color:#64748b;">مسؤول الوردية الحالي: <strong>${cashierName}</strong></div>
              </div>
            </div>
            <button type="button" id="suCloseBtn" style="background:none;border:none;font-size:20px;color:#94a3b8;cursor:pointer;padding:4px 8px;">✕</button>
          </div>

          <div style="padding:20px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:8px;padding:12px;font-size:12px;line-height:1.6;margin-bottom:18px;">
              💡 <strong>تنبيه إداري:</strong> يوجد درج وعهدة نقدية مفتوحة. لا يمكن الخروج بدون إغلاق الوردية، ولكن يمكنك <strong>تبديل الحساب</strong> وتسليم الشفت لمستخدم آخر مع استمرار نفس الوردية مفتوحة.
            </div>

            <form id="suLoginForm" style="display:flex;flex-direction:column;gap:12px;">
              <div style="font-size:13px;font-weight:800;color:#1c69d4;display:flex;align-items:center;gap:6px;">
                <span>🔑</span>
                <span>تبديل الحساب (تسليم الشفت لمستخدم آخر دون إغلاق):</span>
              </div>
              
              <div>
                <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:4px;">اسم المستخدم أو البريد الإلكتروني</label>
                <input type="text" id="suUsernameInput" required placeholder="مثال: admin أو البريد الإلكتروني" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;font-family:inherit;outline:none;" />
              </div>

              <div>
                <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:4px;">كلمة المرور</label>
                <input type="password" id="suPasswordInput" required placeholder="••••••••" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;font-family:inherit;outline:none;" />
              </div>

              <div id="suErrorMsg" style="display:none;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:700;"></div>

              <button type="submit" id="suSubmitBtn" style="width:100%;padding:10px;background:#1c69d4;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;">
                <span>تبديل الحساب ومتابعة الوردية 🔄</span>
              </button>
            </form>

            <div style="margin:16px 0;display:flex;align-items:center;gap:10px;">
              <div style="flex:1;height:1px;background:#e2e8f0;"></div>
              <span style="font-size:11px;color:#94a3b8;font-weight:700;">أو للتقفيل النهائي</span>
              <div style="flex:1;height:1px;background:#e2e8f0;"></div>
            </div>

            <button type="button" id="suGoCloseShiftBtn" style="width:100%;padding:10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;">
              <span>الذهاب لإغلاق وتقفيل الوردية وجرد الدرج 📋</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    // Bind events
    document.getElementById('suCloseBtn').onclick = () => div.remove();
    document.getElementById('suGoCloseShiftBtn').onclick = () => {
      div.remove();
      window.location.href = 'accounts.html';
    };

    const form = document.getElementById('suLoginForm');
    const errBox = document.getElementById('suErrorMsg');
    const submitBtn = document.getElementById('suSubmitBtn');

    form.onsubmit = async (e) => {
      e.preventDefault();
      errBox.style.display = 'none';
      const u = document.getElementById('suUsernameInput').value.trim();
      const p = document.getElementById('suPasswordInput').value.trim();
      submitBtn.disabled = true;
      submitBtn.textContent = 'جاري التحقق والتبديل...';

      try {
        const newSession = await AuthService.switchUser(u, p);
        div.remove();
        alert(`✅ تم تبديل الحساب بنجاح!\nالمستخدم الحالي: ${newSession.fullName || newSession.username} (${ROLE_LABELS[newSession.role] || newSession.role})\nالوردية مستمرة دون انقطاع.`);
        const curPage = window.location.pathname.split('/').pop().split('?')[0] || 'dashboard.html';
        const allowed = ROLE_ALLOWED_PAGES[newSession.role] || [];
        if (allowed.includes(curPage)) {
          window.location.reload();
        } else {
          window.location.href = ROLE_HOME_PAGES[newSession.role] || 'dashboard.html';
        }
      } catch (err) {
        errBox.textContent = err.message || 'فشل تبديل الحساب، تأكد من صحة البيانات';
        errBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'تبديل الحساب ومتابعة الوردية 🔄';
      }
    };
  },

  // Switch user without closing current active shift
  switchUser: async (identifier, password) => {
    const prevSession = AuthService.getSession();
    const newSession = await AuthService.login(identifier, password);

    // Maintain and hand over active shift to the new user
    const activeShift = AuthService.getActiveShift();
    if (activeShift) {
      activeShift.cashierName = newSession.fullName || newSession.username;
      activeShift.lastSwitchedAt = new Date().toISOString();
      DataService.set('activeShift', activeShift);
    }

    // Log the handover in guardLogs
    try {
      const logs = DataService.get('guardLogs') || JSON.parse(localStorage.getItem('cs_guard_logs') || '[]');
      logs.push({
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        user: newSession.fullName || newSession.username,
        role: newSession.role,
        action: 'تبديل مستخدم الوردية',
        details: `تم تسليم شفت العمل من (${prevSession ? (prevSession.fullName || prevSession.username) : 'غير معروف'}) إلى (${newSession.fullName || newSession.username}) بدون إغلاق الوردية`,
        value: 0
      });
      DataService.set('guardLogs', logs);
    } catch (e) {}

    return newSession;
  },

  // Perform clean logout with shift check enforcement
  logout: async (force = false) => {
    if (!force && AuthService.hasActiveShift()) {
      AuthService.promptSwitchUserOrCloseShift();
      return false;
    }

    try {
      localStorage.removeItem('cs_session');
      sessionStorage.clear();
    } catch (e) {
      console.warn("Session clear warning:", e);
    }
    if (auth && auth.currentUser && fbAuth) {
      try {
        await fbAuth.signOut(auth);
      } catch (err) {
        console.warn("Firebase signout notice:", err);
      }
    }
    window.location.href = 'index.html';
    return true;
  },

  // Login handler: Authenticates via Firebase Authentication + Local user fallback
  login: async (identifier, password) => {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanId || !cleanPass) {
      throw new Error('يرجى إدخال اسم المستخدم/البريد الإلكتروني وكلمة المرور');
    }

    // Await Firebase initialization if still in flight
    try {
      await loadFirebasePromise;
    } catch (e) {}

    const users = AuthService.getUsers();
    let matchedUser = null;
    let firebaseUser = null;
    let firestoreDocData = null;

    const isMahmoudTarget = cleanId === 'mahmoud.mostfa@app.com' || cleanId === 'mahmoud.mostfa';

    // 1. If identifier looks like an email and Firebase auth is ready, try Firebase Auth
    if (cleanId.includes('@') && auth && fbAuth) {
      try {
        const cred = await fbAuth.signInWithEmailAndPassword(auth, cleanId, cleanPass);
        firebaseUser = cred.user;

        // Fetch user document from Firestore
        if (db && fbFirestore) {
          try {
            // Check by Firebase Auth UID
            const userDocSnap = await fbFirestore.getDoc(fbFirestore.doc(db, 'users', firebaseUser.uid));
            if (userDocSnap.exists()) {
              firestoreDocData = userDocSnap.data();
            } else {
              // Check by document ID: 3SNhsc2ilvc42YWXhKpLzBO5Yu32
              const specDocSnap = await fbFirestore.getDoc(fbFirestore.doc(db, 'users', '3SNhsc2ilvc42YWXhKpLzBO5Yu32'));
              if (specDocSnap.exists()) {
                const sData = specDocSnap.data();
                if ((sData.email || '').toLowerCase() === cleanId || isMahmoudTarget) {
                  firestoreDocData = sData;
                }
              }
              // Check by email query
              if (!firestoreDocData) {
                const q = fbFirestore.query(fbFirestore.collection(db, 'users'), fbFirestore.where('email', '==', cleanId));
                const qSnap = await fbFirestore.getDocs(q);
                if (!qSnap.empty) {
                  firestoreDocData = qSnap.docs[0].data();
                }
              }
            }
          } catch (fsErr) {
            console.warn("Firestore user fetch notice:", fsErr);
          }
        }

        const validRoles = ['admin', 'om', 'manager', 'cashier', 'accounts'];
        const resolvedRole = isMahmoudTarget ? 'admin' : (validRoles.includes(firestoreDocData?.role) ? firestoreDocData.role : 'cashier');
        const resolvedName = firestoreDocData?.name || firestoreDocData?.fullName || (isMahmoudTarget ? 'Mahmoud Mostafa' : (firebaseUser.displayName || cleanId.split('@')[0]));

        // Find or create profile
        matchedUser = users.find(u => 
          (u.email || '').toLowerCase() === cleanId || 
          u.id === firebaseUser.uid ||
          (isMahmoudTarget && (u.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32' || u.username === 'mahmoud.mostfa'))
        );

        if (!matchedUser) {
          matchedUser = {
            id: isMahmoudTarget ? '3SNhsc2ilvc42YWXhKpLzBO5Yu32' : firebaseUser.uid,
            username: cleanId.split('@')[0],
            email: cleanId,
            fullName: resolvedName,
            password: btoa(cleanPass),
            role: resolvedRole,
            active: true,
            createdAt: new Date().toISOString()
          };
          users.unshift(matchedUser);
        } else {
          matchedUser.role = resolvedRole;
          matchedUser.fullName = resolvedName;
          matchedUser.password = btoa(cleanPass);
          matchedUser.active = true;
          if (isMahmoudTarget) {
            matchedUser.id = '3SNhsc2ilvc42YWXhKpLzBO5Yu32';
          }
        }
        AuthService.saveUsers(users);
      } catch (fbErr) {
        console.warn("Firebase Auth attempt notice:", fbErr.code || fbErr.message);
        // Fall back to local check if offline or network failure
      }
    }

    // 2. Local credential check (for username or offline fallback)
    if (!matchedUser) {
      const encodedPass = btoa(cleanPass);
      matchedUser = users.find(u => {
        const uEmail = (u.email || '').toLowerCase();
        const uName = (u.username || '').toLowerCase();
        const matchesIdentity = uName === cleanId || uEmail === cleanId;
        if (!matchesIdentity) return false;
        // If password stored, check it. If empty (first time seed without password), accept and save
        if (!u.password) {
          u.password = encodedPass;
          return true;
        }
        return u.password === encodedPass;
      });

      if (matchedUser && (isMahmoudTarget || matchedUser.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32' || (matchedUser.email && matchedUser.email.toLowerCase() === 'mahmoud.mostfa@app.com'))) {
        matchedUser.role = 'admin';
        matchedUser.fullName = 'Mahmoud Mostafa';
        matchedUser.active = true;
        AuthService.saveUsers(users);
      }
    }

    if (!matchedUser) {
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }

    if (matchedUser.active === false) {
      throw new Error('هذا الحساب معطل حالياً من قِبل مدير النظام');
    }

    // Create session object
    const session = {
      id: matchedUser.id,
      username: matchedUser.username,
      email: matchedUser.email || `${matchedUser.username}@system.local`,
      fullName: matchedUser.fullName || matchedUser.username,
      role: (isMahmoudTarget || matchedUser.email === 'mahmoud.mostfa@app.com' || matchedUser.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32') ? 'admin' : (matchedUser.role || 'cashier'),
      loginAt: new Date().toISOString(),
      firebaseUid: firebaseUser ? firebaseUser.uid : null
    };

    AuthService.setSession(session);
    return session;
  },

  // Create user (Admin only)
  // IMPORTANT: use a secondary Firebase Auth instance so creating a staff account
  // never signs the currently logged-in Admin out or changes the Admin session.
  createUser: async ({ username, email, fullName, password, role, permissions = [], active = true }) => {
    const users = AuthService.getUsers();
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanEmail = String(email || `${cleanUsername}@system.local`).trim().toLowerCase();
    const cleanName = String(fullName || '').trim() || cleanUsername;
    const selectedRole = ['admin', 'om', 'manager', 'cashier', 'accounts'].includes(role) ? role : 'cashier';

    if (!cleanUsername || !cleanEmail || !password) throw new Error('بيانات المستخدم غير مكتملة');
    if (String(password).length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    if (users.some(u => String(u.username || '').toLowerCase() === cleanUsername)) {
      throw new Error('اسم المستخدم موجود بالفعل');
    }
    if (users.some(u => String(u.email || '').toLowerCase() === cleanEmail)) {
      throw new Error('البريد الإلكتروني مسجل لمستخدم آخر');
    }

    await loadFirebasePromise;
    if (!auth || !fbAuth || !db || !fbFirestore) {
      throw new Error('Firebase غير متاح. لم يتم إنشاء الحساب محليًا حتى لا يصبح الحساب غير متزامن مع Firebase.');
    }

    let firebaseUid = null;
    let firebaseCreated = false;

    try {
      // Create a second Firebase app/auth instance. The Admin remains signed in on the primary app.
      const fbAppModule = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
      const existingApps = fbAppModule.getApps();
      secondaryApp = existingApps.find(a => a.name === 'staff-account-creator') ||
        fbAppModule.initializeApp(firebaseConfig, 'staff-account-creator');
      secondaryAuth = fbAuth.getAuth(secondaryApp);
      secondaryDb = fbFirestore.getFirestore(secondaryApp);

      const userCred = await fbAuth.createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
      firebaseUid = userCred.user.uid;
      firebaseCreated = true;

      const profile = {
        uid: firebaseUid,
        username: cleanUsername,
        email: cleanEmail,
        name: cleanName,
        fullName: cleanName,
        role: selectedRole,
        permissions: permissions.length ? permissions : [selectedRole],
        active: Boolean(active),
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || null
      };

      // Write the role/profile to Firestore using the newly-created user's auth context.
      await fbFirestore.setDoc(fbFirestore.doc(secondaryDb, 'users', firebaseUid), profile, { merge: true });
      await fbAuth.signOut(secondaryAuth);
    } catch (err) {
      if (firebaseCreated && secondaryAuth?.currentUser) {
        try { await fbAuth.deleteUser(secondaryAuth.currentUser); } catch (_) {}
      }
      try { if (secondaryAuth?.currentUser) await fbAuth.signOut(secondaryAuth); } catch (_) {}
      if (firebaseCreated) {
        throw new Error('تم إنشاء حساب Firebase لكن فشل حفظ بيانات الدور في Firestore. لم يتم حفظ الحساب محليًا. راجع Firestore Security Rules ثم أعد المحاولة.');
      }
      const code = err?.code || '';
      const friendly = {
        'auth/email-already-in-use': 'البريد الإلكتروني مستخدم بالفعل في Firebase',
        'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
        'auth/weak-password': 'كلمة المرور ضعيفة؛ استخدم 6 أحرف على الأقل',
        'auth/network-request-failed': 'تعذر الاتصال بـ Firebase. تحقق من الإنترنت',
        'permission-denied': 'Firebase رفض حفظ بيانات الدور في Firestore. راجع Firestore Security Rules'
      };
      throw new Error(friendly[code] || err?.message || 'فشل إنشاء حساب Firebase');
    }

    // Local storage is only a cache/profile mirror, never the account authority.
    const newUser = {
      id: firebaseUid,
      firebaseUid,
      username: cleanUsername,
      email: cleanEmail,
      fullName: cleanName,
      password: btoa(password),
      role: selectedRole,
      permissions: permissions.length ? permissions : [selectedRole],
      active: Boolean(active),
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    AuthService.saveUsers(users);
    return newUser;
  },

  // Update existing user safely
  updateUser: (id, updates = {}) => {
    if (!id && !updates.username && !updates.email) {
      console.warn('updateUser called without identifier');
      return null;
    }
    const users = AuthService.getUsers();
    const strId = String(id || '').trim().toLowerCase();

    let idx = -1;
    if (strId && strId !== 'undefined' && strId !== 'null') {
      idx = users.findIndex(u => 
        (u.id && String(u.id).trim().toLowerCase() === strId) ||
        (u.username && String(u.username).trim().toLowerCase() === strId) ||
        (u.email && String(u.email).trim().toLowerCase() === strId)
      );
    }

    if (idx === -1 && updates.username) {
      const uName = String(updates.username).trim().toLowerCase();
      idx = users.findIndex(u => u.username && String(u.username).trim().toLowerCase() === uName);
    }

    if (idx === -1 && updates.email) {
      const uMail = String(updates.email).trim().toLowerCase();
      idx = users.findIndex(u => u.email && String(u.email).trim().toLowerCase() === uMail);
    }

    if (idx === -1) {
      console.warn('updateUser: لم يتم العثور على المستخدم المطلوب تحديثه:', id, updates);
      return null;
    }

    if (updates.password) {
      updates.password = btoa(updates.password);
    }

    users[idx] = { ...users[idx], ...updates, updatedAt: new Date().toISOString() };
    AuthService.saveUsers(users);

    // If updating current active session user, reflect updates in current session
    try {
      const sess = AuthService.getSession();
      if (sess && (sess.id === users[idx].id || sess.username === users[idx].username)) {
        sess.fullName = users[idx].fullName || sess.fullName;
        sess.role = users[idx].role || sess.role;
        sess.email = users[idx].email || sess.email;
        AuthService.setSession(sess);
      }
    } catch (e) {}

    return users[idx];
  },

  // Delete user safely
  deleteUser: (id) => {
    if (!id) return false;
    const strId = String(id).trim().toLowerCase();
    const users = AuthService.getUsers();
    const target = users.find(u => 
      (u.id && String(u.id).trim().toLowerCase() === strId) ||
      (u.username && String(u.username).trim().toLowerCase() === strId) ||
      (u.email && String(u.email).trim().toLowerCase() === strId)
    );

    if (target && (
      target.username === 'admin' || 
      target.username === 'mahmoud.mostfa' || 
      (target.email && target.email.toLowerCase() === 'mahmoud.mostfa@app.com') || 
      target.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32'
    )) {
      throw new Error('لا يمكن حذف حساب الأدمن الرئيسي للنظام');
    }

    const filtered = users.filter(u => 
      (!u.id || String(u.id).trim().toLowerCase() !== strId) &&
      (!u.username || String(u.username).trim().toLowerCase() !== strId) &&
      (!u.email || String(u.email).trim().toLowerCase() !== strId)
    );

    AuthService.saveUsers(filtered);
    return true;
  },

  // Check if current user has permission for page
  hasPermission: (pageName) => {
    const session = AuthService.getSession();
    if (!session) return false;
    const role = session.role || 'cashier';
    const allowed = ROLE_ALLOWED_PAGES[role] || [];
    return allowed.includes(pageName);
  },

  // Guard page access
  enforcePage: (pageName) => {
    const session = AuthService.getSession();
    if (!session) {
      window.location.href = 'index.html';
      return false;
    }

    const role = session.role || 'cashier';
    const allowed = ROLE_ALLOWED_PAGES[role] || [];
    const normalizedPage = pageName.split('/').pop().split('?')[0];

    if (!allowed.includes(normalizedPage)) {
      const home = ROLE_HOME_PAGES[role] || 'index.html';
      alert(`غير مصرح لك بالدخول إلى صفحة (${normalizedPage}). سيتم تحويلك إلى صفحتك المخصصة.`);
      window.location.href = home;
      return false;
    }

    return true;
  },

  // Render navigation and user card in sidebar
  renderSidebarUI: () => {
    const session = AuthService.getSession();
    if (!session) return;

    // 1. Update user info elements
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');
    const avatarEl = document.getElementById('userAvatar');

    if (nameEl) nameEl.textContent = session.fullName || session.username;
    if (roleEl) roleEl.textContent = ROLE_LABELS[session.role] || session.role;
    if (avatarEl) {
      const roleInitials = (session.fullName || session.username).substring(0, 2).toUpperCase();
      avatarEl.textContent = roleInitials;
    }

    // 2. Hide unauthorized links
    const role = session.role || 'cashier';
    const allowed = ROLE_ALLOWED_PAGES[role] || [];

    const navButtons = document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-nav button.nav-item');
    navButtons.forEach(btn => {
      const onclickVal = btn.getAttribute('onclick') || '';
      let targetFile = '';
      const match = onclickVal.match(/navigate\(['"]([^'"]+)['"]\)/);
      if (match && match[1]) {
        targetFile = match[1].split('?')[0];
      }
      if (targetFile) {
        if (!allowed.includes(targetFile)) {
          btn.style.display = 'none';
        } else {
          btn.style.display = 'flex';
          // Mark active if current page matches
          const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
          if (currentPage === targetFile) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        }
      }
    });

    // 3. Hide section titles if all child links are hidden
    const sectionTitles = document.querySelectorAll('.sidebar-nav .nav-section-title');
    sectionTitles.forEach(title => {
      let next = title.nextElementSibling;
      let hasVisibleChild = false;
      while (next && !next.classList.contains('nav-section-title')) {
        if (next.classList.contains('nav-item') && next.style.display !== 'none') {
          hasVisibleChild = true;
          break;
        }
        next = next.nextElementSibling;
      }
      title.style.display = hasVisibleChild ? 'block' : 'none';
    });

    // 4. Bind logout button reliably
    const logoutBtns = document.querySelectorAll('.btn-logout, #btnLogout, [data-action="logout"]');
    logoutBtns.forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        AuthService.logout();
      };
    });
  }
};

// ============================================================
//  Table Management System & Deep POS Integration
// ============================================================
export const TABLE_STATUS = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  OCCUPIED: 'occupied',
  CLEANING: 'cleaning'
};

export const TABLE_STATUS_LABELS = {
  available: 'متاحة',
  reserved: 'محجوزة',
  occupied: 'مشغولة',
  cleaning: 'قيد التنظيف'
};

// تحميل خريطة الطاولات من السيرفر (Realtime). أي تعديل من أي جهاز
// (فتح طاولة، تحويل، تصفير) بيوصل هنا فورًا عن طريق Socket.IO،
// وبما إن كل الصفحات بتستخدم TableManager من هنا، أي صفحة بتفتح
// خريطة الطاولات بتاخد آخر حالة محدّثة أوتوماتيكيًا.
try {
  await DataService.init(['tables']);
} catch (e) {
  // هنشتغل بالكاش المحلي (أو النسخة الاحتياطية تحت) لو السيرفر مش متاح
}

const DEFAULT_TABLES = [
  { id: 1, number: '1', zone: 'صالة العوائل', seats: '4 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 2, number: '2', zone: 'صالة العوائل', seats: '6 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 3, number: '3', zone: 'صالة العوائل', seats: '4 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 4, number: 'VIP 1', zone: 'الكابينة الفاخرة', seats: '8 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 5, number: 'VIP 2', zone: 'الكابينة الفاخرة', seats: '6 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 6, number: 'T 1', zone: 'التراس الخارجي', seats: '2 مقعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 7, number: 'T 2', zone: 'التراس الخارجي', seats: '4 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { id: 8, number: 'T 3', zone: 'التراس الخارجي', seats: '4 مقاعد', status: 'available', currentSession: null, reservation: null, total: 0, waiter: '—' },
  { 
    id: 12, 
    number: '12', 
    zone: 'صالة العوائل', 
    seats: '4 مقاعد', 
    status: 'reserved', 
    currentSession: null, 
    reservation: {
      customerName: 'أحمد محمود',
      customerPhone: '01012345678',
      date: new Date().toISOString().split('T')[0],
      time: '20:00',
      guestsCount: 4,
      notes: 'حجز اليوم عائلي 4 أفراد - رغبة بمائدة هادئة',
      createdAt: new Date().toISOString()
    },
    total: 0, 
    waiter: '—' 
  }
];

export const TableManager = {
  getTables: () => {
    let raw = localStorage.getItem('cs_tables');
    if (!raw) {
      // السيرفر مش رجّع بيانات (أول مرة أو مشكلة اتصال)، نستخدم
      // نسخة احتياطية مدمجة كخط دفاع أخير ونحاول نبعتها للسيرفر
      const seed = DEFAULT_TABLES;
      seed.forEach(t => {
        if (t.reservation) {
          if (!t.reservation.date) t.reservation.date = new Date().toISOString().split('T')[0];
          if (!t.reservation.createdAt) t.reservation.createdAt = new Date().toISOString();
        }
      });
      DataService.set('tables', seed);
      return seed;
    }
    let tables = JSON.parse(raw);
    // Normalize status names from legacy ('free' -> 'available', 'busy' -> 'occupied')
    let changed = false;
    tables.forEach(t => {
      if (t.status === 'free') { t.status = 'available'; changed = true; }
      if (t.status === 'busy') { t.status = 'occupied'; changed = true; }
      if (!t.currentSession && t.status === 'occupied') {
        t.currentSession = {
          sessionId: 'sess_' + Date.now(),
          customerName: t.reserveCust || 'عميل صالة',
          waiter: t.waiter || 'وليد صبحي صالة',
          openedAt: new Date().toISOString(),
          rounds: [
            {
              roundNumber: 1,
              time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
              waiter: t.waiter || 'وليد صبحي صالة',
              items: t.items || [],
              subtotal: t.total || 0
            }
          ],
          total: t.total || 0
        };
        changed = true;
      }
    });
    if (changed) {
      DataService.set('tables', tables);
    }
    return tables;
  },

  saveTables: (tables) => {
    DataService.set('tables', tables);
  },

  getTable: (id) => {
    const tables = TableManager.getTables();
    return tables.find(t => String(t.id) === String(id) || String(t.number) === String(id)) || null;
  },

  // 1. Reserve Table
  reserveTable: (tableId, { customerName, customerPhone, date, time, guestsCount, notes }) => {
    const tables = TableManager.getTables();
    const t = tables.find(t => t.id == tableId);
    if (!t) throw new Error('الطاولة غير موجودة');

    t.status = TABLE_STATUS.RESERVED;
    t.reservation = {
      customerName: customerName.trim(),
      customerPhone: (customerPhone || '').trim(),
      date: date || new Date().toISOString().split('T')[0],
      time: time || '20:00',
      guestsCount: parseInt(guestsCount) || 2,
      notes: (notes || '').trim(),
      createdAt: new Date().toISOString()
    };
    t.currentSession = null;
    t.total = 0;
    TableManager.saveTables(tables);
    return t;
  },

  // 2. Check-in Reservation (Customer Arrived -> Reserved to Occupied)
  checkInReservation: (tableId, waiter = 'وليد صبحي صالة') => {
    const tables = TableManager.getTables();
    const t = tables.find(t => t.id == tableId);
    if (!t) throw new Error('الطاولة غير موجودة');

    const customerName = (t.reservation && t.reservation.customerName) ? t.reservation.customerName : 'عميل محجوز';
    const customerPhone = (t.reservation && t.reservation.customerPhone) ? t.reservation.customerPhone : '';

    t.status = TABLE_STATUS.OCCUPIED;
    t.currentSession = {
      sessionId: 'sess_' + Date.now(),
      customerName: customerName,
      customerPhone: customerPhone,
      waiter: waiter,
      openedAt: new Date().toISOString(),
      rounds: [],
      discount: 0,
      discountType: 'flat',
      total: 0
    };
    t.reservation = null;
    t.waiter = waiter;
    t.total = 0;
    TableManager.saveTables(tables);
    return t;
  },

  // 3. Open New Session (Available to Occupied)
  openSession: (tableId, customerName = 'عميل صالة', waiter = 'وليد صبحي صالة') => {
    const tables = TableManager.getTables();
    const t = tables.find(t => t.id == tableId);
    if (!t) throw new Error('الطاولة غير موجودة');

    t.status = TABLE_STATUS.OCCUPIED;
    t.currentSession = {
      sessionId: 'sess_' + Date.now(),
      customerName: customerName.trim() || 'عميل صالة',
      customerPhone: '',
      waiter: waiter || 'وليد صبحي صالة',
      openedAt: new Date().toISOString(),
      rounds: [],
      discount: 0,
      discountType: 'flat',
      total: 0
    };
    t.reservation = null;
    t.waiter = waiter;
    t.total = 0;
    TableManager.saveTables(tables);
    return t;
  },

  // 4. Add a Round of orders to the Table Session
  addRound: (tableId, items, waiter = null, note = '') => {
    const tables = TableManager.getTables();
    const t = tables.find(t => t.id == tableId);
    if (!t) throw new Error('الطاولة غير موجودة');

    if (t.status !== TABLE_STATUS.OCCUPIED || !t.currentSession) {
      // Auto-open session if table wasn't marked occupied yet
      TableManager.openSession(tableId, 'عميل صالة', waiter || 'وليد صبحي صالة');
      return TableManager.addRound(tableId, items, waiter, note);
    }

    const roundNum = (t.currentSession.rounds ? t.currentSession.rounds.length : 0) + 1;
    const now = new Date();
    const roundSubtotal = items.reduce((sum, it) => sum + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 1), 0);

    const newRound = {
      roundNumber: roundNum,
      time: now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      waiter: waiter || t.currentSession.waiter || 'وليد صبحي صالة',
      note: note || '',
      items: items.map(it => ({
        itemId: it.itemId,
        name: it.name,
        price: parseFloat(it.price) || 0,
        qty: parseInt(it.qty) || 1,
        note: it.note || ''
      })),
      subtotal: roundSubtotal,
      kitchenStatus: 'new',
      sentToKitchenAt: now.toISOString()
    };

    if (!t.currentSession.rounds) t.currentSession.rounds = [];
    t.currentSession.rounds.push(newRound);

    // Recalculate total
    const totalSub = t.currentSession.rounds.reduce((sum, r) => sum + (r.subtotal || 0), 0);
    t.currentSession.total = totalSub;
    t.total = totalSub;
    t.items = t.currentSession.rounds.flatMap(r => r.items);

    TableManager.saveTables(tables);
    return t;
  },

  // 4.5. Update kitchen status for a specific round without touching the table session
  updateRoundStatus: (tableId, roundNumber, status) => {
    const tables = TableManager.getTables();
    const strId = String(tableId);
    const t = tables.find(t => String(t.id) === strId || String(t.number) === strId);
    if (!t || !t.currentSession) throw new Error('لا توجد جلسة نشطة على هذه الطاولة');

    const round = (t.currentSession.rounds || []).find(r => Number(r.roundNumber) === Number(roundNumber));
    if (!round) throw new Error('الـ Round غير موجود');

    round.kitchenStatus = status;
    round.kitchenUpdatedAt = new Date().toISOString();

    // Keep the session/order totals untouched. Updating kitchen state must never
    // create an invoice or close the table.
    TableManager.saveTables(tables);
    return round;
  },

  // 5. Settle / Checkout Table and Close Session
  checkoutTable: (tableId, paymentMethod = 'cash', discountVal = 0, discountType = 'flat') => {
    const tables = TableManager.getTables();
    const strId = String(tableId);
    const t = tables.find(t => String(t.id) === strId || String(t.number) === strId);
    if (!t || !t.currentSession) throw new Error('لا توجد جلسة نشطة على هذه الطاولة');

    const session = t.currentSession;
    const allItems = (session.rounds || []).flatMap(r => r.items);
    const subtotal = allItems.reduce((sum, it) => sum + (it.price * it.qty), 0);

    const discNum = parseFloat(discountVal) || 0;
    const discount = discountType === 'pct' ? (subtotal * (discNum / 100)) : Math.min(discNum, subtotal);
    const total = Math.max(0, subtotal - discount);

    const now = new Date();
    const orders = JSON.parse(localStorage.getItem('cs_orders') || '[]');
    const oId = orders.length > 0 ? (Math.max(...orders.map(o => parseInt(o.id) || 0)) + 1) : 1;

    const completedInvoice = {
      id: oId,
      type: 'dine',
      tableId: t.id,
      tableNumber: t.number,
      tableLabel: 'طاولة ' + t.number,
      tableSessionId: session.sessionId,
      customer: session.customerName || 'عميل صالة',
      customerPhone: session.customerPhone || '',
      waiter: session.waiter || t.waiter,
      openedAt: session.openedAt,
      closedAt: now.toISOString(),
      rounds: session.rounds,
      items: allItems,
      subtotal: subtotal,
      discount: discount,
      total: total,
      payMethod: paymentMethod,
      status: 'paid',
      time: now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      date: now.toISOString().split('T')[0],
      createdAt: now.toISOString()
    };

    orders.push(completedInvoice);
    DataService.set('orders', orders);

    // Reset Table to Cleaning so floor staff knows it needs sanitizing
    t.status = TABLE_STATUS.CLEANING;
    t.currentSession = null;
    t.reservation = null;
    t.total = 0;
    t.items = [];
    t.waiter = '—';

    TableManager.saveTables(tables);
    return completedInvoice;
  },

  // 6. Set table to cleaning
  setCleaning: (tableId) => {
    const tables = TableManager.getTables();
    const strId = String(tableId);
    const t = tables.find(t => String(t.id) === strId || String(t.number) === strId);
    if (!t) return null;
    t.status = TABLE_STATUS.CLEANING;
    t.currentSession = null;
    t.reservation = null;
    t.items = [];
    t.total = 0;
    t.waiter = '—';
    TableManager.saveTables(tables);
    return t;
  },

  // 7. Set table to available
  setAvailable: (tableId) => {
    const tables = TableManager.getTables();
    const strId = String(tableId);
    const t = tables.find(t => String(t.id) === strId || String(t.number) === strId);
    if (!t) return null;
    t.status = TABLE_STATUS.AVAILABLE;
    t.currentSession = null;
    t.reservation = null;
    t.items = [];
    t.total = 0;
    t.waiter = '—';
    TableManager.saveTables(tables);
    return t;
  },

  // 8. Transfer table session from one table to another
  transferTable: (fromTableId, toTableId) => {
    const tables = TableManager.getTables();
    const strFrom = String(fromTableId);
    const strTo = String(toTableId);
    const tFrom = tables.find(t => String(t.id) === strFrom || String(t.number) === strFrom);
    const tTo = tables.find(t => String(t.id) === strTo || String(t.number) === strTo);
    if (!tFrom || !tFrom.currentSession) throw new Error('طاولة المصدر لا تحتوي على جلسة نشطة');
    if (!tTo) throw new Error('طاولة الوجهة غير موجودة');

    // Transfer session
    tTo.status = TABLE_STATUS.OCCUPIED;
    tTo.currentSession = {
      ...tFrom.currentSession,
      customerName: tFrom.currentSession.customerName || 'عميل صالة',
      transferredFrom: tFrom.number,
      transferredAt: new Date().toISOString()
    };
    tTo.items = tFrom.items || [];
    tTo.total = tFrom.total || 0;
    tTo.waiter = tFrom.waiter || tTo.waiter || 'وليد صبحي صالة';

    // Free original table and set to cleaning
    tFrom.status = TABLE_STATUS.CLEANING;
    tFrom.currentSession = null;
    tFrom.reservation = null;
    tFrom.items = [];
    tFrom.total = 0;
    tFrom.waiter = '—';

    TableManager.saveTables(tables);
    return { from: tFrom, to: tTo };
  },

  // 9. Force free table
  forceFreeTable: (tableId, targetStatus = 'cleaning') => {
    if (targetStatus === 'available') {
      return TableManager.setAvailable(tableId);
    }
    return TableManager.setCleaning(tableId);
  }
};

// Sync Admin and Firestore users into local storage
export async function syncFirestoreUsers() {
  try {
    await loadFirebasePromise;
  } catch (e) {}
  if (!db || !fbFirestore) return;
  try {
    const adminDocRef = fbFirestore.doc(db, 'users', '3SNhsc2ilvc42YWXhKpLzBO5Yu32');
    const adminSnap = await fbFirestore.getDoc(adminDocRef);
    const users = AuthService.getUsers();
    let modified = false;

    if (adminSnap.exists()) {
      const data = adminSnap.data();
      const existingIdx = users.findIndex(u => 
        u.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32' || 
        (u.email && u.email.toLowerCase() === (data.email || '').toLowerCase()) ||
        u.username === 'mahmoud.mostfa'
      );

      if (existingIdx !== -1) {
        users[existingIdx].role = 'admin';
        users[existingIdx].fullName = data.name || data.fullName || 'Mahmoud Mostafa';
        users[existingIdx].email = data.email || 'mahmoud.mostfa@app.com';
        users[existingIdx].active = true;
        users[existingIdx].id = '3SNhsc2ilvc42YWXhKpLzBO5Yu32';
        modified = true;
      } else {
        users.unshift({
          id: '3SNhsc2ilvc42YWXhKpLzBO5Yu32',
          username: 'mahmoud.mostfa',
          email: data.email || 'mahmoud.mostfa@app.com',
          fullName: data.name || data.fullName || 'Mahmoud Mostafa',
          role: 'admin',
          active: true,
          createdAt: new Date().toISOString(),
          permissions: ['all']
        });
        modified = true;
      }
    }

    if (modified) {
      AuthService.saveUsers(users);
      const currentSession = AuthService.getSession();
      if (currentSession && (
        (currentSession.email && currentSession.email.toLowerCase() === 'mahmoud.mostfa@app.com') ||
        currentSession.id === '3SNhsc2ilvc42YWXhKpLzBO5Yu32' ||
        currentSession.username === 'mahmoud.mostfa'
      )) {
        currentSession.role = 'admin';
        currentSession.fullName = 'Mahmoud Mostafa';
        AuthService.setSession(currentSession);
      }
    }
  } catch (err) {
    console.warn("syncFirestoreUsers notice:", err);
  }
}

// Trigger background sync
syncFirestoreUsers();

// Make available globally on window
if (typeof window !== 'undefined') {
  window.AuthService = AuthService;
  window.syncFirestoreUsers = syncFirestoreUsers;
  window.handleLogout = () => AuthService.logout();
  window.ROLES = ROLES;
  window.ROLE_LABELS = ROLE_LABELS;
  window.ROLE_ALLOWED_PAGES = ROLE_ALLOWED_PAGES;
  window.ROLE_HOME_PAGES = ROLE_HOME_PAGES;
  window.TableManager = TableManager;
  window.TABLE_STATUS = TABLE_STATUS;
  window.TABLE_STATUS_LABELS = TABLE_STATUS_LABELS;
}

export default AuthService;

