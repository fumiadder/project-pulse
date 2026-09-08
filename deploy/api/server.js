/**
 * Project Pulse API Server
 * 使用飞书多维表格作为数据存储
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

// 飞书客户端
const feishu = require('./feishu-client');

const app = express();
const PORT = process.env.PORT || 3080;

// 本地 JSON 文件存储（用于次要数据：用户、打卡等）
const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || path.join(__dirname, 'data', 'local-db.json');
const dataDir = path.dirname(LOCAL_DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// 加载本地数据
function loadLocalDB() {
  try {
    return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
  } catch {
    return { users: [], checkins: [], progress: [], reports: [], ideas: [], daily_tags: [] };
  }
}

function saveLocalDB(db) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
}

let localDB = loadLocalDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const now = () => new Date().toISOString();
const upload = multer({ storage: multer.memoryStorage() });

// ============================================
// 从设置表加载飞书凭证并注入到 feishu-client
// ============================================
async function loadFeishuCredentialsFromSettings() {
  try {
    const records = await feishu.searchRecords('settings');
    const appIdRec = records.find(r => (r.fields['键'] || '') === 'feishu_app_id');
    const appSecretRec = records.find(r => (r.fields['键'] || '') === 'feishu_app_secret');

    const appId = appIdRec?.fields['值'] || '';
    const appSecret = appSecretRec?.fields['值'] || '';

    if (appId && appSecret) {
      feishu.setRuntimeCredentials({ appId, appSecret });
      console.log('飞书凭证已从设置表加载');
    } else {
      console.log('设置表未找到飞书凭证，将使用环境变量');
    }
  } catch (err) {
    console.error('加载飞书凭证失败:', err.message);
  }
}

// ============================================
// 健康检查
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: now(), storage: 'feishu-base' });
});

app.get('/api/debug', (req, res) => {
  res.json({
    storage: 'feishu-base',
    baseToken: feishu.FEISHU_CONFIG.baseToken,
    tables: feishu.FEISHU_CONFIG.tables,
    localDBPath: LOCAL_DB_PATH
  });
});

// ============================================
// 待办事项 API
// ============================================

// 获取待办列表
app.get('/api/todos', async (req, res) => {
  try {
    const records = await feishu.searchRecords('todos');
    const todos = records.map(feishu.feishuToTodo);
    res.json({ success: true, data: todos });
  } catch (err) {
    console.error('GET /api/todos error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 保存/更新待办（PUT 批量或单条）
app.put('/api/todos', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const results = [];

    for (const item of items) {
      const nowTime = now();
      if (!item.createdAt) item.createdAt = nowTime;
      item.updatedAt = nowTime;

      if (item.id && !item.id.startsWith('record')) {
        // 已有记录：搜索是否存在于飞书
        try {
          const existing = await feishu.searchRecords('todos', {
            conjunction: 'and',
            conditions: []
          });
          const found = existing.find(r => r.record_id === item.id);
          if (found) {
            // 更新
            const fields = feishu.todoToFeishuFields(item);
            const updated = await feishu.updateRecord('todos', item.id, fields);
            results.push(feishu.feishuToTodo(updated));
            continue;
          }
        } catch {
          // 搜索失败，尝试直接更新
        }
        // 尝试直接作为 record_id 更新
        try {
          const fields = feishu.todoToFeishuFields(item);
          const updated = await feishu.updateRecord('todos', item.id, fields);
          results.push(feishu.feishuToTodo(updated));
          continue;
        } catch {
          // 更新失败，创建新记录
        }
      }

      // 创建新记录
      const fields = feishu.todoToFeishuFields(item);
      const created = await feishu.createRecord('todos', fields);
      results.push(feishu.feishuToTodo(created));
    }

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('PUT /api/todos error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 删除待办
app.delete('/api/todos/:id', async (req, res) => {
  try {
    await feishu.deleteRecord('todos', req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/todos/:id error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取单个待办
app.get('/api/todos/:id', async (req, res) => {
  try {
    // 飞书 API 没有 GET single record，需要搜索
    const records = await feishu.searchRecords('todos');
    const todo = records.find(r => r.record_id === req.params.id);
    if (todo) {
      res.json({ success: true, data: feishu.feishuToTodo(todo) });
    } else {
      res.status(404).json({ success: false, error: 'Todo not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// 项目 API
// ============================================

app.get('/api/projects', async (req, res) => {
  try {
    const records = await feishu.searchRecords('projects');
    const projects = records.map(feishu.feishuToProject);
    res.json({ success: true, data: projects });
  } catch (err) {
    console.error('GET /api/projects error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/projects', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const results = [];

    for (const item of items) {
      const nowTime = now();
      if (!item.createdAt) item.createdAt = nowTime;
      item.updatedAt = nowTime;

      if (item.id && item.id.startsWith('rec')) {
        try {
          const fields = feishu.projectToFeishuFields(item);
          const updated = await feishu.updateRecord('projects', item.id, fields);
          results.push(feishu.feishuToProject(updated));
          continue;
        } catch {
          // 更新失败，创建新记录
        }
      }

      // 创建新记录
      const fields = feishu.projectToFeishuFields(item);
      const created = await feishu.createRecord('projects', fields);
      results.push(feishu.feishuToProject(created));
    }

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('PUT /api/projects error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await feishu.deleteRecord('projects', req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const records = await feishu.searchRecords('projects');
    const project = records.find(r => r.record_id === req.params.id);
    if (project) {
      res.json({ success: true, data: feishu.feishuToProject(project) });
    } else {
      res.status(404).json({ success: false, error: 'Project not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// 设置 API（存飞书）
// ============================================

app.get('/api/settings/:key', async (req, res) => {
  try {
    const records = await feishu.searchRecords('settings');
    const setting = records.find(r => (r.fields['键'] || '') === req.params.key);
    if (setting) {
      res.json({ success: true, value: setting.fields['值'] || '' });
    } else {
      res.json({ success: true, value: '' });
    }
  } catch (err) {
    console.error('GET /api/settings/:key error:', err.message);
    // 飞书不可用时返回空
    res.json({ success: true, value: '' });
  }
});

app.put('/api/settings/:key', async (req, res) => {
  try {
    const value = typeof req.body === 'string' ? req.body : (req.body.value || JSON.stringify(req.body));
    const records = await feishu.searchRecords('settings');
    const existing = records.find(r => (r.fields['键'] || '') === req.params.key);

    if (existing) {
      await feishu.updateRecord('settings', existing.record_id, {
        '键': req.params.key,
        '值': value
      });
    } else {
      await feishu.createRecord('settings', feishu.settingToFeishuFields(req.params.key, value));
    }

    res.json({ success: true, value });
  } catch (err) {
    console.error('PUT /api/settings/:key error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// 用户 API（本地 JSON 存储）
// ============================================

app.get('/api/users', (req, res) => {
  res.json({ success: true, data: localDB.users || [] });
});

app.put('/api/users', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  for (const item of items) {
    if (!item.id) item.id = uuidv4();
    if (!item.createdAt) item.createdAt = now();
    const idx = localDB.users.findIndex(u => u.id === item.id);
    if (idx >= 0) {
      localDB.users[idx] = { ...localDB.users[idx], ...item };
    } else {
      localDB.users.push(item);
    }
  }
  saveLocalDB(localDB);
  res.json({ success: true, data: items });
});

app.delete('/api/users/:id', (req, res) => {
  localDB.users = localDB.users.filter(u => u.id !== req.params.id);
  saveLocalDB(localDB);
  res.json({ success: true });
});

// ============================================
// 打卡 API（本地 JSON 存储）
// ============================================

app.get('/api/checkins', (req, res) => {
  res.json({ success: true, data: localDB.checkins || [] });
});

app.put('/api/checkins', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  for (const item of items) {
    if (!item.id) item.id = uuidv4();
    if (!item.createdAt) item.createdAt = now();
    item.updatedAt = now();
    const idx = localDB.checkins.findIndex(c => c.id === item.id);
    if (idx >= 0) {
      localDB.checkins[idx] = { ...localDB.checkins[idx], ...item };
    } else {
      localDB.checkins.push(item);
    }
  }
  saveLocalDB(localDB);
  res.json({ success: true, data: items });
});

app.delete('/api/checkins/:id', (req, res) => {
  localDB.checkins = localDB.checkins.filter(c => c.id !== req.params.id);
  saveLocalDB(localDB);
  res.json({ success: true });
});

// ============================================
// 进度 API（本地 JSON 存储）
// ============================================

app.get('/api/progress', (req, res) => {
  res.json({ success: true, data: localDB.progress || [] });
});

app.put('/api/progress', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  for (const item of items) {
    if (!item.id) item.id = uuidv4();
    if (!item.createdAt) item.createdAt = now();
    item.updatedAt = now();
    const idx = localDB.progress.findIndex(p => p.id === item.id);
    if (idx >= 0) {
      localDB.progress[idx] = { ...localDB.progress[idx], ...item };
    } else {
      localDB.progress.push(item);
    }
  }
  saveLocalDB(localDB);
  res.json({ success: true, data: items });
});

app.delete('/api/progress/:id', (req, res) => {
  localDB.progress = localDB.progress.filter(p => p.id !== req.params.id);
  saveLocalDB(localDB);
  res.json({ success: true });
});

// ============================================
// 报告 API（本地 JSON 存储）
// ============================================

app.get('/api/reports', (req, res) => {
  res.json({ success: true, data: localDB.reports || [] });
});

app.put('/api/reports', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  for (const item of items) {
    if (!item.id) item.id = uuidv4();
    if (!item.createdAt) item.createdAt = now();
    item.updatedAt = now();
    const idx = localDB.reports.findIndex(r => r.id === item.id);
    if (idx >= 0) {
      localDB.reports[idx] = { ...localDB.reports[idx], ...item };
    } else {
      localDB.reports.push(item);
    }
  }
  saveLocalDB(localDB);
  res.json({ success: true, data: items });
});

// ============================================
// 想法 API（本地 JSON 存储）
// ============================================

app.get('/api/ideas', (req, res) => {
  res.json({ success: true, data: localDB.ideas || [] });
});

app.put('/api/ideas', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  for (const item of items) {
    if (!item.id) item.id = uuidv4();
    if (!item.createdAt) item.createdAt = now();
    item.updatedAt = now();
    const idx = localDB.ideas.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      localDB.ideas[idx] = { ...localDB.ideas[idx], ...item };
    } else {
      localDB.ideas.push(item);
    }
  }
  saveLocalDB(localDB);
  res.json({ success: true, data: items });
});

app.delete('/api/ideas/:id', (req, res) => {
  localDB.ideas = localDB.ideas.filter(i => i.id !== req.params.id);
  saveLocalDB(localDB);
  res.json({ success: true });
});

app.post('/api/ideas/:id/land', (req, res) => {
  const idea = localDB.ideas.find(i => i.id === req.params.id);
  if (idea) {
    idea.landedProjectId = req.body.projectId;
    idea.updatedAt = now();
    saveLocalDB(localDB);
    res.json({ success: true, data: idea });
  } else {
    res.status(404).json({ success: false, error: 'Idea not found' });
  }
});

// ============================================
// 日常标签 API（本地 JSON 存储）
// ============================================

app.get('/api/daily_tags', (req, res) => {
  res.json({ success: true, data: localDB.daily_tags || [] });
});

app.put('/api/daily_tags', (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  for (const item of items) {
    if (!item.id) item.id = uuidv4();
    const idx = localDB.daily_tags.findIndex(t => t.id === item.id);
    if (idx >= 0) {
      localDB.daily_tags[idx] = { ...localDB.daily_tags[idx], ...item };
    } else {
      localDB.daily_tags.push(item);
    }
  }
  saveLocalDB(localDB);
  res.json({ success: true, data: items });
});

// ============================================
// 同步 API
// ============================================

app.get('/api/sync/full', async (req, res) => {
  try {
    const [todoRecords, projectRecords, settingRecords] = await Promise.all([
      feishu.searchRecords('todos').catch(() => []),
      feishu.searchRecords('projects').catch(() => []),
      feishu.searchRecords('settings').catch(() => [])
    ]);

    res.json({
      success: true,
      data: {
        todos: todoRecords.map(feishu.feishuToTodo),
        projects: projectRecords.map(feishu.feishuToProject),
        settings: settingRecords.map(feishu.feishuToSetting),
        users: localDB.users || [],
        checkins: localDB.checkins || [],
        progress: localDB.progress || [],
        reports: localDB.reports || [],
        ideas: localDB.ideas || [],
        daily_tags: localDB.daily_tags || [],
      }
    });
  } catch (err) {
    console.error('GET /api/sync/full error:', err.message);
    res.status(500).json({
      success: true,
      data: {
        todos: [], projects: [], settings: [],
        users: localDB.users || [], checkins: localDB.checkins || [],
        progress: localDB.progress || [], reports: localDB.reports || [],
        ideas: localDB.ideas || [], daily_tags: localDB.daily_tags || [],
      }
    });
  }
});

app.post('/api/sync/full', async (req, res) => {
  try {
    const { todos = [], projects = [], settings = [], users = [], checkins = [], progress = [], reports = [], ideas = [], daily_tags = [] } = req.body;

    // 同步待办到飞书
    for (const todo of todos) {
      try {
        const existing = await feishu.searchRecords('todos');
        const found = existing.find(r => r.record_id === todo.id);
        const fields = feishu.todoToFeishuFields(todo);
        if (found) {
          await feishu.updateRecord('todos', found.record_id, fields);
        } else {
          await feishu.createRecord('todos', fields);
        }
      } catch (e) { console.error('Sync todo error:', e.message); }
    }

    // 同步项目到飞书
    for (const project of projects) {
      try {
        const fields = feishu.projectToFeishuFields(project);
        if (project.id && project.id.startsWith('rec')) {
          try {
            await feishu.updateRecord('projects', project.id, fields);
          } catch {
            await feishu.createRecord('projects', fields);
          }
        } else {
          await feishu.createRecord('projects', fields);
        }
      } catch (e) { console.error('Sync project error:', e.message); }
    }

    // 保存其他数据到本地
    if (users?.length) { localDB.users = users; }
    if (checkins?.length) { localDB.checkins = checkins; }
    if (progress?.length) { localDB.progress = progress; }
    if (reports?.length) { localDB.reports = reports; }
    if (ideas?.length) { localDB.ideas = ideas; }
    if (daily_tags?.length) { localDB.daily_tags = daily_tags; }
    saveLocalDB(localDB);

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/sync/full error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// 统计 API
// ============================================

app.get('/api/stats', async (req, res) => {
  try {
    const records = await feishu.searchRecords('todos');
    const todos = records.map(feishu.feishuToTodo);

    const stats = {
      total: todos.length,
      pending: todos.filter(t => t.status === 'pending').length,
      inProgress: todos.filter(t => t.status === 'in-progress').length,
      completed: todos.filter(t => t.status === 'completed').length,
      overdue: todos.filter(t => {
        if (!t.dueDate || t.status === 'completed') return false;
        return new Date(t.dueDate) < new Date();
      }).length
    };

    res.json({ success: true, data: stats });
  } catch (err) {
    res.json({ success: true, data: { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0 } });
  }
});

// ============================================
// 文件上传 API
// ============================================

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const b64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${b64}`;
    res.json({ success: true, url: dataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload/multiple', upload.array('files', 10), (req, res) => {
  try {
    const urls = (req.files || []).map(f => {
      const b64 = f.buffer.toString('base64');
      return `data:${f.mimetype};base64,${b64}`;
    });
    res.json({ success: true, urls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/upload/:dateDir/:filename', (req, res) => {
  res.json({ success: true });
});

// ============================================
// 备份 API
// ============================================

app.post('/api/backup', async (req, res) => {
  res.json({ success: true, message: 'Data is stored in Feishu Base automatically' });
});

// ============================================
// 导出 Excel（简化版）
// ============================================

app.get('/api/export/excel', async (req, res) => {
  try {
    const records = await feishu.searchRecords('todos');
    const todos = records.map(feishu.feishuToTodo);

    // 生成 CSV
    const headers = ['标题', '状态', '优先级', '分类', '截止日期', '创建时间'];
    const rows = todos.map(t => [
      t.title || '',
      t.status || '',
      t.priority || '',
      t.category || '',
      t.dueDate || '',
      t.createdAt || ''
    ]);

    const csv = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // 添加 BOM 让 Excel 正确识别 UTF-8
    const bom = '\ufeff';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="project-pulse-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(bom + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 飞书通知 API
// ============================================

app.get('/api/feishu-config', async (req, res) => {
  try {
    const records = await feishu.searchRecords('settings');
    const openIdRec = records.find(r => (r.fields['键'] || '') === 'feishu_open_id');
    const appIdRec = records.find(r => (r.fields['键'] || '') === 'feishu_app_id');
    const appSecretRec = records.find(r => (r.fields['键'] || '') === 'feishu_app_secret');

    const appId = appIdRec?.fields['值'] || process.env.FEISHU_APP_ID || '';
    const appSecret = appSecretRec?.fields['值'] ? '已配置' : (process.env.FEISHU_APP_SECRET ? '已配置' : '');
    const openId = openIdRec?.fields['值'] || '';

    res.json({
      success: true,
      data: { appId, appSecret, openId }
    });
  } catch (err) {
    res.json({
      success: true,
      data: {
        appId: process.env.FEISHU_APP_ID || '',
        appSecret: process.env.FEISHU_APP_SECRET ? '已配置' : '',
        openId: ''
      }
    });
  }
});

app.put('/api/feishu-config', async (req, res) => {
  try {
    const { appId, appSecret, openId } = req.body;

    // 保存到飞书设置表
    for (const [key, value] of Object.entries({ 'feishu_app_id': appId, 'feishu_app_secret': appSecret, 'feishu_open_id': openId })) {
      if (!value) continue;
      const records = await feishu.searchRecords('settings');
      const existing = records.find(r => (r.fields['键'] || '') === key);
      if (existing) {
        await feishu.updateRecord('settings', existing.record_id, { '键': key, '值': value });
      } else {
        await feishu.createRecord('settings', feishu.settingToFeishuFields(key, value));
      }
    }

    // 重新加载凭证到 feishu-client
    await loadFeishuCredentialsFromSettings();

    res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/feishu-config error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 飞书用户查询
app.get('/api/feishu-users', async (req, res) => {
  try {
    const { email, mobile } = req.query;
    const creds = feishu.getCredentials ? feishu.getCredentials() : { appId: process.env.FEISHU_APP_ID, appSecret: process.env.FEISHU_APP_SECRET };

    if (!creds || !creds.appId || !creds.appSecret) {
      return res.json({ success: false, error: '飞书凭证未配置' });
    }

    const token = await feishu.getTenantAccessToken();
    const body = {};
    if (email) body.emails = [email];
    if (mobile) body.mobiles = [mobile];

    const resp = await fetch('https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await resp.json();

    if (data.code !== 0) {
      return res.json({ success: false, error: `查询失败(code=${data.code}): ${data.msg}` });
    }

    const users = [];
    if (data.data?.user_list) {
      for (const u of data.data.user_list) {
        if (u.user_id) {
          users.push({ openId: u.user_id.open_id, name: u.user_id.name || '未知' });
        }
      }
    }

    res.json({ success: true, data: { users } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 发送飞书消息通知
app.post('/api/feishu-notify', async (req, res) => {
  try {
    const { openId, message } = req.body;
    if (!openId || !message) {
      return res.json({ success: false, error: '缺少 openId 或 message' });
    }

    const token = await feishu.getTenantAccessToken();
    const resp = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        receive_id: openId,
        msg_type: 'text',
        content: JSON.stringify({ text: message })
      })
    });
    const data = await resp.json();

    if (data.code !== 0) {
      return res.json({ success: false, error: `飞书发送失败(code=${data.code}): ${data.msg}` });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// 迁移 API
// ============================================

app.post('/api/migrate/kv', (req, res) => {
  res.json({ success: true, message: 'Migration not needed with Feishu Base' });
});

// ============================================
// 静态文件服务（前端构建产物）
// ============================================

// dist 目录在上级目录（部署结构: /opt/project-pulse/dist + /opt/project-pulse/api/）
const distPath = path.join(__dirname, '..', 'dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA 回退：所有非 API 路由返回 index.html
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ success: false, error: 'API not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log(`Static files served from: ${distPath}`);
} else {
  console.log(`Warning: dist directory not found at ${distPath}`);
}

// ============================================
// 启动服务器
// ============================================

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`=== Project Pulse API (Feishu Base) ===`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Storage: Feishu Base`);
  console.log(`Base Token: ${feishu.FEISHU_CONFIG.baseToken}`);
  console.log(`Tables: ${JSON.stringify(feishu.FEISHU_CONFIG.tables)}`);
  console.log(`Local DB: ${LOCAL_DB_PATH}`);

  // 启动时从设置表加载飞书凭证
  await loadFeishuCredentialsFromSettings();
});
