/**
 * 工作汇报系统 - 本地服务器
 * 支持多管理员、数据持久化到本地文件
 * 
 * 启动方式（双击这个文件就可以，或在命令行）：
 *   node server.js
 * 
 * 访问地址：
 *   http://localhost:3456
 * 
 * 局域网其他电脑访问：
 *   http://你电脑IP:3456
 *   （手机也可以连）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const DIR = __dirname;
const HTML_FILE = path.join(DIR, 'daily-report.html');
const DATA_FILE = path.join(DIR, 'data.json');
const ADMINS_FILE = path.join(DIR, 'admins.json');

// ====== 初始化数据文件 ======
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ checkin: null, members: [] }), 'utf-8');
if (!fs.existsSync(ADMINS_FILE)) fs.writeFileSync(ADMINS_FILE, JSON.stringify({ admins: [{ name: '管理员', password: 'admin123', isSuperAdmin: true }] }), 'utf-8');

// ====== 工具函数 ======
function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return {}; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(file + '.tmp', file);
}

function getIP() {
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

// ====== HTTP 服务 ======
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ====== API: 登录 ======
  if (pathname === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name, password } = JSON.parse(body);
        const admins = readJSON(ADMINS_FILE);
        const admin = admins.admins.find(a => a.name === name && a.password === password);
        if (admin) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, admin: { name: admin.name } }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: '用户名或密码错误' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // ====== API: 获取管理员列表（用于前端判断是否需要注册） ======
  if (pathname === '/api/admins' && req.method === 'GET') {
    const data = readJSON(ADMINS_FILE);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // ====== API: 获取数据 ======
  if (pathname === '/api/data' && req.method === 'GET') {
    const data = readJSON(DATA_FILE);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // ====== API: 保存数据 ======
  if (pathname === '/api/data' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        writeJSON(DATA_FILE, JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // ====== 静态文件 ======
  let filePath = pathname === '/' ? HTML_FILE : path.join(DIR, pathname);
  if (!filePath.startsWith(DIR)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); res.end('Not Found'); }
    else {
      const ext = path.extname(filePath);
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
      const headers = { 'Content-Type': mime[ext] || 'application/octet-stream' };
      // HTML 文件禁用缓存，确保前端代码即时生效
      if (ext === '.html') headers['Cache-Control'] = 'no-store, must-revalidate';
      res.writeHead(200, headers);
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  const ip = getIP();
  console.log('\n  🚀 工作汇报服务器已启动！');
  console.log('  ─────────────────────────────');
  console.log('  📍 本机访问：http://localhost:' + PORT);
  console.log('  📍 手机/同事（同网络）：http://' + ip + ':' + PORT);
  console.log('  📍 不同网络：需使用内网穿透工具，如 ngrok');
  console.log('    命令：ngrok http ' + PORT);
  console.log('  ─────────────────────────────');
  console.log('  📁 数据文件：data.json');
  console.log('  👥 管理员：admins.json（可手动添加）');
  console.log('  默认管理员：管理员 / admin123');
  console.log('  ─────────────────────────────');
  console.log('  Ctrl+C 停止服务\n');
});
