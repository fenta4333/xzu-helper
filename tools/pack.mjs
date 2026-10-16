/**
 * 只读发布版打包工具
 *
 * 背景：本站在浏览器里跑，没有服务端。所以「只有管理员能上传」如果只是在界面上
 * 把按钮藏起来，懂技术的人打开 DevTools 就能绕过。真正可靠的做法是：
 *   把要发给普通用户的站点，做成**物理上不含上传功能**的版本。
 *
 * 本工具提供两档：
 *
 *   node tools/pack.mjs                 → 软只读：带管理员登录入口，可现场维护
 *   node tools/pack.mjs --hard          → 硬只读：彻底删除管理员登录/密码模块，
 *                                          连校验函数都不存在，任何人都无法上传
 *   node tools/pack.mjs --hard --docs=数据包.json
 *                                       → 同时把管理员准备好的文件库烧进发布版
 *   node tools/pack.mjs --mode=soft --admin-password=你的密码
 *                                       → 把管理员密码的哈希烧进发布版，
 *                                         这样部署到 GitHub Pages 后你在任何设备
 *                                         都能登录维护，别人也无法抢注密码
 *
 * 输出目录：dist/（可直接整个拷贝给同学，双击 index.html 就能用）
 */
import { readFile, writeFile, mkdir, rm, cp, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, isAbsolute } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function flag(name) {
  return args.includes('--' + name);
}
function option(name) {
  const hit = args.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : null;
}

// 同时支持 --hard / --soft 和 --mode=hard / --mode=soft 两种写法。
// （某些受限 shell 环境会把单独的 --hard 当自己的参数吞掉，用 --mode= 更稳）
const MODE = option('mode');
if (MODE && !['hard', 'soft'].includes(MODE)) {
  console.error('✗ --mode 只能是 hard 或 soft，收到：' + MODE);
  process.exit(1);
}
const HARD = flag('hard') || MODE === 'hard';
const SOFT = flag('soft') || MODE === 'soft';
const DOCS_PACK = option('docs');
const OUT = option('out') || 'dist';
const ADMIN_PASSWORD = option('admin-password');

if (HARD && SOFT) {
  console.error('✗ --hard 与 --soft 不能同时使用');
  process.exit(1);
}

// 硬只读版连密码校验模块都删掉了，烧密码没有意义，属于用错参数
if (HARD && ADMIN_PASSWORD) {
  console.error('✗ --hard 版不含管理员登录功能，不能用 --admin-password');
  console.error('  想远程登录维护，请用：--mode=soft --admin-password=你的密码');
  process.exit(1);
}

// 密码太短等于没有。静态站点的 hash 是公开的，短密码可被离线暴破。
if (ADMIN_PASSWORD && ADMIN_PASSWORD.length < 10) {
  console.error('✗ 管理员密码至少 10 位');
  console.error('  原因：发布版里的密码哈希是公开的，短密码能被离线暴力破解。');
  console.error('  建议用一句自己能记住的长口令，例如「xzu-baoyan-2025-教务处」。');
  process.exit(1);
}

const readonlyMode = true; // pack 出来的都是只读版

/* ------------------------------------------------------------- 工具 */

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // 不进入发布版的内容：
      //   tools/    开发工具（生成器、测试、打包脚本本身），还引用了 jsdom 等开发依赖
      //   docs/ files/  管理员自己放资料的地方
      //   .git 等   版本控制
      if (['node_modules', 'dist', 'dist-soft', 'tools', '.git', 'docs', 'files', '.github']
        .includes(entry.name)) continue;
      out.push(...await walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/* --------------------------------------------------- 硬只读：剥离代码 */

/**
 * 从 app.js 中移除管理员界面的初始化调用。
 * 注意：这里不是简单地注释掉，而是让 AuthView.init 不再被引用，
 * 配合下面把 auth-view.js / auth.js 整个文件从发布版删掉，
 * 发布版里就不存在任何上传相关的代码路径。
 */
function stripAdminFromApp(code) {
  let out = code;

  // 移除 AuthView 初始化
  out = out.replace(/^\s*global\.AuthView\.init\(\);\s*$/gm, '');
  // 移除 AuthView.refresh 调用
  out = out.replace(/^\s*global\.AuthView\.refresh\(\);\s*$/gm, '');
  // 移除 Auth.init
  out = out.replace(/^\s*\/\/ 权限先初始化.*\n/gm, '');
  out = out.replace(/^\s*global\.Auth\.init\(\);\s*$/gm, '');

  return out;
}

/**
 * 删除带指定标记的整个 DOM 区块。
 * 用标签深度计数找配对的 </div>，而不是靠正则去猜结尾 ——
 * 卡片里有嵌套 div，正则非贪婪匹配会截断，贪婪匹配又会吃过头。
 */
function removeElement(html, startPattern) {
  const m = startPattern.exec(html);
  if (!m) return html;

  const openTagEnd = html.indexOf('>', m.index);
  if (openTagEnd === -1) return html;

  // 判断是不是自闭合（本项目里不会出现，稳妥起见还是判一下）
  if (html[openTagEnd - 1] === '/') {
    return html.slice(0, m.index) + html.slice(openTagEnd + 1);
  }

  const tagName = (m[0].match(/<(\w+)/) || [, 'div'])[1];
  const openRe = new RegExp('<' + tagName + '\\b', 'gi');
  const closeRe = new RegExp('</' + tagName + '\\s*>', 'gi');

  let depth = 0;
  let i = m.index;
  let end = -1;

  while (i < html.length) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const nextOpen = openRe.exec(html);
    const nextClose = closeRe.exec(html);

    if (!nextClose) break;

    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      i = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      i = nextClose.index + nextClose[0].length;
      if (depth <= 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) return html;
  return html.slice(0, m.index) + html.slice(end);
}

/**
 * 从 index.html 中移除管理员专属的 DOM 与脚本引用。
 */
function stripAdminFromHtml(html) {
  let out = html;

  // 1. 删掉所有 admin-only 卡片（权限设置卡、发布卡）
  out = removeElement(out, /<div class="card admin-only" id="card-security"/);
  out = removeElement(out, /<div class="card admin-only" id="card-publish"/);

  // 2. 删掉顶栏的管理员登录按钮
  out = out.replace(/[ \t]*<button class="btn btn-sm" id="auth-btn"[^>]*><\/button>\r?\n?/g, '');

  // 3. 删掉文件中心的「管理员登录」按钮
  out = out.replace(/[ \t]*<button class="btn btn-sm" id="doc-admin-login"[^>]*>[^<]*<\/button>\r?\n?/g, '');

  // 4. 删掉上传/新建/导出按钮区
  out = removeElement(out, /<span class="admin-only" id="doc-admin-actions"/);

  // 5. 只读提示条默认可见。
  // 正常版里这行是 display:none，由 AuthView 在只读模式下改成显示；
  // 但硬只读版把 AuthView 删掉了，若不动它，访问者就完全看不到任何提示。
  out = out.replace(
    /<div class="readonly-bar" id="readonly-bar" style="display:none">/,
    '<div class="readonly-bar" id="readonly-bar">'
  );
  out = out.replace(
    /<span id="readonly-text"><\/span>/,
    '<span id="readonly-text">本站为只读浏览版本：文件由管理员统一整理发布，' +
    '你可以自由查阅、搜索和预览，但无法上传或修改内容。</span>'
  );

  // 6. 移除管理员脚本引用
  out = out.replace(/[ \t]*<script src="js\/modules\/auth-view\.js"><\/script>\r?\n?/g, '');
  out = out.replace(/[ \t]*<script src="js\/modules\/auth\.js"><\/script>\r?\n?/g, '');
  out = out.replace(/[ \t]*<script src="js\/core\/sha256\.js"><\/script>\r?\n?/g, '');

  return out;
}

/**
 * 从 docs-view.js 中移除管理员操作代码。
 * 该文件里所有写操作都需要 Auth，硬只读版把它们替换为直接拒绝。
 */
function stripAdminFromDocsView(code) {
  let out = code;

  // 把权限判断替换为常量 false —— 发布版里没有任何东西能让它变成 true
  out = out.replace(
    /function guard\(action\) \{[\s\S]*?\n  \}/,
    `function guard(action) {
    // 只读发布版：不提供任何写入能力
    if (global.Utils && global.Utils.toast) {
      global.Utils.toast('本站为只读发布版，文件由管理员统一维护', 'warn');
    }
    console.warn('[readonly] 已拦截写操作：' + (action || 'unknown'));
    return false;
  }`
  );
  out = out.replace(/function guard2\(\) \{[\s\S]*?\n  \}/, `function guard2() {
    return false;
  }`);
  // save() 里的 Auth 检查换成「永远拒绝」。
  // 注意：这里只保留一个替换。若先删掉整段（含注释）再替换，第二个正则会找不到目标，
  // 结果 save() 变成无保护写入 —— 实测被只读验收测试抓到过。
  out = out.replace(
    /    if \(auth\(\) && !auth\(\)\.canEdit\(\)\) \{[\s\S]*?\n    \}\n/,
    `    // 只读发布版：文件库永远不可写
    console.warn('[readonly] 已拦截保存操作');
    return false;
`
  );
  // 上面留下的原写入代码已经执行不到，直接整段替换掉更干净
  out = out.replace(
    /    return false;\n    var ok = Store\.write\(Store\.KEYS\.docs, state\.docs\);\n    if \(ok\) global\.dispatchEvent\(new CustomEvent\('xzu:data-changed'\)\);\n    return ok;\n/,
    '    return false;\n'
  );
  out = out.replace(/function auth\(\) \{ return global\.Auth; \}/, 'function auth() { return null; }');

  return out;
}

/**
 * 从 settings-view.js 中移除「发布给同学」相关的绑定。
 * 硬只读版里 #card-publish 及它的按钮已经不存在，如果还留着 addEventListener，
 * U.$(...) 会返回 null，init() 直接抛错，整个站点打不开 —— 实测踩到的坑。
 */
function stripAdminFromSettingsView(code) {
  let out = code;

  // 移除 pack-export-docs / pack-copy-cmd 两段绑定
  out = out.replace(
    /\n\s*\/\/ ---- 发布：导出文件数据包[\s\S]*?\n    \}\);\n/,
    '\n'
  );
  out = out.replace(
    /\n    U\.\$\('#pack-copy-cmd'\)\.addEventListener\('click', function \(\) \{[\s\S]*?\n    \}\);\n/,
    '\n'
  );

  // 移除对 #card-publish 的显隐控制
  out = out.replace(
    /\n    var pubCard = U\.\$\('#card-publish'\);\n    if \(pubCard\) \{[\s\S]*?\n    \}\n/,
    '\n'
  );

  return out;
}

/* ------------------------------------------------------- 文档数据包 */

/**
 * 文档数据包格式：
 * { app, type:'xzu-docs-pack', packedAt, docs:[...] }
 * 由管理员在设置页「导出文件数据包」生成。
 */
async function loadDocsPack(path) {
  const raw = await readFile(path, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error('数据包不是合法 JSON：' + e.message);
  }
  if (!data || !Array.isArray(data.docs)) {
    throw new Error('数据包格式不正确，应包含 docs 数组');
  }
  return data;
}

/* ------------------------------------------------------------- 主流程 */

async function main() {
  // 绝对路径直接用，相对路径才相对项目根目录解析。
  // 不判断的话 --out=/tmp/x 会被拼成 <项目>/tmp/x，往项目里塞出一坨残留。
  const outDir = isAbsolute(OUT) ? OUT : join(root, OUT);

  console.log('\n📦 打包只读发布版');
  console.log('   模式：' + (HARD ? '硬只读（无任何上传能力）' : '软只读（保留管理员登录）'));

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // 复制静态资源
  const files = await walk(root);
  let copied = 0;

  // 发布版不需要的开发文件。README 里写了管理员密码流程和打包命令，
  // package.json 只有 npm 脚本有意义 —— 都不该出现在发给同学的目录里。
  const EXCLUDE_FILES = new Set(['README.md', 'package.json', 'package-lock.json', '.gitignore']);

  for (const file of files) {
    const rel = relative(root, file);
    if (rel.startsWith('dist/')) continue;
    if (EXCLUDE_FILES.has(rel)) continue;

    let content = await readFile(file);

    // 只处理文本类型的源文件，其他（图片等）直接拷贝
    const isText = /\.(js|html|css|json|md|txt)$/i.test(rel);

    if (isText && HARD) {
      let text = content.toString('utf8');

      if (rel === 'js/app.js') text = stripAdminFromApp(text);
      if (rel === 'index.html') text = stripAdminFromHtml(text);
      if (rel === 'js/modules/docs-view.js') text = stripAdminFromDocsView(text);
      if (rel === 'js/modules/settings-view.js') text = stripAdminFromSettingsView(text);

      // 硬只读版直接不产出这些文件
      if (['js/modules/auth.js', 'js/modules/auth-view.js', 'js/core/sha256.js'].includes(rel)) {
        console.log('   ✂ 已移除管理员模块：' + rel);
        continue;
      }

      content = Buffer.from(text, 'utf8');
    } else if (isText && rel === 'index.html') {
      // 软只读：保留管理员登录，但仍标明只读模式
      let text = content.toString('utf8');
      text = text.replace(/<span class="topbar-sub" id="topbar-sub"><\/span>/,
        '<span class="topbar-sub" id="topbar-sub"></span>');
      content = Buffer.from(text, 'utf8');
    }

    const dest = join(outDir, rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, content);
    copied++;
  }
  console.log('   ✓ 复制 ' + copied + ' 个文件');

  // 写入发布模式配置
  const publishedConfig = `/**
 * 发布模式配置（由 tools/pack.mjs 自动生成）
 * 打包时间：${new Date().toISOString()}
 */
window.XZU_PUBLISHED = {
  mode: 'readonly',
  allowAdminLogin: ${HARD ? 'false' : 'true'},
  hard: ${HARD ? 'true' : 'false'},
  packedAt: ${JSON.stringify(new Date().toISOString())},
  note: ${JSON.stringify(HARD
    ? '硬只读发布版：不含任何上传/编辑/删除功能，文件由管理员统一维护'
    : '软只读发布版：普通访问者只读，管理员可登录后维护')}
};
`;
  await writeFile(join(outDir, 'js/data/published.js'), publishedConfig, 'utf8');
  console.log('   ✓ 写入只读模式配置');

  // 烧入管理员凭据
  //
  // 为什么必须烧：localStorage 是每个浏览器各自的，密码不会跟着网站走。
  // 不烧的话，部署到 GitHub Pages 后（1）你在别的设备上登录不了，
  // （2）第一个打开页面的陌生人可以把密码抢注成自己的。
  if (ADMIN_PASSWORD) {
    // 与 js/modules/auth.js 保持一致：sha256(salt + '::' + password + '::xzu-helper')
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256')
      .update(salt + '::' + ADMIN_PASSWORD + '::xzu-helper', 'utf8')
      .digest('hex');

    const adminConfig = `/**
 * 管理员凭据（由 tools/pack.mjs 自动生成，请勿手工编辑）
 * 打包时间：${new Date().toISOString()}
 *
 * 存的是加盐 SHA-256，不含明文。但它随网站公开，
 * 所以密码本身必须足够长，否则可被离线暴破。
 */
window.XZU_ADMIN = {
  salt: ${JSON.stringify(salt)},
  hash: ${JSON.stringify(hash)},
  bakedAt: ${JSON.stringify(new Date().toISOString())}
};
`;
    await writeFile(join(outDir, 'js/data/admin.js'), adminConfig, 'utf8');
    console.log('   ✓ 烧入管理员凭据（可用 --admin-password 指定的密码远程登录）');
  } else if (!HARD) {
    console.log('   ⚠ 未烧入管理员凭据：线上将无法登录维护，且密码可能被他人抢注');
    console.log('     如需远程维护，请加：--admin-password=你的长密码');
  }

  // GitHub Pages 默认跑 Jekyll，会忽略某些文件并可能改变目录结构。
  // 放一个 .nojekyll 让它按普通静态站点直接发布。
  await writeFile(join(outDir, '.nojekyll'), '', 'utf8');
  console.log('   ✓ 写入 .nojekyll（GitHub Pages 必需）');

  // 烧入文档数据包
  if (DOCS_PACK) {
    // 绝对路径直接使用；相对路径才相对项目根目录解析。
    // 之前一律 join(root, ...)，传绝对路径会被拼成 /root/1/xzu-helper/tmp/... 而报 ENOENT。
    const packPath = isAbsolute(DOCS_PACK) ? DOCS_PACK : join(root, DOCS_PACK);
    const pack = await loadDocsPack(packPath);
    const bootstrap = `/**
 * 预置文件库（由 tools/pack.mjs 从数据包烧入）
 * 生成时间：${new Date().toISOString()}
 * 条目数：${pack.docs.length}
 *
 * 这些是管理员准备好的文件，普通用户打开即可浏览，无需导入。
 * 若用户本地已有自己的文件库，以本地为准（见 docs-view.js 的 load()）。
 */
window.XZU_BUNDLED_DOCS = ${JSON.stringify(pack.docs, null, 0)};
`;
    await writeFile(join(outDir, 'js/data/bundled-docs.js'), bootstrap, 'utf8');
    console.log('   ✓ 烧入文件数据包：' + pack.docs.length + ' 条');

    // 在 index.html 中插入该脚本（放在 docs-view.js 之前）
    const indexPath = join(outDir, 'index.html');
    let html = await readFile(indexPath, 'utf8');
    if (!html.includes('js/data/bundled-docs.js')) {
      html = html.replace('<script src="js/modules/docs-view.js"></script>',
        '<script src="js/data/bundled-docs.js"></script>\n<script src="js/modules/docs-view.js"></script>');
      await writeFile(indexPath, html, 'utf8');
    }
  }

  // 校验硬只读版确实不含敏感代码
  let verify = [];
  if (HARD) {
    const checks = [
      ['index.html', ['doc-add-file', 'doc-add-text', 'auth-btn', 'card-security', 'auth-view.js']],
      ['js/app.js', ['AuthView', 'Auth.init']]
    ];
    for (const [file, needles] of checks) {
      let text;
      try {
        text = await readFile(join(outDir, file), 'utf8');
      } catch {
        continue;
      }
      for (const needle of needles) {
        if (text.includes(needle)) verify.push(`${file} 仍包含 "${needle}"`);
      }
    }
    // 这些文件必须不存在
    for (const f of ['js/modules/auth.js', 'js/modules/auth-view.js', 'js/core/sha256.js']) {
      try {
        await stat(join(outDir, f));
        verify.push('仍存在管理员模块：' + f);
      } catch { /* 不存在才是对的 */ }
    }

    // 结构性校验：JS 里 U.$('#xxx') 引用的元素必须都在 HTML 里存在。
    // 剥离管理员 DOM 时最容易犯的错就是「HTML 删了、JS 还绑着」，
    // 那样 U.$() 返回 null，init() 抛错，用户看到的是一片空白。
    const htmlText = await readFile(join(outDir, 'index.html'), 'utf8');
    const htmlIds = new Set([...htmlText.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

    // 这些元素是脚本运行时动态创建的，HTML 里本来就没有，不算问题
    const RUNTIME_IDS = new Set(['toast']);
    const jsDir = join(outDir, 'js');
    for (const file of await walk(jsDir)) {
      const text = await readFile(file, 'utf8');
      // 只检查「直接对结果调用方法」这种写法：U.$('#x').addEventListener(...)
      // 如果结果先赋给变量并做了存在性判断，就是安全的，不该报错。
      for (const m of text.matchAll(/\$\('#([a-zA-Z0-9_-]+)'\)\s*\./g)) {
        if (!htmlIds.has(m[1]) && !RUNTIME_IDS.has(m[1])) {
          verify.push(relative(outDir, file) + ' 直接操作了不存在的元素 #' + m[1]);
        }
      }
    }
  }

  console.log('\n✅ 打包完成：' + OUT + '/');
  if (HARD) {
    console.log(verify.length
      ? '⚠ 校验发现问题：\n   - ' + verify.join('\n   - ')
      : '   ✓ 校验通过：发布版中不含任何上传/管理员代码');
  }
  console.log('\n   分发方式：把 ' + OUT + '/ 整个目录拷给同学，双击 index.html 即可使用');
  console.log('   也可以部署到任意静态空间（GitHub Pages / 对象存储 / 校园网）\n');

  if (HARD && verify.length) process.exit(1);
}

main().catch((e) => {
  console.error('\n✗ 打包失败：' + e.message);
  process.exit(1);
});
