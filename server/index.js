// ============================================================
//  Cashier System — Local Realtime Server
// ============================================================
// السيرفر ده هو "الداتا بيز المركزية" بتاعة النظام، شغالة على
// جهاز واحد في المحل (زي الكاشير الرئيسي مثلاً)، وكل الأجهزة
// التانية (تابلت الويتر، شاشة العميل، لاب توب المحاسب) بتتصل
// بيه عن طريق الشبكة الداخلية للمحل (WiFi/LAN).
//
// - REST API:  GET/PUT لكل نطاق بيانات (نفس فكرة Firestore
//   Collections، لكن كل نطاق هنا ملف JSON واحد تحت data/).
// - Socket.IO: أي تعديل من أي جهاز بيتبعت لحظيًا لكل الأجهزة
//   التانية المتصلة (زي onSnapshot في Firebase بالظبط).
//
// تشغيله: npm run server
// ============================================================

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { COLLECTIONS, readCollection, writeCollection, DATA_ROOT } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const PORT = process.env.PORT || 4000;
// لو محطوط مفتاح في .env، كل الطلبات (REST + Socket.IO) لازم تبعته.
// مفيدة تحديدًا لما تفتح وصول مؤقت من بره الشبكة الداخلية (Tunnel).
const ACCESS_KEY = process.env.ACCESS_KEY || '';

let tunnelProcess = null;
let activeTunnelUrl = null;
let tunnelStatus = 'stopped'; // 'stopped' | 'starting' | 'running' | 'error'
let tunnelLastError = null;

const app = express();
app.use(express.json({ limit: '2mb' }));

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

// -----------------------------------------------------------
// حماية بسيطة بمفتاح وصول (Access Key) — تتفعل بس لو ACCESS_KEY
// متحطوطة في .env
// -----------------------------------------------------------
function checkAccessKey(req, res, next) {
  if (!ACCESS_KEY) return next(); // مفيش حماية مفعّلة
  const provided = req.header('x-access-key');
  if (provided !== ACCESS_KEY) {
    return res.status(401).json({ error: 'مفتاح الوصول غير صحيح أو مفقود' });
  }
  next();
}

io.use((socket, next) => {
  if (!ACCESS_KEY) return next();
  if (socket.handshake.auth?.key === ACCESS_KEY) return next();
  next(new Error('مفتاح الوصول غير صحيح أو مفقود'));
});

// -----------------------------------------------------------
// REST API
// -----------------------------------------------------------

// جلب كل البيانات في نطاق معين
app.get('/api/data/:collection', checkAccessKey, (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS[collection]) {
    return res.status(404).json({ error: 'نطاق بيانات غير معروف: ' + collection });
  }
  const value = readCollection(collection);
  res.json({ collection, value });
});

// استبدال كل بيانات نطاق معين (يطابق طريقة عمل الصفحات الحالية:
// بتكتب المصفوفة/الكائن كامل في كل مرة)
app.put('/api/data/:collection', checkAccessKey, (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS[collection]) {
    return res.status(404).json({ error: 'نطاق بيانات غير معروف: ' + collection });
  }
  const { value, clientId } = req.body;
  writeCollection(collection, value);

  // إشعار كل الأجهزة المتصلة الأخرى بالتغيير لحظيًا
  io.emit('db:changed', { collection, value, clientId, at: new Date().toISOString() });

  res.json({ ok: true });
});

// جلب manifest.json (إصدار البيانات وقائمة الملفات)
app.get('/api/manifest', (req, res) => {
  const manifestPath = path.join(DATA_ROOT, 'manifest.json');
  res.sendFile(manifestPath);
});

// -----------------------------------------------------------
// إدارة الرابط الخارجي (Remote Access Tunnel)
// -----------------------------------------------------------
app.get('/api/tunnel/status', (req, res) => {
  res.json({
    status: tunnelStatus,
    url: activeTunnelUrl,
    error: tunnelLastError,
    accessKeyRequired: !!ACCESS_KEY
  });
});

app.post('/api/tunnel/start', checkAccessKey, (req, res) => {
  if (tunnelStatus === 'running' && activeTunnelUrl) {
    return res.json({ status: tunnelStatus, url: activeTunnelUrl });
  }

  tunnelStatus = 'starting';
  tunnelLastError = null;
  activeTunnelUrl = null;

  try {
    // تشغيل cloudflared tunnel
    tunnelProcess = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`], {
      shell: true
    });

    const urlRegex = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/;

    const handleOutput = (data) => {
      const text = data.toString();
      console.log('[Cloudflared Output]:', text);
      const match = text.match(urlRegex);
      if (match && !activeTunnelUrl) {
        activeTunnelUrl = match[0];
        tunnelStatus = 'running';
        console.log('>>> تم توليد رابط الوصول عن بعد بنجاح:', activeTunnelUrl);
      }
    };

    tunnelProcess.stdout.on('data', handleOutput);
    tunnelProcess.stderr.on('data', handleOutput);

    tunnelProcess.on('error', (err) => {
      tunnelStatus = 'error';
      tunnelLastError = err.message;
      console.error('Tunnel Error:', err);
    });

    tunnelProcess.on('exit', (code) => {
      if (tunnelStatus !== 'running') {
        tunnelStatus = 'error';
        tunnelLastError = `توقف الرابط بكود خروج ${code}. تأكد من الاتصال بالإنترنت.`;
      } else {
        tunnelStatus = 'stopped';
        activeTunnelUrl = null;
      }
      console.log('تم إيقاف رابط الوصول الخارجي.');
    });

    // نرد بعد ثانيتين مع آخر حالة تم رصدها
    setTimeout(() => {
      res.json({
        status: tunnelStatus,
        url: activeTunnelUrl,
        error: tunnelLastError
      });
    }, 2500);

  } catch (err) {
    tunnelStatus = 'error';
    tunnelLastError = err.message;
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tunnel/stop', checkAccessKey, (req, res) => {
  if (tunnelProcess) {
    try {
      tunnelProcess.kill();
    } catch (e) {}
    tunnelProcess = null;
  }
  tunnelStatus = 'stopped';
  activeTunnelUrl = null;
  res.json({ ok: true, status: 'stopped' });
});

// -----------------------------------------------------------
// تقديم ملفات المشروع نفسها (الصفحات، auth.js، js/، data/)
// عشان تفتح النظام من أي جهاز على نفس الشبكة بمجرد زيارة
// http://<IP بتاع الجهاز اللي شغال عليه السيرفر>:4000
// -----------------------------------------------------------
app.use(express.static(PROJECT_ROOT));

// -----------------------------------------------------------
// Socket.IO: تسجيل اتصال كل جهاز جديد
// -----------------------------------------------------------
io.on('connection', (socket) => {
  console.log('جهاز جديد اتصل بالسيرفر:', socket.id);
  socket.on('disconnect', () => {
    console.log('جهاز اتقطع:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log('==============================================');
  console.log('  Cashier System Server شغال على البورت', PORT);
  console.log('  من نفس الجهاز:   http://localhost:' + PORT);
  console.log('  من أي جهاز تاني على نفس الشبكة، استخدم IP الجهاز ده بدل localhost');
  console.log('==============================================');
});
