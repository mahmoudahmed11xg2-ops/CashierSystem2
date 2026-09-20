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
    let restoredCount = 0;
    for (const [key, value] of Object.entries(backup)) {
      if (DOMAIN_FILES[key]) {
        writeDomainFile(key, value);
        restoredCount++;
      }
    }
    io.emit('cs:reload');
    res.json({ ok: true, restoredCount });
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
