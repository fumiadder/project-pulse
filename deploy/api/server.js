const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { execSync } = require('child_process');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3080;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'project-pulse.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables if not exist
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      userId TEXT,
      parentId TEXT,
      name TEXT NOT NULL,
      desc TEXT,
      owner TEXT,
      color TEXT,
      priority TEXT,
      status TEXT,
      startDate TEXT,
      endDate TEXT,
      collaborators TEXT,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS progress (
      id TEXT PRIMARY KEY,
      userId TEXT,
      projectId TEXT NOT NULL,
      date TEXT NOT NULL,
      percent INTEGER DEFAULT 0,
      status TEXT DEFAULT 'normal',
      content TEXT,
      plan TEXT,
      attachments TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      color TEXT,
      privatePassword TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      userId TEXT,
      type TEXT,
      date TEXT,
      entryCount INTEGER,
      generatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_tags (
      id TEXT PRIMARY KEY,
      userId TEXT,
      date TEXT,
      tag TEXT,
      content TEXT,
      majorProject TEXT,
      subProject TEXT,
      owner TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      userId TEXT,
      title TEXT,
      content TEXT,
      status TEXT,
      landedProjectId TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );
  `);

  // Migrate: add missing columns for existing tables
  try { db.exec(`ALTER TABLE users ADD COLUMN privatePassword TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE ideas ADD COLUMN landedProjectId TEXT`); } catch(e) {}
}

initDb();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper: now ISO string
const now = () => new Date().toISOString();

// Helper: sanitize row for SQLite (convert non-primitives to JSON strings)
function sanitizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) {
      out[k] = null;
    } else if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') {
      out[k] = v;
    } else if (Buffer.isBuffer(v)) {
      out[k] = v;
    } else {
      out[k] = JSON.stringify(v);
    }
  }
  return out;
}

// ---------- Health ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: now() });
});

// ---------- Projects ----------
app.get('/api/projects', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY updatedAt DESC').all();
  res.json({ success: true, data: rows });
});

app.put('/api/projects', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const insert = db.prepare(`
    INSERT INTO projects (id, userId, parentId, name, desc, owner, color, priority, status, startDate, endDate, collaborators, notes, createdAt, updatedAt)
    VALUES (@id, @userId, @parentId, @name, @desc, @owner, @color, @priority, @status, @startDate, @endDate, @collaborators, @notes, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      userId=excluded.userId,
      parentId=excluded.parentId,
      name=excluded.name,
      desc=excluded.desc,
      owner=excluded.owner,
      color=excluded.color,
      priority=excluded.priority,
      status=excluded.status,
      startDate=excluded.startDate,
      endDate=excluded.endDate,
      collaborators=excluded.collaborators,
      notes=excluded.notes,
      updatedAt=excluded.updatedAt
  `);
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      if (!r.id) r.id = uuidv4();
      if (!r.createdAt) r.createdAt = now();
      r.updatedAt = now();
      insert.run(sanitizeRow(r));
    }
  });
  tx(items);
  res.json({ success: true, data: items });
});

app.get('/api/projects/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: row });
});

app.delete('/api/projects/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ---------- Progress ----------
app.get('/api/progress', (req, res) => {
  const rows = db.prepare('SELECT * FROM progress ORDER BY date DESC, updatedAt DESC').all();
  res.json({ success: true, data: rows });
});

app.put('/api/progress', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const insert = db.prepare(`
    INSERT INTO progress (id, userId, projectId, date, percent, status, content, plan, attachments, createdAt, updatedAt)
    VALUES (@id, @userId, @projectId, @date, @percent, @status, @content, @plan, @attachments, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      userId=excluded.userId,
      projectId=excluded.projectId,
      date=excluded.date,
      percent=excluded.percent,
      status=excluded.status,
      content=excluded.content,
      plan=excluded.plan,
      attachments=excluded.attachments,
      updatedAt=excluded.updatedAt
  `);
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      if (!r.id) r.id = uuidv4();
      if (!r.createdAt) r.createdAt = now();
      r.updatedAt = now();
      insert.run(sanitizeRow(r));
    }
  });
  tx(items);
  res.json({ success: true, data: items });
});

app.get('/api/progress/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM progress WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: row });
});

app.delete('/api/progress/:id', (req, res) => {
  db.prepare('DELETE FROM progress WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ---------- Users ----------
app.get('/api/users', (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY createdAt DESC').all();
  res.json({ success: true, data: rows });
});

app.put('/api/users', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const insert = db.prepare(`
    INSERT INTO users (id, name, role, color, privatePassword, createdAt)
    VALUES (@id, @name, @role, @color, @privatePassword, @createdAt)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      role=excluded.role,
      color=excluded.color,
      privatePassword=excluded.privatePassword
  `);
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      if (!r.id) r.id = uuidv4();
      if (!r.createdAt) r.createdAt = now();
      insert.run(sanitizeRow(r));
    }
  });
  tx(items);
  res.json({ success: true, data: items });
});

// ---------- Settings ----------
app.get('/api/settings/:key', (req, res) => {
  const row = db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);
  res.json({ success: true, data: row || null });
});

app.put('/api/settings/:key', (req, res) => {
  const { value } = req.body;
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(req.params.key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  res.json({ success: true, data: { key: req.params.key, value } });
});

// ---------- Reports ----------
app.get('/api/reports', (req, res) => {
  const rows = db.prepare('SELECT * FROM reports ORDER BY generatedAt DESC').all();
  res.json({ success: true, data: rows });
});

app.put('/api/reports', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const insert = db.prepare(`
    INSERT INTO reports (id, userId, type, date, entryCount, generatedAt)
    VALUES (@id, @userId, @type, @date, @entryCount, @generatedAt)
    ON CONFLICT(id) DO UPDATE SET
      userId=excluded.userId,
      type=excluded.type,
      date=excluded.date,
      entryCount=excluded.entryCount,
      generatedAt=excluded.generatedAt
  `);
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      if (!r.id) r.id = uuidv4();
      if (!r.generatedAt) r.generatedAt = now();
      insert.run(sanitizeRow(r));
    }
  });
  tx(items);
  res.json({ success: true, data: items });
});

// ---------- Daily Tags ----------
app.get('/api/daily_tags', (req, res) => {
  const rows = db.prepare('SELECT * FROM daily_tags ORDER BY date DESC, createdAt DESC').all();
  res.json({ success: true, data: rows });
});

app.put('/api/daily_tags', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const insert = db.prepare(`
    INSERT INTO daily_tags (id, userId, date, tag, content, majorProject, subProject, owner, createdAt)
    VALUES (@id, @userId, @date, @tag, @content, @majorProject, @subProject, @owner, @createdAt)
    ON CONFLICT(id) DO UPDATE SET
      userId=excluded.userId,
      date=excluded.date,
      tag=excluded.tag,
      content=excluded.content,
      majorProject=excluded.majorProject,
      subProject=excluded.subProject,
      owner=excluded.owner
  `);
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      if (!r.id) r.id = uuidv4();
      if (!r.createdAt) r.createdAt = now();
      insert.run(sanitizeRow(r));
    }
  });
  tx(items);
  res.json({ success: true, data: items });
});

// ---------- Ideas ----------
app.get('/api/ideas', (req, res) => {
  const rows = db.prepare('SELECT * FROM ideas ORDER BY updatedAt DESC').all();
  res.json({ success: true, data: rows });
});

app.put('/api/ideas', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const insert = db.prepare(`
    INSERT INTO ideas (id, userId, title, content, status, landedProjectId, createdAt, updatedAt)
    VALUES (@id, @userId, @title, @content, @status, @landedProjectId, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      userId=excluded.userId,
      title=excluded.title,
      content=excluded.content,
      status=excluded.status,
      landedProjectId=excluded.landedProjectId,
      updatedAt=excluded.updatedAt
  `);
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      if (!r.id) r.id = uuidv4();
      if (!r.createdAt) r.createdAt = now();
      r.updatedAt = now();
      insert.run(sanitizeRow(r));
    }
  });
  tx(items);
  res.json({ success: true, data: items });
});

app.get('/api/ideas/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: row });
});

app.delete('/api/ideas/:id', (req, res) => {
  db.prepare('DELETE FROM ideas WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/ideas/:id/land', (req, res) => {
  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  if (!idea) return res.status(404).json({ success: false, error: 'Idea not found' });

  const { parentId, name, desc, owner } = req.body || {};
  const projectId = uuidv4();
  const project = {
    id: projectId,
    userId: idea.userId,
    parentId: parentId || null,
    name: name || idea.title,
    desc: desc || idea.content || '',
    owner: owner || '',
    color: '#00d4ff',
    priority: '中',
    status: '未开始',
    createdAt: now(),
    updatedAt: now()
  };

  const insertProject = db.prepare(`
    INSERT INTO projects (id, userId, parentId, name, desc, owner, color, priority, status, startDate, endDate, collaborators, notes, createdAt, updatedAt)
    VALUES (@id, @userId, @parentId, @name, @desc, @owner, @color, @priority, @status, @startDate, @endDate, @collaborators, @notes, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      userId=excluded.userId, parentId=excluded.parentId, name=excluded.name, desc=excluded.desc,
      owner=excluded.owner, color=excluded.color, priority=excluded.priority, status=excluded.status,
      startDate=excluded.startDate, endDate=excluded.endDate, collaborators=excluded.collaborators,
      notes=excluded.notes, updatedAt=excluded.updatedAt
  `);

  const updateIdea = db.prepare(`
    UPDATE ideas SET status='landed', landedProjectId=?, updatedAt=? WHERE id=?
  `);

  const tx = db.transaction(() => {
    insertProject.run(sanitizeRow(project));
    updateIdea.run(projectId, now(), req.params.id);
  });
  tx();

  res.json({ success: true, data: { projectId } });
});

// ---------- Sync ----------
app.get('/api/sync/full', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects').all();
  const progress = db.prepare('SELECT * FROM progress').all();
  const users = db.prepare('SELECT * FROM users').all();
  const reports = db.prepare('SELECT * FROM reports').all();
  const dailyTags = db.prepare('SELECT * FROM daily_tags').all();
  const settingsRows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  for (const s of settingsRows) {
    try { settings[s.key] = JSON.parse(s.value); } catch { settings[s.key] = s.value; }
  }
  res.json({
    success: true,
    data: { projects, progress, users, reports, daily_tags: dailyTags, settings }
  });
});

app.post('/api/sync/full', (req, res) => {
  const { projects: pArr, progress: prArr, users: uArr, reports: rArr, daily_tags: dArr, settings: sObj } = req.body || {};
  if (pArr && Array.isArray(pArr)) {
    const stmt = db.prepare(`
      INSERT INTO projects (id, userId, parentId, name, desc, owner, color, priority, status, startDate, endDate, collaborators, notes, createdAt, updatedAt)
      VALUES (@id, @userId, @parentId, @name, @desc, @owner, @color, @priority, @status, @startDate, @endDate, @collaborators, @notes, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        userId=excluded.userId, parentId=excluded.parentId, name=excluded.name, desc=excluded.desc,
        owner=excluded.owner, color=excluded.color, priority=excluded.priority, status=excluded.status,
        startDate=excluded.startDate, endDate=excluded.endDate, collaborators=excluded.collaborators,
        notes=excluded.notes, updatedAt=excluded.updatedAt
    `);
    const tx = db.transaction((rows) => { for (const r of rows) stmt.run(sanitizeRow(r)); });
    tx(pArr);
  }
  if (prArr && Array.isArray(prArr)) {
    const stmt = db.prepare(`
      INSERT INTO progress (id, userId, projectId, date, percent, status, content, plan, attachments, createdAt, updatedAt)
      VALUES (@id, @userId, @projectId, @date, @percent, @status, @content, @plan, @attachments, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        userId=excluded.userId, projectId=excluded.projectId, date=excluded.date, percent=excluded.percent,
        status=excluded.status, content=excluded.content, plan=excluded.plan, attachments=excluded.attachments, updatedAt=excluded.updatedAt
    `);
    const tx = db.transaction((rows) => { for (const r of rows) stmt.run(sanitizeRow(r)); });
    tx(prArr);
  }
  if (uArr && Array.isArray(uArr)) {
    const stmt = db.prepare(`
      INSERT INTO users (id, name, role, color, createdAt)
      VALUES (@id, @name, @role, @color, @createdAt)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, role=excluded.role, color=excluded.color
    `);
    const tx = db.transaction((rows) => { for (const r of rows) stmt.run(sanitizeRow(r)); });
    tx(uArr);
  }
  if (rArr && Array.isArray(rArr)) {
    const stmt = db.prepare(`
      INSERT INTO reports (id, userId, type, date, entryCount, generatedAt)
      VALUES (@id, @userId, @type, @date, @entryCount, @generatedAt)
      ON CONFLICT(id) DO UPDATE SET userId=excluded.userId, type=excluded.type, date=excluded.date, entryCount=excluded.entryCount, generatedAt=excluded.generatedAt
    `);
    const tx = db.transaction((rows) => { for (const r of rows) stmt.run(sanitizeRow(r)); });
    tx(rArr);
  }
  if (dArr && Array.isArray(dArr)) {
    const stmt = db.prepare(`
      INSERT INTO daily_tags (id, userId, date, tag, content, majorProject, subProject, owner, createdAt)
      VALUES (@id, @userId, @date, @tag, @content, @majorProject, @subProject, @owner, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        userId=excluded.userId, date=excluded.date, tag=excluded.tag, content=excluded.content,
        majorProject=excluded.majorProject, subProject=excluded.subProject, owner=excluded.owner
    `);
    const tx = db.transaction((rows) => { for (const r of rows) stmt.run(sanitizeRow(r)); });
    tx(dArr);
  }
  if (sObj && typeof sObj === 'object') {
    const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
    const tx = db.transaction((obj) => { for (const [k, v] of Object.entries(obj)) stmt.run(k, typeof v === 'object' ? JSON.stringify(v) : String(v)); });
    tx(sObj);
  }
  res.json({ success: true });
});

// ---------- Stats ----------
app.get('/api/stats', (req, res) => {
  const projectCount = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
  const progressCount = db.prepare('SELECT COUNT(*) as c FROM progress').get().c;
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const reportCount = db.prepare('SELECT COUNT(*) as c FROM reports').get().c;
  const dailyTagCount = db.prepare('SELECT COUNT(*) as c FROM daily_tags').get().c;
  const latestProgress = db.prepare('SELECT MAX(date) as d FROM progress').get().d;
  res.json({
    success: true,
    data: {
      projectCount,
      progressCount,
      userCount,
      reportCount,
      dailyTagCount,
      latestProgressDate: latestProgress
    }
  });
});

// ---------- Backup ----------
app.post('/api/backup', (req, res) => {
  const backupPath = path.join(dataDir, `backup-${Date.now()}.db`);
  db.backup(backupPath)
    .then(() => res.json({ success: true, path: backupPath }))
    .catch(err => res.status(500).json({ success: false, error: err.message }));
});

// ---------- Debug ----------
app.get('/api/debug', (req, res) => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const counts = {};
  for (const t of tables) {
    counts[t.name] = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get().c;
  }
  res.json({ success: true, tables: tables.map(t => t.name), counts, dbPath: DB_PATH });
});

// ---------- File Upload ----------
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dateDir = path.join(UPLOAD_DIR, new Date().toISOString().slice(0, 10));
    if (!fs.existsSync(dateDir)) fs.mkdirSync(dateDir, { recursive: true });
    cb(null, dateDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = uuidv4();
    cb(null, `${id}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    // Allow images, videos, documents
    const allowed = /\.(jpg|jpeg|png|gif|webp|bmp|svg|mp4|mov|avi|mkv|webm|mp3|wav|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|7z)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
});

// Upload single file
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  const fileUrl = `/uploads/${new Date().toISOString().slice(0, 10)}/${req.file.filename}`;
  const fileInfo = {
    id: uuidv4(),
    url: fileUrl,
    name: req.file.originalname,
    size: req.file.size,
    type: req.file.mimetype,
    uploadedAt: now()
  };
  res.json({ success: true, data: fileInfo });
});

// Upload multiple files
app.post('/api/upload/multiple', upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, error: 'No files uploaded' });
  const files = req.files.map(f => ({
    id: uuidv4(),
    url: `/uploads/${new Date().toISOString().slice(0, 10)}/${f.filename}`,
    name: f.originalname,
    size: f.size,
    type: f.mimetype,
    uploadedAt: now()
  }));
  res.json({ success: true, data: files });
});

// Serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));

// Delete uploaded file
app.delete('/api/upload/:dateDir/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.dateDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'File not found' });
  }
});

// ---------- GitHub Webhook Auto-Deploy ----------
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'project-pulse-webhook-secret-2026';
const REPO_DIR = process.env.REPO_DIR || '/opt/project-pulse-repo';
const DEPLOY_DIR = process.env.DEPLOY_DIR || '/opt/project-pulse';
let isDeploying = false;

app.post('/hooks/github', (req, res) => {
  // Verify GitHub signature
  const sig = req.headers['x-hub-signature-256'];
  if (!sig) return res.status(401).json({ error: 'No signature' });
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(JSON.stringify(req.body));
  const expected = `sha256=${hmac.digest('hex')}`;
  if (sig !== expected) return res.status(401).json({ error: 'Invalid signature' });

  // Only respond to push events on main branch
  const event = req.headers['x-github-event'];
  const ref = req.body?.ref;
  if (event !== 'push' || ref !== 'refs/heads/main') {
    return res.json({ status: 'ignored', event, ref });
  }

  res.json({ status: 'deploying' });

  // Async deploy to not block the response
  if (isDeploying) {
    console.log('[Webhook] Deploy already in progress, skipping');
    return;
  }
  isDeploying = true;
  console.log(`[Webhook] Deploy triggered at ${new Date().toISOString()}`);

  (async () => {
    try {
      // 1. Pull latest code
      console.log('[Webhook] Pulling latest code...');
      execSync(`cd ${REPO_DIR} && git pull origin main`, { stdio: 'inherit' });

      // 2. Build frontend
      console.log('[Webhook] Building frontend...');
      execSync(`cd ${REPO_DIR} && npm run build`, { stdio: 'inherit', timeout: 120000 });

      // 3. Copy dist
      console.log('[Webhook] Copying dist...');
      execSync(`rm -rf ${DEPLOY_DIR}/dist && cp -r ${REPO_DIR}/dist ${DEPLOY_DIR}/dist`);

      // 4. Copy api
      console.log('[Webhook] Copying api...');
      execSync(`rm -rf ${DEPLOY_DIR}/api && mkdir -p ${DEPLOY_DIR}/api && cp -r ${REPO_DIR}/deploy/api/* ${DEPLOY_DIR}/api/`);

      // 5. Restart this process
      console.log('[Webhook] Restarting API server...');
      // Kill self after response is sent
      setTimeout(() => process.exit(0), 1000);

      console.log('[Webhook] Deploy completed successfully');
    } catch (err) {
      console.error('[Webhook] Deploy failed:', err.message);
    } finally {
      isDeploying = false;
    }
  })();
});

// Webhook health check
app.get('/hooks/status', (req, res) => {
  res.json({ status: 'ok', deploying: isDeploying, repo: REPO_DIR, deployDir: DEPLOY_DIR });
});

// ---------- Data Migration from KV ----------
// Sanitize row: convert non-primitive fields to JSON strings for SQLite
app.post('/api/migrate/kv', (req, res) => {
  try {
    const data = req.body;
    let stats = { projects: 0, progress: 0, users: 0, reports: 0, daily_tags: 0, settings: 0, errors: [] };

    const insertProject = db.prepare(`
      INSERT OR REPLACE INTO projects (id, userId, parentId, name, desc, owner, color, priority, status, startDate, endDate, collaborators, notes, createdAt, updatedAt)
      VALUES (@id, @userId, @parentId, @name, @desc, @owner, @color, @priority, @status, @startDate, @endDate, @collaborators, @notes, @createdAt, @updatedAt)
    `);
    const insertProgress = db.prepare(`
      INSERT OR REPLACE INTO progress (id, userId, projectId, date, percent, status, content, plan, attachments, createdAt, updatedAt)
      VALUES (@id, @userId, @projectId, @date, @percent, @status, @content, @plan, @attachments, @createdAt, @updatedAt)
    `);
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, role, color, createdAt)
      VALUES (@id, @name, @role, @color, @createdAt)
    `);
    const insertSetting = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)
    `);

    const transaction = db.transaction(() => {
      // Projects
      (data.projects || []).forEach(item => {
        try { insertProject.run(sanitizeRow(item)); stats.projects++; } catch (e) { stats.errors.push(`project ${item.id}: ${e.message}`); }
      });
      // Progress
      (data.progress || []).forEach(item => {
        try { insertProgress.run(sanitizeRow(item)); stats.progress++; } catch (e) { stats.errors.push(`progress ${item.id}: ${e.message}`); }
      });
      // Users
      (data.users || []).forEach(item => {
        try { insertUser.run(sanitizeRow(item)); stats.users++; } catch (e) { stats.errors.push(`user ${item.id}: ${e.message}`); }
      });
      // Reports
      (data.reports || []).forEach(item => {
        try { db.prepare(`INSERT OR REPLACE INTO reports (id, userId, type, date, entryCount, generatedAt) VALUES (@id, @userId, @type, @date, @entryCount, @generatedAt)`).run(sanitizeRow(item)); stats.reports++; } catch (e) { stats.errors.push(`report ${item.id}: ${e.message}`); }
      });
      // Daily tags
      (data.daily_tags || []).forEach(item => {
        try { db.prepare(`INSERT OR REPLACE INTO daily_tags (id, userId, date, tag, content, majorProject, subProject, owner, createdAt) VALUES (@id, @userId, @date, @tag, @content, @majorProject, @subProject, @owner, @createdAt)`).run(sanitizeRow(item)); stats.daily_tags++; } catch (e) { stats.errors.push(`tag ${item.id}: ${e.message}`); }
      });
      // Settings
      if (data.settings && typeof data.settings === 'object') {
        Object.entries(data.settings).forEach(([key, value]) => {
          try { insertSetting.run({ key, value: typeof value === 'string' ? value : JSON.stringify(value) }); stats.settings++; } catch (e) { stats.errors.push(`setting ${key}: ${e.message}`); }
        });
      }
    });

    transaction();
    res.json({ success: true, data: stats });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ---------- Excel Export ----------
app.get('/api/export/excel', (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('项目进度跟踪表');

    // Fetch data
    const projects = db.prepare('SELECT * FROM projects').all();
    const progress = db.prepare('SELECT * FROM progress ORDER BY projectId ASC, date ASC').all();

    // Numeric sort helper: extract leading number from "1. xxx" or "1.1 xxx"
    const numPrefix = (name) => {
      const m = (name || '').match(/^(\d+(\.\d+)?)/);
      return m ? parseFloat(m[1]) : Infinity;
    };
    const byNumPrefix = (a, b) => numPrefix(a.name) - numPrefix(b.name);

    // Group projects by parent (parentId is null = main project)
    const mainProjects = projects.filter(p => !p.parentId).sort(byNumPrefix);
    const subProjectsByParent = {};
    projects.filter(p => p.parentId).forEach(p => {
      if (!subProjectsByParent[p.parentId]) subProjectsByParent[p.parentId] = [];
      subProjectsByParent[p.parentId].push(p);
    });
    // Sort sub-projects by numeric prefix within each parent
    for (const key of Object.keys(subProjectsByParent)) {
      subProjectsByParent[key].sort(byNumPrefix);
    }

    // Group progress by projectId
    const progressByProject = {};
    progress.forEach(p => {
      if (!progressByProject[p.projectId]) progressByProject[p.projectId] = [];
      progressByProject[p.projectId].push(p);
    });

    // Styles
    const headerFont = { bold: true, size: 11 };
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    const thinBorder = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    const mainProjFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4FD' } };

    // Columns (initial widths, will auto-fit below)
    sheet.columns = [
      { header: '主项目', key: 'mainProject', width: 18 },
      { header: '子项目', key: 'subProject', width: 35 },
      { header: '开始日期', key: 'startDate', width: 12 },
      { header: '结束日期', key: 'endDate', width: 12 },
      { header: '责任人', key: 'owner', width: 10 },
      { header: '协作人', key: 'collaborators', width: 18 },
      { header: '项目状态', key: 'status', width: 10 },
      { header: '日别进度', key: 'dailyProgress', width: 80 },
    ];

    // Apply header style
    const headerRow = sheet.getRow(1);
    headerRow.font = headerFont;
    headerRow.fill = headerFill;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.eachCell(cell => { cell.border = thinBorder; });

    let rowIdx = 2;
    mainProjects.forEach(main => {
      const subs = subProjectsByParent[main.id] || [];
      const startRow = rowIdx;
      const endRow = rowIdx + Math.max(subs.length, 1) - 1;

      subs.forEach((sub, i) => {
        const row = sheet.getRow(rowIdx);
        row.getCell(2).value = sub.name || sub.desc || '';
        // Parse dates
        if (sub.startDate) {
          try {
            const d = new Date(sub.startDate);
            row.getCell(3).value = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
          } catch(e) { row.getCell(3).value = sub.startDate; }
        }
        if (sub.endDate) {
          try {
            const d = new Date(sub.endDate);
            row.getCell(4).value = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
          } catch(e) { row.getCell(4).value = sub.endDate; }
        }
        row.getCell(5).value = sub.owner || '';
        // Parse collaborators from JSON string if needed
        let collab = sub.collaborators || '';
        if (typeof collab === 'string' && collab.startsWith('[')) {
          try { collab = JSON.parse(collab).join(', '); } catch(e) {}
        }
        row.getCell(6).value = collab;
        row.getCell(7).value = sub.status || '';

        // Build daily progress text with today highlighted in blue
        const progs = progressByProject[sub.id] || [];
        if (progs.length > 0) {
          const todayStr = new Date().toISOString().slice(0, 10);
          const richText = { richText: [] };
          progs.forEach((p, pi) => {
            let dateStr = '';
            let isToday = false;
            if (p.date) {
              try {
                const d = new Date(p.date);
                dateStr = `${d.getMonth()+1}-${d.getDate()}`;
                isToday = p.date.slice(0, 10) === todayStr;
              } catch(e) { dateStr = p.date; }
            }
            const content = p.content || p.plan || '';
            const part = `${dateStr} ${content}`;
            richText.richText.push({
              text: part + (pi < progs.length - 1 ? '\n' : ''),
              font: isToday ? { bold: true, color: { argb: 'FF0000FF' } } : {}
            });
          });
          row.getCell(8).value = richText;
        }

        // Apply borders
        row.eachCell({ includeEmpty: true }, cell => { cell.border = thinBorder; });
        row.alignment = { vertical: 'top', wrapText: true };
        rowIdx++;
      });

      // If no sub-projects, add an empty row for the main project
      if (subs.length === 0) {
        const row = sheet.getRow(rowIdx);
        row.eachCell({ includeEmpty: true }, cell => { cell.border = thinBorder; });
        rowIdx++;
      }

      // Merge main project column
      if (endRow >= startRow) {
        sheet.mergeCells(startRow, 1, endRow, 1);
        const mainCell = sheet.getCell(startRow, 1);
        mainCell.value = main.name || main.desc || '';
        mainCell.font = { bold: true, size: 11 };
        mainCell.fill = mainProjFill;
        mainCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        mainCell.border = thinBorder;
      }
    });

    // Auto-fit row heights based on content
    for (let r = 2; r < rowIdx; r++) {
      const row = sheet.getRow(r);
      // Count newlines in daily progress (col 8) to estimate height
      const val = row.getCell(8).value;
      let lineCount = 1;
      if (val != null) {
        const text = typeof val === 'object' && val.richText
          ? val.richText.map(r => r.text).join('')
          : String(val);
        lineCount = text.split('\n').length;
      }
      // Each line ~15pt, min 18pt, max 500pt
      row.height = Math.min(Math.max(lineCount * 15 + 4, 18), 500);
    }

    // Auto-fit column widths
    sheet.columns.forEach((col, i) => {
      let maxLen = 0;
      // Check header
      const headerLen = (col.header || '').toString().length;
      if (headerLen > maxLen) maxLen = headerLen;
      // Check all data rows
      for (let r = 2; r <= rowIdx; r++) {
        const val = sheet.getRow(r).getCell(i + 1).value;
        if (val != null) {
          // For multiline content, use longest line
          const lines = String(val).split('\n');
          const longestLine = Math.max(...lines.map(l => l.length));
          if (longestLine > maxLen) maxLen = longestLine;
        }
      }
      // CJK characters are wider, account for that
      const cjkCount = (String(col.header || '') + ' ').split('').filter(c => /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(c)).length;
      // Last column (日别进度) max 200pt, others max 60pt
      const maxW = i === 7 ? 200 : 60;
      col.width = Math.min(Math.max(maxLen + 2 + Math.floor(cjkCount * 0.5), 8), maxW);
    });

    // Set buffer and send
    workbook.xlsx.writeBuffer().then(buffer => {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=project-pulse-${new Date().toISOString().slice(0,10)}.xlsx`);
      res.send(buffer);
    });
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve frontend static files (production)
const DIST_PATH = process.env.DIST_PATH || path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  // SPA fallback - must be before 404 handler
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Project Pulse API listening on port ${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  if (fs.existsSync(DIST_PATH)) console.log(`Serving frontend from: ${DIST_PATH}`);
});
