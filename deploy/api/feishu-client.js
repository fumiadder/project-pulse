/**
 * 飞书多维表格 API 客户端
 * 封装所有与飞书 Base API 的交互
 */

const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis';

// 飞书多维表格配置
const FEISHU_CONFIG = {
  baseToken: process.env.FEISHU_BASE_TOKEN || 'T2MfbUrH7aMmRSso8srcgby0nHb',
  tables: {
    todos: 'tblJK5Qq3cvRgDXN',       // 待办事项
    subtasks: 'tblInXP8cl9AjfeQ',    // 子任务
    projects: 'tblxpPkTm0bav6Pt',    // 项目
    settings: 'tblWbxUvo4vPFrwk',    // 设置
  }
};

// 默认凭证（环境变量不可用时的兜底）
const DEFAULT_CREDENTIALS = {
  appId: 'cli_aa2aa85de9b8dcc4',
  appSecret: 'oGHqb2zEgCFXNrEJ7TEsog0mi8NXl2Gq'
};

// Token 缓存
let tokenCache = { token: null, expiresAt: 0 };

// 运行时凭证缓存（从设置表加载后注入）
let runtimeCredentials = null;

/**
 * 注入运行时凭证（由 server.js 从设置表加载后调用）
 */
function setRuntimeCredentials(creds) {
  runtimeCredentials = creds;
  // 清除 token 缓存，强制重新获取
  tokenCache = { token: null, expiresAt: 0 };
}

/**
 * 获取飞书应用凭证
 * 优先级：运行时注入 > 环境变量 > 默认值
 */
function getCredentials() {
  // 优先使用运行时注入的凭证
  if (runtimeCredentials && runtimeCredentials.appId && runtimeCredentials.appSecret) {
    return {
      appId: runtimeCredentials.appId,
      appSecret: runtimeCredentials.appSecret
    };
  }
  // 从环境变量获取
  if (process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
    return {
      appId: process.env.FEISHU_APP_ID,
      appSecret: process.env.FEISHU_APP_SECRET
    };
  }
  // 使用默认凭证兜底
  return DEFAULT_CREDENTIALS;
}

/**
 * 获取 tenant_access_token
 */
async function getTenantAccessToken() {
  // 检查缓存
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const creds = getCredentials();
  if (!creds || !creds.appId || !creds.appSecret) {
    throw new Error('Feishu credentials not configured');
  }

  const resp = await fetch(`${FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: creds.appId,
      app_secret: creds.appSecret
    })
  });

  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error(`Failed to get tenant_access_token: ${data.msg}`);
  }

  tokenCache = {
    token: data.tenant_access_token,
    // 提前 5 分钟过期
    expiresAt: Date.now() + (data.expire - 300) * 1000
  };

  return tokenCache.token;
}

/**
 * 飞书 API 请求封装
 */
async function feishuRequest(method, path, body = null, params = null) {
  const token = await getTenantAccessToken();
  const url = new URL(`${FEISHU_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, String(v)));
  }

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const resp = await fetch(url.toString(), options);
  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error(`Feishu API error: ${data.code} - ${data.msg}`);
  }
  return data.data;
}

/**
 * 搜索记录
 */
async function searchRecords(tableKey, filter = null, pageSize = 500) {
  const tableId = FEISHU_CONFIG.tables[tableKey];
  const baseToken = FEISHU_CONFIG.baseToken;

  const body = {
    page_size: pageSize
  };
  if (filter) {
    body.filter = filter;
  }

  const allRecords = [];
  let pageToken = null;

  do {
    if (pageToken) body.page_token = pageToken;
    const data = await feishuRequest('POST', `/bitable/v1/apps/${baseToken}/tables/${tableId}/records/search`, body);
    allRecords.push(...(data.items || []));
    pageToken = data.has_more ? data.page_token : null;
  } while (pageToken);

  return allRecords;
}

/**
 * 创建记录
 */
async function createRecord(tableKey, fields) {
  const tableId = FEISHU_CONFIG.tables[tableKey];
  const baseToken = FEISHU_CONFIG.baseToken;

  const data = await feishuRequest('POST', `/bitable/v1/apps/${baseToken}/tables/${tableId}/records`, {
    fields: fields
  });

  return data.record;
}

/**
 * 批量创建记录
 */
async function batchCreateRecords(tableKey, recordsList) {
  const tableId = FEISHU_CONFIG.tables[tableKey];
  const baseToken = FEISHU_CONFIG.baseToken;

  const allRecords = [];
  // 每批最多 500 条
  for (let i = 0; i < recordsList.length; i += 500) {
    const batch = recordsList.slice(i, i + 500);
    const data = await feishuRequest('POST', `/bitable/v1/apps/${baseToken}/tables/${tableId}/records/batch_create`, {
      records: batch.map(fields => ({ fields }))
    });
    allRecords.push(...(data.records || []));
  }

  return allRecords;
}

/**
 * 更新记录
 */
async function updateRecord(tableKey, recordId, fields) {
  const tableId = FEISHU_CONFIG.tables[tableKey];
  const baseToken = FEISHU_CONFIG.baseToken;

  const data = await feishuRequest('PUT', `/bitable/v1/apps/${baseToken}/tables/${tableId}/records/${recordId}`, {
    fields: fields
  });

  return data.record;
}

/**
 * 删除记录
 */
async function deleteRecord(tableKey, recordId) {
  const tableId = FEISHU_CONFIG.tables[tableKey];
  const baseToken = FEISHU_CONFIG.baseToken;

  await feishuRequest('DELETE', `/bitable/v1/apps/${baseToken}/tables/${tableId}/records/${recordId}`);
  return true;
}

// ============================================
// 待办事项 - 字段映射
// ============================================

/**
 * 将前端 Todo 对象转为飞书记录字段
 */
function todoToFeishuFields(todo) {
  const fields = {};

  if (todo.title !== undefined) fields['标题'] = todo.title || '';
  if (todo.description !== undefined) fields['描述'] = todo.description || '';
  if (todo.category !== undefined) fields['分类'] = todo.category || '';
  if (todo.priority !== undefined) fields['优先级'] = todo.priority || '';
  if (todo.status !== undefined) fields['状态'] = todo.status || '';
  if (todo.dueDate !== undefined) fields['截止日期'] = todo.dueDate ? new Date(todo.dueDate).getTime() : null;
  if (todo.reminderTime !== undefined) fields['提醒配置'] = todo.reminderTime || '';
  if (todo.pinned !== undefined) fields['置顶'] = !!todo.pinned;
  if (todo.userId !== undefined) fields['用户ID'] = todo.userId || '';
  if (todo.completedAt !== undefined) fields['完成时间'] = todo.completedAt ? new Date(todo.completedAt).getTime() : null;
  if (todo.createdAt !== undefined) fields['创建时间'] = todo.createdAt ? new Date(todo.createdAt).getTime() : null;
  if (todo.updatedAt !== undefined) fields['更新时间'] = todo.updatedAt ? new Date(todo.updatedAt).getTime() : null;

  // 子任务存为 JSON 字符串
  if (todo.subtasks !== undefined) {
    fields['子任务JSON'] = JSON.stringify(todo.subtasks || []);
  }

  // 图片存为 base64 JSON
  if (todo.images !== undefined) {
    fields['图片Base64'] = JSON.stringify(todo.images || []);
  }

  // 标签存为 JSON
  if (todo.tags !== undefined) {
    fields['标签JSON'] = JSON.stringify(todo.tags || []);
  }

  return fields;
}

/**
 * 将飞书记录转为前端 Todo 对象
 */
function feishuToTodo(record) {
  const f = record.fields || {};
  const now = new Date().toISOString();

  // 解析子任务
  let subtasks = [];
  try {
    subtasks = f['子任务JSON'] ? JSON.parse(f['子任务JSON']) : [];
  } catch { subtasks = []; }

  // 解析图片
  let images = [];
  try {
    images = f['图片Base64'] ? JSON.parse(f['图片Base64']) : [];
  } catch { images = []; }

  // 解析标签
  let tags = [];
  try {
    tags = f['标签JSON'] ? JSON.parse(f['标签JSON']) : [];
  } catch { tags = []; }

  // 处理 select 字段（返回数组，取第一个）
  const getSelect = (v) => {
    if (!v) return '';
    if (Array.isArray(v)) return v[0]?.name || v[0] || '';
    if (typeof v === 'string') return v;
    if (v.name) return v.name;
    return '';
  };

  // 处理日期时间（飞书返回毫秒时间戳）
  const getDatetime = (v) => {
    if (!v) return null;
    if (typeof v === 'number') return new Date(v).toISOString();
    if (typeof v === 'string') return v;
    return null;
  };

  return {
    id: record.record_id,
    userId: f['用户ID'] || '',
    title: f['标题'] || '',
    description: f['描述'] || '',
    category: getSelect(f['分类']),
    tags: tags,
    priority: getSelect(f['优先级']) || 'medium',
    status: getSelect(f['状态']) || 'pending',
    dueDate: getDatetime(f['截止日期']),
    reminderTime: f['提醒配置'] || null,
    images: images,
    pinned: f['置顶'] === true || f['置顶'] === 1,
    subtasks: subtasks,
    completedAt: getDatetime(f['完成时间']),
    createdAt: getDatetime(f['创建时间']) || now,
    updatedAt: getDatetime(f['更新时间']) || now
  };
}

// ============================================
// 项目 - 字段映射
// ============================================

function projectToFeishuFields(project) {
  const fields = {};

  if (project.name !== undefined) fields['项目名'] = project.name || '';
  if (project.desc !== undefined) fields['描述'] = project.desc || project.description || '';
  if (project.priority !== undefined) fields['优先级'] = project.priority || '';
  if (project.status !== undefined) fields['状态'] = project.status || '';
  if (project.startDate !== undefined) fields['开始日期'] = project.startDate ? new Date(project.startDate).getTime() : null;
  if (project.endDate !== undefined) fields['结束日期'] = project.endDate ? new Date(project.endDate).getTime() : null;
  if (project.progress !== undefined) fields['进度'] = Number(project.progress) || 0;
  if (project.tags !== undefined) fields['标签'] = Array.isArray(project.tags) ? project.tags.join(',') : (project.tags || '');
  if (project.userId !== undefined) fields['用户ID'] = project.userId || '';
  if (project.createdAt !== undefined) fields['创建时间'] = project.createdAt ? new Date(project.createdAt).getTime() : null;
  if (project.updatedAt !== undefined) fields['更新时间'] = project.updatedAt ? new Date(project.updatedAt).getTime() : null;

  return fields;
}

function feishuToProject(record) {
  const f = record.fields || {};
  const now = new Date().toISOString();
  const getSelect = (v) => {
    if (!v) return '';
    if (Array.isArray(v)) return v[0]?.name || v[0] || '';
    if (typeof v === 'string') return v;
    if (v.name) return v.name;
    return '';
  };
  const getDatetime = (v) => {
    if (!v) return null;
    if (typeof v === 'number') return new Date(v).toISOString();
    if (typeof v === 'string') return v;
    return null;
  };

  return {
    id: record.record_id,
    userId: f['用户ID'] || '',
    name: f['项目名'] || '',
    description: f['描述'] || '',
    desc: f['描述'] || '',
    priority: getSelect(f['优先级']) || 'medium',
    status: getSelect(f['状态']) || 'planning',
    startDate: getDatetime(f['开始日期']),
    endDate: getDatetime(f['结束日期']),
    progress: f['进度'] || 0,
    tags: f['标签'] ? (typeof f['标签'] === 'string' ? f['标签'].split(',') : f['标签']) : [],
    createdAt: getDatetime(f['创建时间']) || now,
    updatedAt: getDatetime(f['更新时间']) || now
  };
}

// ============================================
// 设置 - 字段映射
// ============================================

function settingToFeishuFields(key, value, userId = '') {
  return {
    '键': key,
    '值': typeof value === 'string' ? value : JSON.stringify(value),
    '用户ID': userId
  };
}

function feishuToSetting(record) {
  const f = record.fields || {};
  return {
    id: record.record_id,
    key: f['键'] || '',
    value: f['值'] || '',
    userId: f['用户ID'] || ''
  };
}

module.exports = {
  FEISHU_CONFIG,
  getCredentials,
  setRuntimeCredentials,
  getTenantAccessToken,
  searchRecords,
  createRecord,
  batchCreateRecords,
  updateRecord,
  deleteRecord,
  feishuRequest,
  // Todo 映射
  todoToFeishuFields,
  feishuToTodo,
  // Project 映射
  projectToFeishuFields,
  feishuToProject,
  // Setting 映射
  settingToFeishuFields,
  feishuToSetting,
};
