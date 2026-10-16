/**
 * 源码版加载检查（file:// 场景）
 * 确认开发目录本身打开时没有任何脚本错误，而且权限界面状态正确。
 */
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(join(root, 'index.html'), 'utf8');

const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};

const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message || e)));

const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
for (const src of srcs) {
  try { window.eval(await readFile(join(root, src), 'utf8')); }
  catch (e) { errors.push(src + ': ' + e.message); }
}
await new Promise((r) => setTimeout(r, 50));
if (window.document.readyState === 'loading') window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
await new Promise((r) => setTimeout(r, 250));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

console.log('\n=== 源码版加载 ===');
ok(errors.length === 0, '无脚本错误：' + errors.join(' | '));
ok(!!window.App, 'App 已启动');
ok(typeof window.Auth === 'function' || typeof window.Auth === 'object', 'Auth 可用');
ok(typeof window.AuthView === 'object', 'AuthView 可用');
ok(typeof window.docsEvent === 'function', 'docsEvent 事件总线已定义');

// 未设密码的本地模式下应可编辑
window.Auth.logout();
window.Store.remove('xzu.auth.v1');
ok(window.Auth.canEdit(), '本地未设密码时可编辑（首次使用能导入）');

// 角色徽章
const badge = window.document.getElementById('role-badge');
ok(!!badge, '顶栏有角色徽章');
ok(badge.textContent.length > 0, '徽章有文字：' + badge.textContent);

// 各页面均可打开
for (const p of ['home', 'timetable', 'import', 'fitness', 'standard', 'docs', 'settings']) {
  window.App.goto(p);
  const sec = window.document.getElementById('page-' + p);
  ok(sec && sec.classList.contains('active'), '页面 #' + p + ' 可正常打开');
}

// 设置页的权限卡片与发布卡片在管理员身份下可见
window.App.goto('settings');
window.AuthView.refresh();
ok(window.document.getElementById('card-security').style.display !== 'none', '账号安全卡片可见');
ok(window.document.getElementById('card-publish').style.display !== 'none', '发布卡片可见');

// 文件中心上传入口可见
window.App.goto('docs');
window.AuthView.refresh();
window.docsEvent('auth-changed');
ok(window.document.getElementById('doc-admin-actions').style.display !== 'none',
  '本地模式下上传按钮区可见');

console.log(`\n通过 ${pass} / ${pass + fail}\n`);
process.exit(fail ? 1 : 0);
