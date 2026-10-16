/**
 * 部署场景验收测试（GitHub Pages 等静态托管）
 *
 * 这个测试专门回答一个容易想当然的问题：
 *   「把站点传到 GitHub Pages 之后，权限还成立吗？」
 *
 * 静态站点有两个坑，必须真机验证而不是靠推理：
 *   1. localStorage 是每个浏览器各自的 —— 密码不会跟着网站走。
 *      管理员在自己电脑上设的密码，部署后在线上根本不存在。
 *   2. 于是第一个打开网页的陌生人可以把密码抢注成自己的，
 *      真正的主人反而永远进不去。
 * 解决办法是打包时把凭据烧进发布版（--admin-password）。
 *
 * 本测试用真实 DOM 加载打包产物，模拟「https 域名下的陌生访客」，
 * 逐条确认上面两个坑都已经被填上。
 *
 * 用法：node tools/test-deploy.mjs
 *   （会先自动打包一个带密码的软只读版到 dist-soft/）
 */
import { JSDOM } from 'jsdom';
import { readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PASSWORD = 'xzu-test-password-2025';
const WRONG = 'definitely-not-the-password';
const PAGES_URL = 'https://some-user.github.io/xzu-helper/';

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label); }
}
function section(t) { console.log('\n' + t); }

console.log('══════════════════════════════════════════════');
console.log('部署场景验收：把站点挂到 GitHub Pages 之后');
console.log('══════════════════════════════════════════════');

section('0. 打包带管理员密码的软只读版');
await run('node', ['tools/pack.mjs', '--mode=soft', '--admin-password=' + PASSWORD,
  '--out=dist-soft'], { cwd: root });
const dist = join(root, 'dist-soft');
const html = await readFile(join(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
check('打包产物存在', scripts.length > 0);

/**
 * 模拟一个全新访客：干净的 localStorage、https 域名、所有脚本真实执行。
 * 每次调用都相当于「另一个人用自己的手机打开这个网址」。
 */
async function openAsVisitor() {
  const dom = new JSDOM(html, {
    url: PAGES_URL,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.alert = () => {};
  for (const s of scripts) {
    try { w.eval(await readFile(join(dist, s), 'utf8')); } catch (e) {
      console.log('    脚本执行出错 ' + s + ': ' + e.message);
    }
  }
  await new Promise((r) => setTimeout(r, 30));
  if (w.document.readyState === 'loading') {
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  }
  await new Promise((r) => setTimeout(r, 120));
  return w;
}

section('1. 陌生访客：默认只读');
const stranger = await openAsVisitor();
check('识别为发布模式', stranger.Auth.isPublished() === true);
check('不能编辑 / 上传', stranger.Auth.canEdit() === false);
check('看不到上传按钮', stranger.document.getElementById('doc-admin-actions') === null ||
  stranger.document.getElementById('doc-admin-actions').style.display === 'none');
check('没有「抢注密码」的入口', stranger.Auth.canManagePassword() === false);
// 曾经出过一个 bug：烧入凭据后 canManagePassword() 为 false，
// 而 refresh() 错把它当成「要不要给登录入口」来用，结果发布版连登录按钮都看不见，
// 管理员在线上根本没地方登录。这里钉住这条。
const btn0 = stranger.document.getElementById('auth-btn');
check('登录入口存在且可见（否则管理员线上无法登录）',
  !!btn0 && btn0.style.display !== 'none' && btn0.textContent.indexOf('登录') >= 0);
const badge0 = stranger.document.getElementById('role-badge');
check('未登录时身份标识不是只读/误标', !!badge0 && badge0.textContent.indexOf('管理员') < 0);

section('2. 密码抢注已被堵住（静态站点的经典坑）');
let squatted = false;
try {
  stranger.Auth.setPassword(WRONG);
  squatted = stranger.Auth.canEdit();
} catch (e) {
  squatted = false; // 抛错即正确行为
}
check('陌生人设置密码失败', squatted === false);
check('陌生人仍然是只读', stranger.Auth.canEdit() === false);
let removed = false;
try { stranger.Auth.removePassword(WRONG); removed = true; } catch (e) { removed = false; }
check('陌生人无法删除管理员密码', removed === false);

section('3. 管理员：用打包时设定的密码远程登录');
const admin = await openAsVisitor();
const wrongResult = admin.Auth.login(WRONG);
check('错误密码被拒绝', wrongResult && wrongResult.ok === false);
check('错误密码后仍是只读', admin.Auth.canEdit() === false);
const rightResult = admin.Auth.login(PASSWORD);
check('打包时设定的密码可以登录', rightResult && rightResult.ok === true);
check('登录后获得编辑权限', admin.Auth.canEdit() === true);
check('上传入口出现', (() => {
  const el = admin.document.getElementById('doc-admin-actions');
  return el && el.style.display !== 'none';
})());
check('登录后身份标识显示「管理员」',
  admin.document.getElementById('role-badge').textContent.indexOf('管理员') >= 0);
check('登录后顶栏按钮变为「退出」', (() => {
  const b = admin.document.getElementById('auth-btn');
  return b && b.style.display !== 'none' && b.textContent.indexOf('退出') >= 0;
})());
// 退出按钮必须真的能退出（曾有 refresh() 不执行导致按钮点了没反应的风险）
check('点击「退出」后恢复只读', (() => {
  const b = admin.document.getElementById('auth-btn');
  if (b.onclick) b.onclick();
  return admin.Auth.canEdit() === false &&
    b.textContent.indexOf('登录') >= 0;
})());
check('退出后重新登录仍可用', admin.Auth.login(PASSWORD).ok === true);

section('4. 烧入的密码不可被网页修改（否则会被本地篡改骗过）');
let changed = false;
try { admin.Auth.changePassword(PASSWORD, 'a-brand-new-password'); changed = true; }
catch (e) { changed = false; }
check('无法在网页上改掉烧入的密码', changed === false);
check('改密码失败后旧密码仍可用', admin.Auth.login(PASSWORD).ok === true);

section('5. 另一个人的设备：权限状态互不影响，且凭据一致');
const other = await openAsVisitor();
check('同学那台机器默认只读', other.Auth.canEdit() === false);
check('同学不能用任意密码进入', other.Auth.login(WRONG).ok === false);
check('同学用正确密码也能登录（凭据随站点共享）', other.Auth.login(PASSWORD).ok === true);
check('两个人各自独立：管理员登出不影响同学', (() => {
  admin.Auth.logout();
  return other.Auth.canEdit() === true && admin.Auth.canEdit() === false;
})());

section('6. 发布版不该泄露的东西');
const { stdout: files } = await run('find', [dist, '-type', 'f'], { cwd: root });
const list = files.trim().split('\n').map((f) => f.replace(dist + '/', ''));
check('不含开发文档 README.md', !list.includes('README.md'));
check('不含 package.json', !list.includes('package.json'));
check('不含打包工具 tools/', !list.some((f) => f.startsWith('tools/')));
check('含 .nojekyll（GitHub Pages 必需）', list.includes('.nojekyll'));
const adminJs = await readFile(join(dist, 'js/data/admin.js'), 'utf8');
check('凭据文件里没有明文密码', !adminJs.includes(PASSWORD));
check('凭据文件里确实有 hash', /hash:\s*"[0-9a-f]{64}"/.test(adminJs));

section('7. 子路径部署（用户名.github.io/仓库名/）资源都能加载');
const missing = [];
for (const s of scripts) {
  try { await readFile(join(dist, s), 'utf8'); } catch (e) { missing.push(s); }
}
check('所有脚本都能在相对路径下找到', missing.length === 0);
check('页面里没有绝对路径引用（否则子目录部署会 404）',
  !/(src|href)="\//.test(html));

await rm(dist, { recursive: true, force: true });

console.log('\n' + '─'.repeat(46));
console.log('通过 ' + pass + ' / ' + (pass + fail));
console.log('─'.repeat(46));
process.exit(fail === 0 ? 0 : 1);
