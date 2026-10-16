/**
 * 只读发布版验收测试
 *
 * 打包脚本自己说「已剥离」不算数，这里把 dist/ 真正加载进 DOM 环境，
 * 从外部模拟一个普通访问者，看看到底能不能上传文件。
 *
 * 断言分两层：
 *   1. 界面上不存在任何上传入口
 *   2. 后端函数（如果还能拿到）也会被拒绝
 */
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');

let pass = 0, fail = 0;
const failures = [];

function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; failures.push(msg); console.error('  ✗ ' + msg); }
}
function eq(a, b, msg) { ok(a === b, msg + ` (期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)})`); }

async function boot(distPath, label) {
  const html = await readFile(join(distPath, 'index.html'), 'utf8');

  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;

  window.scrollTo = () => {};
  window.alert = () => {};
  window.confirm = () => true;

  // 复刻浏览器加载 <script src> 的顺序
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  const errors = [];
  window.addEventListener('error', (e) => errors.push(String(e.message || e)));

  for (const src of srcs) {
    const code = await readFile(join(distPath, src), 'utf8');
    try {
      window.eval(code);
    } catch (e) {
      errors.push(src + ': ' + e.message);
    }
  }

  // 等 DOMContentLoaded 里的初始化跑完
  await new Promise((r) => setTimeout(r, 60));
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  await new Promise((r) => setTimeout(r, 200));

  return { window, errors, srcs, label };
}

/* ------------------------------------------------ 硬只读版（--hard） */

console.log('\n=== 硬只读发布版（dist/，--hard）===');

{
  const { window, errors, srcs } = await boot(distDir, 'hard');

  ok(errors.length === 0, '加载无脚本错误' + (errors.length ? '：' + errors.join(' | ') : ''));
  ok(window.App && typeof window.App.goto === 'function', 'App 正常启动');

  /* 1. 管理员代码物理上不存在 */
  ok(typeof window.Auth === 'undefined', '全局不存在 Auth 对象（权限模块已物理删除）');
  ok(typeof window.AuthView === 'undefined', '全局不存在 AuthView 对象');
  ok(typeof window.Sha256 === 'undefined', '全局不存在 Sha256 函数');
  ok(!srcs.some((s) => s.includes('auth')), '没有任何 auth 相关脚本被加载');
  ok(!srcs.some((s) => s.includes('sha256')), '没有加载 sha256 脚本');

  /* 2. 界面上找不到任何上传入口 */
  const doc = window.document;
  for (const id of ['doc-add-file', 'doc-add-text', 'doc-add-link', 'doc-export',
                    'doc-admin-login', 'auth-btn', 'card-security', 'card-publish',
                    'auth-save-pwd', 'auth-new-pwd']) {
    ok(doc.getElementById(id) === null, `发布版中不存在 #${id}`);
  }
  ok(doc.getElementById('doc-admin-actions') === null, '上传按钮区已从 HTML 移除');
  ok(doc.querySelectorAll('.admin-only').length === 0, '不存在任何 admin-only 区块');

  /* 3. 只读提示可见 */
  const bar = doc.getElementById('readonly-bar');
  ok(!!bar, '存在只读提示条');
  ok(bar && bar.style.display !== 'none', '只读提示条对访问者可见');
  ok(bar && /只读/.test(bar.textContent), '提示条明确说明是只读版本');

  /* 4. 内容仍可正常浏览 —— 只读不等于不可用 */
  window.App.goto('docs');
  const list = doc.getElementById('doc-list');
  ok(list.innerHTML.includes('doc-item'), '文件列表正常渲染，访问者可以浏览');
  ok(!list.innerHTML.includes('data-del-doc'), '列表中没有删除按钮');
  ok(!list.innerHTML.includes('data-edit-doc'), '列表中没有编辑按钮');
  ok(list.innerHTML.includes('data-preview'), '列表中有查看按钮');

  /* 5. 即使有人硬闯后端函数，也必须失败 */
  const before = JSON.stringify(window.Store.read('xzu.docs.v1', []));
  let breached = false;

  // DocsView 仍然存在（它负责渲染），尝试用它导入
  try {
    const fakeFile = new window.File(['恶意内容'], '注入.txt', { type: 'text/plain' });
    await window.DocsView.importFiles([fakeFile]);
    const after = JSON.stringify(window.Store.read('xzu.docs.v1', []));
    if (after !== before && after.includes('注入')) breached = true;
  } catch (e) { /* 抛错也说明没写进去 */ }

  // 再用测试钩子直接尝试落盘（走守卫路径）
  try {
    window.DocsView._setDocsForTest([{ id: 'x', title: '直写尝试', category: '其它' }]);
    window.DocsView._testSave();
    const after = JSON.stringify(window.Store.read('xzu.docs.v1', []));
    if (after.includes('直写尝试')) breached = true;
  } catch (e) { /* 预期 */ }

  ok(!breached, '🔒 绕过界面直接调用写入函数也被拒绝（普通用户无法上传）');

  /* 6. 只读模式下不会把发布内容写进访客的 localStorage */
  const savedSource = window.DocsView._source ? window.DocsView._source() : '(未知)';
  ok(savedSource !== 'local', '发布内容不会被写入访客本地存储（来源：' + savedSource + '）');

  /* 7. 其他功能不受影响 */
  window.App.goto('fitness');
  ok(doc.getElementById('fit-inputs').innerHTML.length > 100, '体测计算功能可正常使用');
  window.App.goto('timetable');
  ok(!!doc.getElementById('tt-grid'), '课表功能可正常使用');
  window.App.goto('standard');
  ok(doc.getElementById('std-table').innerHTML.length > 500, '标准查询功能可正常使用');
}

/* ------------------------------------------------ 烧入数据包版本 */

console.log('\n=== 烧入管理员文件包的发布版 ===');

{
  const { readFile: rf, writeFile: wf } = await import('node:fs/promises');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');

  // 造一个数据包，模拟管理员在设置页导出的文件
  const docs = [
    { id: 'p1', title: '推荐免试攻读研究生工作办法', category: '保研推免', college: '教务处',
      year: '2024', fileType: 'text', size: 0, addedAt: Date.now(), source: '教务处',
      description: '推免名额分配与成绩计算办法', tags: ['保研', '推免'], content: '第一章 总则……' },
    { id: 'p2', title: '学生体质健康标准实施办法', category: '体测体育', college: '体育部',
      year: '2024', fileType: 'text', size: 0, addedAt: Date.now(), source: '体育部',
      description: '体测项目与评分标准', tags: ['体测'], content: '……' }
  ];
  const packPath = join(root, 'tmp-docs-pack.json');
  await wf(packPath, JSON.stringify({ type: 'xzu-docs-pack', docs }), 'utf8');

  const outDir = join(root, 'dist-bundled');
  await promisify(execFile)('node',
    [join(root, 'tools/pack.mjs'), '--hard', '--docs=' + packPath, '--out=dist-bundled'],
    { cwd: root });

  const { window, errors } = await boot(outDir, 'bundled');
  ok(errors.length === 0, '烧入版加载无错误' + (errors.length ? '：' + errors.join(' | ') : ''));

  window.App.goto('docs');
  const list = window.document.getElementById('doc-list').innerHTML;
  ok(list.includes('推荐免试攻读研究生工作办法'), '访问者能看到管理员烧入的保研文件');
  ok(list.includes('学生体质健康标准实施办法'), '访问者能看到体测文件');
  eq(window.document.querySelectorAll('#doc-list .doc-item').length, 2, '两条文件都渲染出来');
  ok(list.includes('data-preview'), '访问者可以点开预览');

  // 仍然不能上传
  ok(window.document.getElementById('doc-add-file') === null, '烧入版同样没有上传入口');
  ok(typeof window.Auth === 'undefined', '烧入版同样不含权限模块');
  let breached2 = false;
  try {
    window.DocsView._setDocsForTest([{ id: 'z', title: '偷加', category: '其它' }]);
    window.DocsView._testSave();
    if (JSON.stringify(window.Store.read('xzu.docs.v1', [])).includes('偷加')) breached2 = true;
  } catch (e) { /* 预期 */ }
  ok(!breached2, '🔒 烧入版中写入依然被拒绝');

  // 搜索过滤可用
  eq(window.Store.read('xzu.docs.v1', null), null, '发布内容不落本地存储');

  await rf(packPath).catch(() => {});
  const { rm } = await import('node:fs/promises');
  await rm(packPath, { force: true });
  await rm(outDir, { recursive: true, force: true });
}

/* ------------------------------------------------ 软只读版（默认） */

console.log('\n=== 软只读发布版（软只读，保留管理员入口）===');

{
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  await promisify(execFile)('node', [join(root, 'tools/pack.mjs'), '--soft', '--out=dist-soft'], { cwd: root });

  const { window, errors } = await boot(join(root, 'dist-soft'), 'soft');

  ok(errors.length === 0, '软只读版加载无脚本错误' + (errors.length ? '：' + errors.join(' | ') : ''));
  ok(typeof window.Auth !== 'undefined', '软只读版保留 Auth（管理员可现场维护）');
  ok(window.Auth.isPublished(), '软只读版处于发布模式');

  // 关键：未设密码的发布模式必须只读，否则访问者就能直接上传
  window.Auth.logout();
  window.Store.remove('xzu.auth.v1');
  ok(!window.Auth.canEdit(), '🔒 发布模式未设密码时普通访问者不可编辑');

  const list = window.document.getElementById('doc-list');
  window.App.goto('docs');
  ok(!window.document.getElementById('doc-list').innerHTML.includes('data-del-doc'),
    '软只读版中普通访问者看不到删除按钮');

  // 有密码时管理员可以登录维护
  window.Auth.setPassword('admin-123');
  ok(window.Auth.canEdit(), '软只读版管理员登录后可以维护文件');
}

console.log('\n' + '─'.repeat(56));
if (fail) {
  console.log(`失败 ${fail} 项：`);
  failures.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`通过 ${pass} / ${pass + fail}`);
console.log('─'.repeat(56) + '\n');

process.exit(fail ? 1 : 0);
