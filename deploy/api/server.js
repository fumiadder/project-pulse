const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
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
  `);
}

initDb();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper: now ISO string
const now = () => new Date().toISOString();

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
      insert.run(r);
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
      insert.run(r);
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
    INSERT INTO users (id, name, role, color, createdAt)
    VALUES (@id, @name, @role, @color, @createdAt)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      role=excluded.role,
      color=excluded.color
  `);
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      if (!r.id) r.id = uuidv4();
      if (!r.createdAt) r.createdAt = now();
      insert.run(r);
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
      insert.run(r);
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
      insert.run(r);
    }
  });
  tx(items);
  res.json({ success: true, data: items });
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
    const tx = db.transaction((rows) => { for (const r of rows) stmt.run(r); });
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
    const tx = db.transaction((rows) => { for (const r of rows) stmt.run(r); });
    tx(prArr);
  }
  if (uArr && Array.isArray(uArr)) {
    const stmt = db.prepare(`
      INSERT INTO users (id, name, role, color, createdAt)
      VALUES (@id, @name, @role, @color, @createdAt)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, role=excluded.role, color=excluded.color
    `);
    const tx = db.transaction((rows) => { for (const r of rows) stmt.run(r); });
    tx(uArr);
  }
  if (rArr && Array.isArray(rArr)) {
    const stmt = db.prepare(`
      INSERT INTO reports (id, userId, type, date, entryCount, generatedAt)
      VALUES (@id, @userId, @type, @date, @entryCount, @generatedAt)
      ON CONFLICT(id) DO UPDATE SET userId=excluded.userId, type=excluded.type, date=excluded.date, entryCount=excluded.entryCount, generatedAt=excluded.generatedAt
    `);
    const tx = db.transaction((rows) => { for (const r of rows) stmt.run(r); });
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
    const tx = db.transaction((rows) => { for (const r of rows) stmt.run(r); });
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message });
});

// Serve frontend static files (production)
const DIST_PATH = process.env.DIST_PATH || path.join(__dirname, '..', 'dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Project Pulse API listening on port ${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  if (fs.existsSync(DIST_PATH)) console.log(`Serving frontend from: ${DIST_PATH}`);
});
