// ============================================================
//  Electron Main Process — تشغيل نظام الكاشير كنافذة ديسكتوب
// ============================================================

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

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

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  // تخصيص القوائم العلوية
  const menuTemplate = [
    {
      label: 'النظام',
      submenu: [
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
