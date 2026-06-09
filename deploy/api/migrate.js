/**
 * Data migration script: reads old JSON/KV export and writes to SQLite.
 * Usage: node migrate.js <path-to-export.json>
 * Or pipe JSON: cat export.json | node migrate.js
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'project-pulse.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

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

function readInput() {
  const filePath = process.argv[2];
  if (filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  let data = '';
  const fd = process.stdin.fd;
  try {
    const buf = fs.readFileSync(fd, 'utf-8');
    if (buf && buf.trim()) return JSON.parse(buf);
  } catch {}
  // fallback empty
  return {};
}

const input = readInput();
const now = () => new Date().toISOString();

function runInsert(table, columns, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const cols = columns.join(', ');
  const placeholders = columns.map(c => `@${c}`).join(', ');
  const updates = columns.filter(c => c !== 'id' && c !== 'createdAt').map(c => `${c}=excluded.${c}`).join(', ');
  const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
  const stmt = db.prepare(sql);
  const tx = db.transaction((data) => {
    for (const r of data) stmt.run(r);
  });
  tx(rows);
  return rows.length;
}

// Migrate projects
if (input.projects) {
  const rows = input.projects.map(p => ({
    id: p.id || String(Math.random()).slice(2),
    userId: p.userId || null,
    parentId: p.parentId || null,
    name: p.name || '',
    desc: p.desc || p.description || null,
    owner: p.owner || null,
    color: p.color || null,
    priority: p.priority || null,
    status: p.status || null,
    startDate: p.startDate || null,
    endDate: p.endDate || null,
    collaborators: typeof p.collaborators === 'object' ? JSON.stringify(p.collaborators) : p.collaborators || null,
    notes: p.notes || null,
    createdAt: p.createdAt || now(),
    updatedAt: p.updatedAt || now()
  }));
  const n = runInsert('projects', [
    'id','userId','parentId','name','desc','owner','color','priority','status','startDate','endDate','collaborators','notes','createdAt','updatedAt'
  ], rows);
  console.log(`Migrated ${n} projects`);
}

// Migrate progress
if (input.progress) {
  const rows = input.progress.map(p => ({
    id: p.id || String(Math.random()).slice(2),
    userId: p.userId || null,
    projectId: p.projectId || '',
    date: p.date || '',
    percent: typeof p.percent === 'number' ? p.percent : 0,
    status: p.status || 'normal',
    content: p.content || null,
    plan: p.plan || null,
    attachments: typeof p.attachments === 'object' ? JSON.stringify(p.attachments) : p.attachments || null,
    createdAt: p.createdAt || now(),
    updatedAt: p.updatedAt || now()
  }));
  const n = runInsert('progress', [
    'id','userId','projectId','date','percent','status','content','plan','attachments','createdAt','updatedAt'
  ], rows);
  console.log(`Migrated ${n} progress entries`);
}

// Migrate users
if (input.users) {
  const rows = input.users.map(u => ({
    id: u.id || String(Math.random()).slice(2),
    name: u.name || '',
    role: u.role || null,
    color: u.color || null,
    createdAt: u.createdAt || now()
  }));
  const n = runInsert('users', ['id','name','role','color','createdAt'], rows);
  console.log(`Migrated ${n} users`);
}

// Migrate reports
if (input.reports) {
  const rows = input.reports.map(r => ({
    id: r.id || String(Math.random()).slice(2),
    userId: r.userId || null,
    type: r.type || null,
    date: r.date || null,
    entryCount: typeof r.entryCount === 'number' ? r.entryCount : null,
    generatedAt: r.generatedAt || now()
  }));
  const n = runInsert('reports', ['id','userId','type','date','entryCount','generatedAt'], rows);
  console.log(`Migrated ${n} reports`);
}

// Migrate daily_tags
if (input.daily_tags || input.dailyTags) {
  const src = input.daily_tags || input.dailyTags || [];
  const rows = src.map(d => ({
    id: d.id || String(Math.random()).slice(2),
    userId: d.userId || null,
    date: d.date || null,
    tag: d.tag || null,
    content: d.content || null,
    majorProject: d.majorProject || null,
    subProject: d.subProject || null,
    owner: d.owner || null,
    createdAt: d.createdAt || now()
  }));
  const n = runInsert('daily_tags', ['id','userId','date','tag','content','majorProject','subProject','owner','createdAt'], rows);
  console.log(`Migrated ${n} daily tags`);
}

// Migrate settings
if (input.settings) {
  const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  const tx = db.transaction((obj) => {
    for (const [k, v] of Object.entries(obj)) {
      stmt.run(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  });
  tx(input.settings);
  console.log(`Migrated ${Object.keys(input.settings).length} settings`);
}

console.log('Migration complete.');
