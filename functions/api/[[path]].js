// /functions/api/[[path]].js - Catch-all API handler for Cloudflare Pages
// Structured KV storage with per-item keys, validation, atomic ops, safe sync

const API_BASE = 'pp';

// ─── Store definitions & validators ───────────────────────────────────────────

const STORES = ['projects', 'progress', 'users', 'reports', 'dailyTags', 'ideas'];

const VALIDATORS = {
  projects(item) {
    if (!item || typeof item !== 'object') return 'Item must be an object';
    if (!item.id || typeof item.id !== 'string') return 'Missing or invalid "id" (string required)';
    if (!item.name || typeof item.name !== 'string') return 'Missing or invalid "name" (string required)';
    if (!item.owner || typeof item.owner !== 'string') return 'Missing or invalid "owner" (string required)';
    return null;
  },
  progress(item) {
    if (!item || typeof item !== 'object') return 'Item must be an object';
    if (!item.id || typeof item.id !== 'string') return 'Missing or invalid "id" (string required)';
    if (!item.projectId || typeof item.projectId !== 'string') return 'Missing or invalid "projectId" (string required)';
    if (!item.date || typeof item.date !== 'string') return 'Missing or invalid "date" (string required)';
    if (item.percent === undefined || typeof item.percent !== 'number') return 'Missing or invalid "percent" (number required)';
    if (!item.content || typeof item.content !== 'string') return 'Missing or invalid "content" (string required)';
    return null;
  },
  users(item) {
    if (!item || typeof item !== 'object') return 'Item must be an object';
    if (!item.id || typeof item.id !== 'string') return 'Missing or invalid "id" (string required)';
    if (!item.name || typeof item.name !== 'string') return 'Missing or invalid "name" (string required)';
    if (!item.role || typeof item.role !== 'string') return 'Missing or invalid "role" (string required)';
    return null;
  },
  reports(item) {
    if (!item || typeof item !== 'object') return 'Item must be an object';
    if (!item.id || typeof item.id !== 'string') return 'Missing or invalid "id" (string required)';
    return null;
  },
  dailyTags(item) {
    if (!item || typeof item !== 'object') return 'Item must be an object';
    if (!item.id || typeof item.id !== 'string') return 'Missing or invalid "id" (string required)';
    return null;
  },
  ideas(item) {
    if (!item || typeof item !== 'object') return 'Item must be an object';
    if (!item.id || typeof item.id !== 'string') return 'Missing or invalid "id" (string required)';
    if (!item.userId || typeof item.userId !== 'string') return 'Missing or invalid "userId" (string required)';
    if (!item.title || typeof item.title !== 'string') return 'Missing or invalid "title" (string required)';
    return null;
  },
};

// ─── KV key helpers ─────────────────────────────────────────────────────────

function indexKey(store)    { return `${API_BASE}:${store}:_index`; }
function itemKey(store, id) { return `${API_BASE}:${store}:${id}`; }
function settingKey(key)    { return `${API_BASE}:setting:${key}`; }
function versionKey(store)  { return `${API_BASE}:${store}:_version`; }
function backupKey(ts)      { return `${API_BASE}:_backup:${ts}`; }

// ─── CORS & JSON helpers ────────────────────────────────────────────────────

function jres(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function corsRes(response) {
  const h = new Headers(response.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  h.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

// ─── Index operations (list of IDs) ──────────────────────────────────────────

async function getIndex(env, store) {
  const raw = await env.DB.get(indexKey(store));
  return raw ? JSON.parse(raw) : [];
}

async function putIndex(env, store, ids) {
  await env.DB.put(indexKey(store), JSON.stringify(ids));
}

// ─── Version counter ─────────────────────────────────────────────────────────

async function getVersion(env, store) {
  const raw = await env.DB.get(versionKey(store));
  return raw ? parseInt(raw, 10) : 0;
}

async function incrementVersion(env, store) {
  const v = (await getVersion(env, store)) + 1;
  await env.DB.put(versionKey(store), String(v));
  return v;
}

// ─── Validate item ──────────────────────────────────────────────────────────

function validateItem(store, item) {
  const validator = VALIDATORS[store];
  if (!validator) return null; // unknown store, skip validation
  return validator(item);
}

// ─── Core CRUD (per-item KV) ───────────────────────────────────────────────

async function listStore(env, store, url) {
  const ids = await getIndex(env, store);
  if (ids.length === 0) return jres({ [store]: [] });

  // Batch get items - KV list then individual gets
  const items = [];
  for (const id of ids) {
    const raw = await env.DB.get(itemKey(store, id));
    if (raw) {
      try {
        items.push(JSON.parse(raw));
      } catch {
        // corrupted item, skip
      }
    }
  }

  // Apply query filters (backward compatible)
  let filtered = items;
  for (const [k, v] of url.searchParams.entries()) {
    filtered = filtered.filter(item => String(item[k]) === v);
  }

  return jres({ [store]: filtered });
}

async function getItem(env, store, id) {
  const raw = await env.DB.get(itemKey(store, id));
  if (!raw) return jres({ error: 'Not found', id }, 404);
  try {
    return jres(JSON.parse(raw));
  } catch {
    return jres({ error: 'Corrupted data', id }, 500);
  }
}

async function putItem(env, store, body) {
  if (!body || !body.id) {
    return jres({ error: 'Item must have an "id" field' }, 400);
  }

  // Validate
  const validationError = validateItem(store, body);
  if (validationError) {
    return jres({ error: `Validation failed: ${validationError}`, store, id: body.id }, 400);
  }

  // Check value size (KV limit is 25MB, warn at 20MB)
  const serialized = JSON.stringify(body);
  if (serialized.length > 20 * 1024 * 1024) {
    return jres({ error: 'Item too large (>20MB), exceeds safe KV value size', id: body.id, size: serialized.length }, 413);
  }

  // Atomic write: write item first, then update index
  await env.DB.put(itemKey(store, body.id), serialized);
  const ids = await getIndex(env, store);
  if (!ids.includes(body.id)) {
    ids.push(body.id);
    await putIndex(env, store, ids);
  }
  await incrementVersion(env, store);

  return jres({ id: body.id, saved: true });
}

async function deleteItem(env, store, id) {
  const ids = await getIndex(env, store);
  const idx = ids.indexOf(id);
  if (idx === -1) return jres({ error: 'Not found', id }, 404);

  // Atomic delete: remove from index first, then delete item
  ids.splice(idx, 1);
  await putIndex(env, store, ids);
  await env.DB.delete(itemKey(store, id));
  await incrementVersion(env, store);

  return jres({ id, deleted: true });
}

// ─── Settings (unchanged pattern - already per-key) ──────────────────────────

async function getSetting(env, key) {
  const val = await env.DB.get(settingKey(key));
  return val !== null ? jres({ key, value: val }) : jres({ key, value: null });
}

async function putSetting(env, key, body) {
  await env.DB.put(settingKey(key), String(body.value ?? ''));
  return jres({ key, value: body.value, saved: true });
}

// ─── Health check ────────────────────────────────────────────────────────────

async function healthCheck(env) {
  return jres({ status: 'ok', service: 'Project Pulse API', storage: 'KV (structured)', ts: new Date().toISOString() });
}

// ─── Full sync (safe upsert per item) ────────────────────────────────────────

async function fullSyncGet(env) {
  const [projects, progress, users, reports, dailyTags, ideas] = await Promise.all([
    loadAllItems(env, 'projects'),
    loadAllItems(env, 'progress'),
    loadAllItems(env, 'users'),
    loadAllItems(env, 'reports'),
    loadAllItems(env, 'dailyTags'),
    loadAllItems(env, 'ideas'),
  ]);

  const settingsList = await env.DB.list({ prefix: `${API_BASE}:setting:` });
  const settings = {};
  for (const key of settingsList.keys) {
    const k = key.name.replace(`${API_BASE}:setting:`, '');
    settings[k] = await env.DB.get(key.name);
  }

  // Include versions for conflict detection
  const versions = {};
  for (const store of STORES) {
    versions[store] = await getVersion(env, store);
  }

  return jres({
    projects, progress, users, reports, daily_tags: dailyTags, ideas,
    settings, versions, syncedAt: new Date().toISOString(),
  });
}

async function loadAllItems(env, store) {
  const ids = await getIndex(env, store);
  const items = [];
  for (const id of ids) {
    const raw = await env.DB.get(itemKey(store, id));
    if (raw) {
      try { items.push(JSON.parse(raw)); } catch { /* skip corrupted */ }
    }
  }
  return items;
}

async function fullSyncPost(env, body) {
  const storeMap = {
    projects: body.projects || [],
    progress: body.progress || [],
    users: body.users || [],
    reports: body.reports || [],
    dailyTags: body.daily_tags || [],
    ideas: body.ideas || [],
  };

  const counts = {};
  const conflicts = {};

  for (const [store, incomingItems] of Object.entries(storeMap)) {
    const serverVersion = await getVersion(env, store);
    const clientVersion = body.versions ? (body.versions[store] || 0) : 0;

    // Conflict detection: if client version is older than server, log potential conflict
    if (clientVersion > 0 && clientVersion < serverVersion) {
      conflicts[store] = { clientVersion, serverVersion, action: 'merge_applied' };
    }

    // Upsert each item individually (safe merge, not destructive overwrite)
    let upserted = 0;
    const ids = await getIndex(env, store);

    for (const item of incomingItems) {
      if (!item || !item.id) continue;

      // Validate
      const validationError = validateItem(store, item);
      if (validationError) continue; // skip invalid items

      const serialized = JSON.stringify(item);
      if (serialized.length > 20 * 1024 * 1024) continue; // skip oversized

      // Write item
      await env.DB.put(itemKey(store, item.id), serialized);

      // Update index if new
      if (!ids.includes(item.id)) {
        ids.push(item.id);
      }
      upserted++;
    }

    // Save updated index
    await putIndex(env, store, ids);
    await incrementVersion(env, store);
    counts[store] = upserted;
  }

  // Settings
  const settings = body.settings || {};
  for (const [k, v] of Object.entries(settings)) {
    await env.DB.put(settingKey(k), String(v));
  }

  const result = { synced: true, syncedAt: new Date().toISOString(), counts };
  if (Object.keys(conflicts).length > 0) {
    result.conflicts = conflicts;
  }
  return jres(result);
}

// ─── Stats endpoint ─────────────────────────────────────────────────────────

async function getStats(env) {
  const stats = {};
  for (const store of STORES) {
    const ids = await getIndex(env, store);
    stats[store] = {
      count: ids.length,
      version: await getVersion(env, store),
    };
  }

  // Settings count
  const settingsList = await env.DB.list({ prefix: `${API_BASE}:setting:` });
  stats.settings = { count: settingsList.keys.length };

  return jres({ stats, ts: new Date().toISOString() });
}

// ─── Backup endpoint ─────────────────────────────────────────────────────────

async function createBackup(env) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = {};

  for (const store of STORES) {
    backup[store] = await loadAllItems(env, store);
  }

  // Settings
  const settingsList = await env.DB.list({ prefix: `${API_BASE}:setting:` });
  backup.settings = {};
  for (const key of settingsList.keys) {
    const k = key.name.replace(`${API_BASE}:setting:`, '');
    backup.settings[k] = await env.DB.get(key.name);
  }

  // Versions
  backup.versions = {};
  for (const store of STORES) {
    backup.versions[store] = await getVersion(env, store);
  }

  const serialized = JSON.stringify(backup);

  // Check size
  if (serialized.length > 20 * 1024 * 1024) {
    return jres({ error: 'Backup too large to store in KV', size: serialized.length }, 413);
  }

  await env.DB.put(backupKey(ts), serialized, {
    expirationTtl: 30 * 24 * 60 * 60, // 30 days auto-expire
  });

  return jres({
    backup: true,
    backupId: ts,
    size: serialized.length,
    stores: Object.fromEntries(STORES.map(s => [s, backup[s].length])),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ts: new Date().toISOString(),
  });
}

// ─── Debug endpoint ──────────────────────────────────────────────────────────

async function getDebug(env) {
  const debug = { keys: {}, totalSize: 0 };

  for (const store of STORES) {
    const idxRaw = await env.DB.get(indexKey(store));
    const idxSize = idxRaw ? idxRaw.length : 0;
    const ids = idxRaw ? JSON.parse(idxRaw) : [];

    let storeSize = idxSize;
    const itemCount = ids.length;

    // Sample up to 10 items to estimate size
    let sampledSize = 0;
    let sampledCount = 0;
    const sampleIds = ids.slice(0, 10);
    for (const id of sampleIds) {
      const raw = await env.DB.get(itemKey(store, id));
      if (raw) {
        sampledSize += raw.length;
        sampledCount++;
      }
    }

    // Estimate total store size
    const estimatedSize = sampledCount > 0
      ? Math.round((sampledSize / sampledCount) * itemCount) + idxSize
      : idxSize;

    debug.keys[store] = {
      indexSize: idxSize,
      itemCount,
      estimatedTotalSize: estimatedSize,
      version: await getVersion(env, store),
    };
    debug.totalSize += estimatedSize;
  }

  // Settings
  const settingsList = await env.DB.list({ prefix: `${API_BASE}:setting:` });
  debug.keys.settings = { count: settingsList.keys.length };

  // Backups
  const backupList = await env.DB.list({ prefix: `${API_BASE}:_backup:` });
  debug.keys.backups = { count: backupList.keys.length };

  // Check for old-format keys (migration indicator)
  const oldFormatKeys = [];
  for (const store of STORES) {
    const oldKey = `${API_BASE}:${store}`;
    const val = await env.DB.get(oldKey);
    if (val) {
      oldFormatKeys.push(oldKey);
    }
  }
  debug.oldFormatKeys = oldFormatKeys;
  debug.needsMigration = oldFormatKeys.length > 0;

  debug.ts = new Date().toISOString();
  return jres(debug);
}

// ─── Migration endpoint ─────────────────────────────────────────────────────

async function migrateFromOldFormat(env) {
  const results = {};
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const store of STORES) {
    const oldK = `${API_BASE}:${store}`;
    const raw = await env.DB.get(oldK);

    if (!raw) {
      results[store] = { status: 'skipped', reason: 'No old-format data found' };
      continue;
    }

    let items;
    try {
      items = JSON.parse(raw);
    } catch {
      results[store] = { status: 'error', reason: 'Failed to parse old data' };
      totalErrors++;
      continue;
    }

    if (!Array.isArray(items)) {
      results[store] = { status: 'error', reason: 'Old data is not an array' };
      totalErrors++;
      continue;
    }

    // Check if already migrated
    const existingIds = await getIndex(env, store);
    if (existingIds.length > 0) {
      results[store] = { status: 'skipped', reason: 'Index already exists (may already be migrated)', existingCount: existingIds.length };
      continue;
    }

    const ids = [];
    let migrated = 0;
    let skipped = 0;

    for (const item of items) {
      if (!item || !item.id) {
        skipped++;
        continue;
      }

      // Validate
      const validationError = validateItem(store, item);
      if (validationError) {
        skipped++;
        continue;
      }

      const serialized = JSON.stringify(item);
      if (serialized.length > 20 * 1024 * 1024) {
        skipped++;
        continue;
      }

      await env.DB.put(itemKey(store, item.id), serialized);
      ids.push(item.id);
      migrated++;
    }

    // Write index
    await putIndex(env, store, ids);
    await incrementVersion(env, store);

    // Do NOT delete old key yet - keep as backup until confirmed
    results[store] = {
      status: 'migrated',
      totalItems: items.length,
      migrated,
      skipped,
    };
    totalMigrated += migrated;
    totalSkipped += skipped;
  }

  // Verify migration integrity
  const verification = {};
  for (const store of STORES) {
    if (results[store].status === 'migrated') {
      const ids = await getIndex(env, store);
      let verified = 0;
      for (const id of ids) {
        const val = await env.DB.get(itemKey(store, id));
        if (val) verified++;
      }
      verification[store] = { indexCount: ids.length, verifiedItems: verified, intact: ids.length === verified };
    }
  }

  return jres({
    migration: 'complete',
    totalMigrated,
    totalSkipped,
    totalErrors,
    results,
    verification,
    note: 'Old-format keys preserved as backup. Use DELETE /api/migrate to clean up after verification.',
    ts: new Date().toISOString(),
  });
}

// ─── Land Idea ───────────────────────────────────────────────────────────────

async function landIdea(env, ideaId, projectData) {
  const ideaRaw = await env.DB.get(itemKey('ideas', ideaId));
  if (!ideaRaw) return jres({ error: 'Idea not found' }, 404);
  const idea = JSON.parse(ideaRaw);

  const now = new Date().toISOString();
  const newProject = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: idea.userId,
    parentId: projectData.parentId ?? null,
    name: projectData.name || idea.title,
    desc: projectData.desc || idea.content,
    owner: projectData.owner || '',
    color: projectData.color || '#00d4ff',
    priority: projectData.priority || '中',
    status: '未开始',
    startDate: projectData.startDate || '',
    endDate: projectData.endDate || '',
    collaborators: '',
    notes: `源自想法: ${idea.title}`,
    createdAt: now,
    updatedAt: now,
  };

  // 保存新项目到 KV
  await env.DB.put(itemKey('projects', newProject.id), JSON.stringify(newProject));
  const projectIds = await getIndex(env, 'projects');
  if (!projectIds.includes(newProject.id)) {
    projectIds.push(newProject.id);
    await putIndex(env, 'projects', projectIds);
  }
  await incrementVersion(env, 'projects');

  // 更新 idea 状态
  idea.status = 'landed';
  idea.landedProjectId = newProject.id;
  idea.updatedAt = now;
  await env.DB.put(itemKey('ideas', idea.id), JSON.stringify(idea));

  return jres({ projectId: newProject.id });
}

// ─── AI Summary ──────────────────────────────────────────────────────────────

async function generateAiSummary(env, { type, entries, projects, style }) {
  // 从 settings 读取 AI 配置
  const apiKey = await env.DB.get(settingKey('ai_api_key'));
  const apiUrl = await env.DB.get(settingKey('ai_api_url')) || 'https://api.openai.com/v1/chat/completions';
  const model = await env.DB.get(settingKey('ai_model')) || 'gpt-4o-mini';

  if (!apiKey) {
    return jres({ error: '未配置 AI API Key，请在设置中配置' }, 400);
  }

  // 构建提示词
  const typeLabel = type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '月报';

  let systemPrompt = `你是一位专业的项目进度分析助手。请根据提供的项目进度数据，生成一份简洁、专业的${typeLabel}总结。`;

  if (style && style.trim()) {
    systemPrompt += `\n\n【总结风格要求】\n${style}`;
  } else {
    systemPrompt += `\n\n总结要求：
1. 概述整体项目进展态势
2. 列出重点项目的状态和进展
3. 指出存在的风险和问题
4. 给出下一步计划建议
5. 语言简洁专业，适合汇报使用`;
  }

  const userPrompt = `请根据以下数据生成${typeLabel}总结：

【项目信息】
${JSON.stringify(projects, null, 2)}

【进度记录】
${JSON.stringify(entries, null, 2)}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return jres({ error: `AI API 调用失败: ${error}` }, 502);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || '生成失败，请重试';

    return jres({ summary, model });
  } catch (err) {
    return jres({ error: `AI 服务异常: ${err.message}` }, 500);
  }
}

// ─── Cleanup old format keys after migration ─────────────────────────────────

async function cleanupOldFormat(env) {
  const deleted = [];
  const errors = [];

  for (const store of STORES) {
    const oldK = `${API_BASE}:${store}`;
    try {
      const val = await env.DB.get(oldK);
      if (val) {
        await env.DB.delete(oldK);
        deleted.push(oldK);
      }
    } catch (e) {
      errors.push({ key: oldK, error: e.message });
    }
  }

  return jres({
    cleanup: true,
    deleted,
    errors,
    ts: new Date().toISOString(),
  });
}

// ─── Router ──────────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') {
    return corsRes(new Response(null, { status: 204 }));
  }

  try {
    let res;

    // ── Health & system endpoints ──
    if (path === '/api/health' && method === 'GET') {
      res = await healthCheck(env);
    }
    else if (path === '/api/stats' && method === 'GET') {
      res = await getStats(env);
    }
    else if (path === '/api/debug' && method === 'GET') {
      res = await getDebug(env);
    }
    else if (path === '/api/backup' && method === 'POST') {
      res = await createBackup(env);
    }
    else if (path === '/api/migrate' && method === 'POST') {
      res = await migrateFromOldFormat(env);
    }
    else if (path === '/api/migrate' && method === 'DELETE') {
      res = await cleanupOldFormat(env);
    }

    // ── Full sync ──
    else if (path === '/api/sync/full' && method === 'GET') {
      res = await fullSyncGet(env);
    }
    else if (path === '/api/sync/full' && method === 'POST') {
      res = await fullSyncPost(env, await request.json());
    }

    // ── Projects ──
    else if (path === '/api/projects' && method === 'GET') {
      res = await listStore(env, 'projects', url);
    }
    else if (path === '/api/projects' && method === 'PUT') {
      res = await putItem(env, 'projects', await request.json());
    }
    else if (path.match(/^\/api\/projects\/.+$/) && method === 'GET') {
      res = await getItem(env, 'projects', path.split('/').pop());
    }
    else if (path.match(/^\/api\/projects\/.+$/) && method === 'DELETE') {
      res = await deleteItem(env, 'projects', path.split('/').pop());
    }

    // ── Progress ──
    else if (path === '/api/progress' && method === 'GET') {
      res = await listStore(env, 'progress', url);
    }
    else if (path === '/api/progress' && method === 'PUT') {
      res = await putItem(env, 'progress', await request.json());
    }
    else if (path.match(/^\/api\/progress\/.+$/) && method === 'GET') {
      res = await getItem(env, 'progress', path.split('/').pop());
    }
    else if (path.match(/^\/api\/progress\/.+$/) && method === 'DELETE') {
      res = await deleteItem(env, 'progress', path.split('/').pop());
    }

    // ── Users ──
    else if (path === '/api/users' && method === 'GET') {
      res = await listStore(env, 'users', url);
    }
    else if (path === '/api/users' && method === 'PUT') {
      res = await putItem(env, 'users', await request.json());
    }
    else if (path.match(/^\/api\/users\/.+$/) && method === 'GET') {
      res = await getItem(env, 'users', path.split('/').pop());
    }
    else if (path.match(/^\/api\/users\/.+$/) && method === 'DELETE') {
      res = await deleteItem(env, 'users', path.split('/').pop());
    }

    // ── Reports ──
    else if (path === '/api/reports' && method === 'GET') {
      res = await listStore(env, 'reports', url);
    }
    else if (path === '/api/reports' && method === 'PUT') {
      res = await putItem(env, 'reports', await request.json());
    }
    else if (path.match(/^\/api\/reports\/.+$/) && method === 'DELETE') {
      res = await deleteItem(env, 'reports', path.split('/').pop());
    }

    // ── Daily Tags ──
    else if (path === '/api/daily_tags' && method === 'GET') {
      res = await listStore(env, 'dailyTags', url);
    }
    else if (path === '/api/daily_tags' && method === 'PUT') {
      res = await putItem(env, 'dailyTags', await request.json());
    }
    else if (path.match(/^\/api\/daily_tags\/.+$/) && method === 'DELETE') {
      res = await deleteItem(env, 'dailyTags', path.split('/').pop());
    }

    // ── Ideas ──
    else if (path === '/api/ideas' && method === 'GET') {
      res = await listStore(env, 'ideas', url);
    }
    else if (path === '/api/ideas' && method === 'PUT') {
      res = await putItem(env, 'ideas', await request.json());
    }
    else if (path.match(/^\/api\/ideas\/.+$/) && method === 'GET') {
      res = await getItem(env, 'ideas', path.split('/').pop());
    }
    else if (path.match(/^\/api\/ideas\/.+$/) && method === 'DELETE') {
      res = await deleteItem(env, 'ideas', path.split('/').pop());
    }
    else if (path.match(/^\/api\/ideas\/.+\/land$/) && method === 'POST') {
      res = await landIdea(env, path.split('/')[3], await request.json());
    }

    // ── Auth / Private Password ──
    else if (path === '/api/auth/private-password' && method === 'POST') {
      const { userId, password } = await request.json();
      const userRaw = await env.DB.get(itemKey('users', userId));
      if (!userRaw) {
        res = jres({ valid: false }, 404);
      } else {
        const user = JSON.parse(userRaw);
        res = jres({ valid: user.privatePassword === password });
      }
    }

    // ── AI Summary ──
    else if (path === '/api/ai-summary' && method === 'POST') {
      res = await generateAiSummary(env, await request.json());
    }

    // ── Settings ──
    else if (path.match(/^\/api\/settings\/.+$/) && method === 'GET') {
      res = await getSetting(env, path.split('/').pop());
    }
    else if (path.match(/^\/api\/settings\/.+$/) && method === 'PUT') {
      res = await putSetting(env, path.split('/').pop(), await request.json());
    }

    // ── 404 ──
    else {
      res = jres({ error: 'Not Found', path }, 404);
    }

    return corsRes(res);
  } catch (err) {
    return corsRes(jres({ error: err.message, stack: err.stack }, 500));
  }
}
