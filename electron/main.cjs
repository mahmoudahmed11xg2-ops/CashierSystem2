// ============================================================
//  Electron Main Process — تشغيل نظام الكاشير كنافذة ديسكتوب
// ============================================================

const { app, BrowserWindow, Menu, screen } = require('electron');
const path = require('path');

let customerWindow = null;

function openCustomerWindow() {
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0) || (displays.length > 1 ? displays[1] : null);

  if (customerWindow && !customerWindow.isDestroyed()) {
    customerWindow.focus();
    return;
  }

  customerWindow = new BrowserWindow({
    x: externalDisplay ? externalDisplay.bounds.x : undefined,
    y: externalDisplay ? externalDisplay.bounds.y : undefined,
    width: externalDisplay ? externalDisplay.bounds.width : 1280,
    height: externalDisplay ? externalDisplay.bounds.height : 720,
    fullscreen: true,
    autoHideMenuBar: true,
    title: 'شاشة العميل التفاعلية',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  customerWindow.loadFile(path.join(__dirname, '..', 'customer-display.html'));
  customerWindow.on('closed', () => {
    customerWindow = null;
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 680,
    title: 'نظام الكاشير والمبيعات المتكامل',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // فتح ملف النظام المحلي مباشرة بدون الحاجة لأي سيرفر
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  // تخصيص القوائم العلوية
  const menuTemplate = [
    {
      label: 'النظام',
      submenu: [
        { label: 'شاشة العميل (الشاشة الثانية)', accelerator: 'CmdOrCtrl+Shift+C', click: () => openCustomerWindow() },
        { label: 'إعادة تحميل (Reload)', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { label: 'ملء الشاشة (Fullscreen)', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { type: 'separator' },
        { label: 'خروج', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'عرض',
      submenu: [
        { label: 'تكبير (+)', role: 'zoomIn' },
        { label: 'تصغير (-)', role: 'zoomOut' },
        { label: 'الحجم الطبيعي', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'أدوات المطورين (DevTools)', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
