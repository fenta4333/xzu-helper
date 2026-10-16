/**
 * 极简静态服务器（仅用于本地预览，无外部依赖）
 *
 * 用法：
 *   node tools/serve.mjs [端口]              预览源码版（默认 8080）
 *   node tools/serve.mjs [端口] --dir=dist   预览打包产物
 *
 * 加 --dir 的意义：上传 GitHub Pages 之前，先在本机按发布版的真实样子看一眼，
 * 确认链接、资源、只读状态都对，比传上去再发现问题省事得多。
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize, resolve } from 'node:path';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirArg = process.argv.find((a) => a.startsWith('--dir='));
const root = dirArg
  ? resolve(projectRoot, dirArg.slice('--dir='.length))
  : projectRoot;
const port = Number(process.argv.filter((a) => /^\d+$/.test(a))[0]) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};

const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/') pathname = '/index.html';

    // 防目录穿越
    const target = normalize(join(root, pathname));
    if (!target.startsWith(root)) {
      res.writeHead(403).end('403 Forbidden');
      return;
    }

    const info = await stat(target);
    const file = info.isDirectory() ? join(target, 'index.html') : target;
    const body = await readFile(file);

    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(body);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 页面不存在');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('500 ' + err.message);
    }
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`西藏大学学业助手已启动：http://127.0.0.1:${port}/`);
  console.log('（直接双击 index.html 用 file:// 打开也完全可用）');
});
