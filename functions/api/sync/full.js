// /functions/api/sync/full.js - Full sync endpoint (structured KV)
// This file is a dedicated route handler for /api/sync/full
// Note: The catch-all [[path]].js also handles /api/sync/full with the same logic.
// This file exists for explicit route matching priority in Cloudflare Pages Functions.

const API_BASE = 'pp';
const STORES = ['projects', 'progress', 'users', 'reports', 'dailyTags'];

const VALIDATORS = {
  projects(item) {
    if (!item || typeof item !== 'object') return 'Item must be an object';
    if (!item.id || typeof item.id !== 'string') return 'Missing or invalid "id"';
    if (!item.name || typeof item.name !== 'string') return 'Missing or invalid "name"';
    if (!item.owner || typeof item.owner !== 'string') return 'Missing or invalid "owner"';
    return null;
  },
  progress(item) {
    if (!item || typeof item !== 'object') return 'Item must be an object';
    if (!item.id || typeof item.id !== 'string') return 'Missing or invalid "id"';
    if (!item.projectId || typeof item.projectId !== 'string') return 'Missing or invalid "projectId"';
    if (!item.date || typeof item.date !== 'string') return 'Missing or invalid "date"';
    if (item.percent === undefined || typeof item.percent !== 'number') return 'Missing or invalid "percent"';
    if (!item.content || typeof item.content !== 'string') return 'Missing or invalid "content"';
    return null;
  },
  users(item) {
    if (!item || typeof item !== 'object') return 'Item must be an object';
    if (!item.id || typeof item.id !== 'string') return 'Missing or invalid "id"';
    if (!item.name || typeof item.name !== 'string') return 'Missing or invalid "name"';
    if (!item.role || typeof item.role !== 'string') return 'Missing or invalid "role"';
    return null;
  },
  reports(item) {
    if (!item || typeof item !== 'object') return 'Item must be an object';
    if (!item.id || typeof item.id !== 'string') return 'Missing or invalid "id"';
    return null;
  },
  dailyTags(item) {
    if (!item || typeof item !== 'object') return 'Item must be an object';
    if (!item.id || typeof item.id !== 'string') return 'Missing or invalid "id"';
    return null;
  },
};

function indexKey(store)    { return `${API_BASE}:${store}:_index`; }
function itemKey(store, id) { return `${API_BASE}:${store}:${id}`; }
function settingKey(key)    { return `${API_BASE}:setting:${key}`; }
function versionKey(store)  { return `${API_BASE}:${store}:_version`; }

async function getIndex(env, store) {
  const raw = await env.DB.get(indexKey(store));
  return raw ? JSON.parse(raw) : [];
}
async function putIndex(env, store, ids) {
  await env.DB.put(indexKey(store), JSON.stringify(ids));
}
async function getVersion(env, store) {
  const raw = await env.DB.get(versionKey(store));
  return raw ? parseInt(raw, 10) : 0;
}
async function incrementVersion(env, store) {
  const v = (await getVersion(env, store)) + 1;
  await env.DB.put(versionKey(store), String(v));
  return v;
}
function validateItem(store, item) {
  const v = VALIDATORS[store];
  return v ? v(item) : null;
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

function jres(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
function corsRes(response) {
  const h = new Headers(response.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  h.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}

async function fullSyncGet(env) {
  const [projects, progress, users, reports, dailyTags] = await Promise.all([
    loadAllItems(env, 'projects'), loadAllItems(env, 'progress'), loadAllItems(env, 'users'),
    loadAllItems(env, 'reports'), loadAllItems(env, 'dailyTags'),
  ]);
  const settingsList = await env.DB.list({ prefix: `${API_BASE}:setting:` });
  const settings = {};
  for (const key of settingsList.keys) {
    settings[key.name.replace(`${API_BASE}:setting:`, '')] = await env.DB.get(key.name);
  }
  const versions = {};
  for (const store of STORES) {
    versions[store] = await getVersion(env, store);
  }
  return jres({ projects, progress, users, reports, daily_tags: dailyTags, settings, versions, syncedAt: new Date().toISOString() });
}

async function fullSyncPost(env, body) {
  const storeMap = {
    projects: body.projects || [], progress: body.progress || [],
    users: body.users || [], reports: body.reports || [],
    dailyTags: body.daily_tags || [],
  };
  const counts = {};
  const conflicts = {};

  for (const [store, incomingItems] of Object.entries(storeMap)) {
    const serverVersion = await getVersion(env, store);
    const clientVersion = body.versions ? (body.versions[store] || 0) : 0;
    if (clientVersion > 0 && clientVersion < serverVersion) {
      conflicts[store] = { clientVersion, serverVersion, action: 'merge_applied' };
    }
    let upserted = 0;
    const ids = await getIndex(env, store);
    for (const item of incomingItems) {
      if (!item || !item.id) continue;
      if (validateItem(store, item)) continue;
      const serialized = JSON.stringify(item);
      if (serialized.length > 20 * 1024 * 1024) continue;
      await env.DB.put(itemKey(store, item.id), serialized);
      if (!ids.includes(item.id)) ids.push(item.id);
      upserted++;
    }
    await putIndex(env, store, ids);
    await incrementVersion(env, store);
    counts[store] = upserted;
  }
  const settings = body.settings || {};
  for (const [k, v] of Object.entries(settings)) {
    await env.DB.put(settingKey(k), String(v));
  }
  const result = { synced: true, syncedAt: new Date().toISOString(), counts };
  if (Object.keys(conflicts).length > 0) result.conflicts = conflicts;
  return jres(result);
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  if (method === 'OPTIONS') return corsRes(new Response(null, { status: 204 }));
  try {
    if (method === 'GET') return corsRes(await fullSyncGet(env));
    if (method === 'PUT' || method === 'POST') return corsRes(await fullSyncPost(env, await request.json()));
    return corsRes(jres({ error: 'Method not allowed' }, 405));
  } catch (err) {
    return corsRes(jres({ error: err.message }, 500));
  }
}
