// ============================================================
//  Electron Main Process — تشغيل نظام الكاشير كنافذة ديسكتوب
// ============================================================

const { app, BrowserWindow, Menu } = require('electron');
const { fork } = require('child_process');
const path = require('path');

let localServer;

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

  // تشغيل قاعدة البيانات المحلية أولاً. فتح التطبيق كملف file:// كان
  // يجعل حفظ JSON والمزامنة بين الأجهزة غير متاحين.
  mainWindow.loadURL('http://127.0.0.1:4000/index.html');

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
  localServer = fork(path.join(__dirname, '..', 'server', 'index.js'), [], {
    cwd: path.join(__dirname, '..'), stdio: 'ignore'
  });
  // Give Express a moment to bind the port before loading the UI.
  setTimeout(createWindow, 600);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (localServer && !localServer.killed) localServer.kill();
});
