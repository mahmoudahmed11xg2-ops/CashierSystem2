import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

const DOMAIN_FILES: Record<string, { file: string; isObject?: boolean; nullable?: boolean }> = {
  categories:    { file: 'data/catalog/categories.json' },
  items:         { file: 'data/catalog/items.json' },
  recipes:       { file: 'data/catalog/recipes.json' },
  stock:         { file: 'data/inventory/stock.json' },
  tables:        { file: 'data/tables/tables.json' },
  customers:     { file: 'data/crm/customers.json' },
  suppliers:     { file: 'data/crm/suppliers.json' },
  captains:      { file: 'data/crm/captains.json' },
  staff:         { file: 'data/crm/staff.json' },
  storeConfig:   { file: 'data/settings/store-config.json', isObject: true },
  orders:        { file: 'data/transactions/orders.json' },
  expenses:      { file: 'data/transactions/expenses.json' },
  guardLogs:     { file: 'data/transactions/guard-logs.json' },
  shiftsLog:     { file: 'data/transactions/shifts-log.json' },
  activeShift:   { file: 'data/transactions/active-shift.json', isObject: true, nullable: true }
};

function resolveFilePath(relPath: string): string {
  return path.join(process.cwd(), relPath);
}

function readDomainFile(domainName: string) {
  const conf = DOMAIN_FILES[domainName];
  if (!conf) return null;
  const fullPath = resolveFilePath(conf.file);
  try {
    if (!fs.existsSync(fullPath)) {
      const fallback = conf.isObject ? (conf.nullable ? null : {}) : [];
      return fallback;
    }
    const raw = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Server] Error reading ${domainName} from ${fullPath}:`, err);
    return conf.isObject ? (conf.nullable ? null : {}) : [];
  }
}

function writeDomainFile(domainName: string, data: any): boolean {
  const conf = DOMAIN_FILES[domainName];
  if (!conf) return false;
  const fullPath = resolveFilePath(conf.file);
  try {
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`[Server] Error writing ${domainName} to ${fullPath}:`, err);
    return false;
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*' }
  });

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // -------------------------------------------------------------
  // API Routes
  // -------------------------------------------------------------
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      time: new Date().toISOString()
    });
  });

  // Get all domains at once for fast bootstrap
  app.get('/api/data', (req, res) => {
    const allData: Record<string, any> = {};
    for (const key of Object.keys(DOMAIN_FILES)) {
      allData[key] = readDomainFile(key);
    }
    res.json(allData);
  });

  // Read a single domain
  app.get('/api/data/:domain', (req, res) => {
    const domain = req.params.domain;
    if (!DOMAIN_FILES[domain]) {
      return res.status(404).json({ error: `Domain '${domain}' not found` });
    }
    const data = readDomainFile(domain);
    res.json(data);
  });

  // Write a single domain
  app.post('/api/data/:domain', (req, res) => {
    const domain = req.params.domain;
    if (!DOMAIN_FILES[domain]) {
      return res.status(404).json({ error: `Domain '${domain}' not found` });
    }
    const value = req.body?.value;
    const ok = writeDomainFile(domain, value);
    if (ok) {
      // Broadcast real-time update to all connected screens/clients
      io.emit('cs:update', {
        file: DOMAIN_FILES[domain].file,
        domain,
        value,
        timestamp: Date.now()
      });
      res.json({ ok: true, domain });
    } else {
      res.status(500).json({ error: `Failed to persist domain '${domain}' to disk` });
    }
  });

  // -------------------------------------------------------------
  // Backup Vault Management (/data/backups) — مخزن النسخ الاحتياطية
  // -------------------------------------------------------------
  const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // جمع كافة بيانات النظام
  function collectAllDataSnapshot() {
    const snapshot: Record<string, any> = {};
    for (const key of Object.keys(DOMAIN_FILES)) {
      snapshot[key] = readDomainFile(key);
    }
    return snapshot;
  }

  // قائمة النسخ الاحتياطية في المخزن
  app.get('/api/backups/list', (req, res) => {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        return res.json({ ok: true, backups: [] });
      }
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
      const list = files.map(filename => {
        const fullPath = path.join(BACKUP_DIR, filename);
        const stats = fs.statSync(fullPath);
        return {
          filename,
          sizeBytes: stats.size,
          sizeFormatted: (stats.size / 1024).toFixed(1) + ' KB',
          createdAt: stats.mtime.toISOString(),
          createdDate: stats.mtime.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })
        };
      });
      // ترتيب تنازلي حسب الأحدث
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json({ ok: true, backups: list });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // إنشاء وحفظ نسخة احتياطية جديدة داخل فولدر المخزن /data/backups
  app.post('/api/backups/create', (req, res) => {
    try {
      const { note, customData } = req.body || {};
      const dataToSave = (customData && typeof customData === 'object' && Object.keys(customData).length > 0)
        ? customData
        : collectAllDataSnapshot();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const cleanNote = note ? `_${String(note).trim().replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_')}` : '';
      const filename = `backup_${timestamp}${cleanNote}.json`;
      const fullPath = path.join(BACKUP_DIR, filename);

      const payload = {
        meta: {
          app: 'CashierSystem',
          type: 'local_storage_vault_backup',
          timestamp: new Date().toISOString(),
          note: note || '',
          domainsCount: Object.keys(dataToSave).length
        },
        data: dataToSave
      };

      fs.writeFileSync(fullPath, JSON.stringify(payload, null, 2), 'utf-8');
      const stats = fs.statSync(fullPath);

      res.json({
        ok: true,
        message: 'تم حفظ النسخة الاحتياطية في مجلد المخزن بنجاح',
        filename,
        sizeFormatted: (stats.size / 1024).toFixed(1) + ' KB',
        createdAt: stats.mtime.toISOString()
      });
    } catch (err: any) {
      console.error('[Server] Create backup error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // تحميل أو فحص ملف نسخة احتياطية محدد
  app.get('/api/backups/download/:filename', (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const fullPath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ ok: false, error: 'الملف غير موجود' });
      }
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json');
      fs.createReadStream(fullPath).pipe(res);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // استعادة البيانات من نسخة محددة في المخزن
  app.post('/api/backups/restore/:filename', (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const fullPath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ ok: false, error: 'ملف النسخة الاحتياطية غير موجود' });
      }

      const raw = fs.readFileSync(fullPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const data = parsed.data || parsed; // يدعم الملفات سواء كانت مغلفة بـ meta/data أو مباشرة

      let restoredCount = 0;
      for (const [key, value] of Object.entries(data)) {
        if (DOMAIN_FILES[key]) {
          writeDomainFile(key, value);
          restoredCount++;
        }
      }

      io.emit('cs:reload');
      res.json({
        ok: true,
        message: `تم استعادة البيانات بنجاح (${restoredCount} مجالات)`,
        restoredCount,
        source: filename
      });
    } catch (err: any) {
      console.error('[Server] Restore backup error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // حذف نسخة احتياطية محددة من المخزن
  app.delete('/api/backups/delete/:filename', (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const fullPath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ ok: false, error: 'الملف غير موجود بالفعل' });
      }
      fs.unlinkSync(fullPath);
      res.json({ ok: true, message: `تم حذف النسخة (${filename}) بنجاح`, filename });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Backup Export
  app.get('/api/backup/export', (req, res) => {
    const backup: Record<string, any> = {};
    for (const key of Object.keys(DOMAIN_FILES)) {
      backup[key] = readDomainFile(key);
    }
    res.setHeader('Content-Disposition', `attachment; filename=pos_backup_${Date.now()}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  });

  // Backup Import
  app.post('/api/backup/import', (req, res) => {
    const backup = req.body;
    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ error: 'Invalid backup payload' });
    }
    const data = backup.data || backup;
    let restoredCount = 0;
    for (const [key, value] of Object.entries(data)) {
      if (DOMAIN_FILES[key]) {
        writeDomainFile(key, value);
        restoredCount++;
      }
    }
    io.emit('cs:reload');
    res.json({ ok: true, restoredCount });
  });

  // -------------------------------------------------------------
  // Telegram Bot Shift Report Relay Endpoint (Supports Multiple Chat IDs)
  // -------------------------------------------------------------
  app.post('/api/telegram/send-shift-report', async (req, res) => {
    try {
      const { token, chatId, chatIds, caption, fileName, fileBase64 } = req.body || {};
      const storeConfig = readDomainFile('storeConfig') || {};
      const botToken = token || storeConfig.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '8864429923:AAFUW-7EV7xkxR0jFIizs9Oc4hPUnG8HeEs';
      
      // Parse list of chat IDs from body, storeConfig, or env
      let rawChatIds = chatIds || chatId || storeConfig.telegramChatIds || storeConfig.telegramChatId || process.env.TELEGRAM_CHAT_ID || '1724117996';
      let idList: string[] = [];
      if (Array.isArray(rawChatIds)) {
        idList = rawChatIds.map(x => String(x).trim()).filter(Boolean);
      } else if (typeof rawChatIds === 'string') {
        idList = rawChatIds.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
      }
      // Deduplicate IDs while preserving order
      idList = [...new Set(idList)];

      if (!botToken || idList.length === 0) {
        console.log('[Telegram] No Bot Token or Chat IDs configured. Report stored locally.');
        return res.json({
          ok: false,
          warning: 'لم يتم إدخال توكن بوت التيليجرام أو معرّفات المحادثة في الإعدادات. تم حفظ التقرير محلياً بنجاح.',
          savedLocally: true
        });
      }

      let fileBuffer: Buffer | null = null;
      if (fileBase64 && fileName) {
        fileBuffer = Buffer.from(fileBase64, 'base64');
      }

      const results: Array<{ chatId: string; ok: boolean; messageId?: number; description?: string; error?: string }> = [];

      // Send report to every configured Chat ID
      for (const targetChatId of idList) {
        try {
          if (fileBuffer && fileName) {
            const formData = new FormData();
            formData.append('chat_id', targetChatId);
            const fileBlob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            formData.append('document', fileBlob, fileName);
            if (caption) {
              formData.append('caption', caption);
              formData.append('parse_mode', 'Markdown');
            }

            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
              method: 'POST',
              body: formData
            });
            const tgData: any = await tgRes.json();
            results.push({
              chatId: targetChatId,
              ok: !!tgData.ok,
              messageId: tgData.result?.message_id,
              description: tgData.description
            });
          } else {
            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: targetChatId,
                text: caption,
                parse_mode: 'Markdown'
              })
            });
            const tgData: any = await tgRes.json();
            results.push({
              chatId: targetChatId,
              ok: !!tgData.ok,
              messageId: tgData.result?.message_id,
              description: tgData.description
            });
          }
        } catch (targetErr: any) {
          console.error(`[Telegram] Failed to send to chat ID ${targetChatId}:`, targetErr);
          results.push({
            chatId: targetChatId,
            ok: false,
            error: targetErr.message
          });
        }
      }

      const sentCount = results.filter(r => r.ok).length;
      return res.json({
        ok: sentCount > 0,
        sentCount,
        totalCount: idList.length,
        results,
        telegram: results[0] || null
      });
    } catch (err: any) {
      console.error('[Telegram] Error sending shift report:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // Socket.io Real-time Event Handling
  // -------------------------------------------------------------
  io.on('connection', (socket) => {
    socket.emit('cs:connected', { status: 'connected', time: Date.now() });

    // Client emitted data change
    socket.on('cs:update', ({ file, domain, value }) => {
      let dName = domain;
      if (!dName && file) {
        for (const [k, v] of Object.entries(DOMAIN_FILES)) {
          if (v.file === file) { dName = k; break; }
        }
      }
      if (dName && DOMAIN_FILES[dName]) {
        writeDomainFile(dName, value);
        socket.broadcast.emit('cs:update', {
          file: DOMAIN_FILES[dName].file,
          domain: dName,
          value,
          timestamp: Date.now()
        });
      }
    });

    // Customer display live cart broadcast
    socket.on('cs:customer_display', (data) => {
      socket.broadcast.emit('cs:customer_display', data);
    });
  });

  // -------------------------------------------------------------
  // Vite Middleware / Static Serving
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Cashier System Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
