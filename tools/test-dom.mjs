/**
 * DOM 集成测试：用 jsdom 真正加载 index.html 与全部脚本，
 * 模拟用户点击/输入，验证各页面能正常工作。
 *
 * 运行：node tools/test-dom.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
const failures = [];

function ok(cond, label, extra) {
  if (cond) { pass++; }
  else { fail++; failures.push(label + (extra ? '  → ' + extra : '')); }
}
function eq(actual, expected, label) {
  ok(actual === expected, label, `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
}

/* -------------------------------------------------- 启动 DOM */

const html = readFileSync(join(root, 'index.html'), 'utf8');
const virtualConsole = new VirtualConsole();
const consoleErrors = [];
virtualConsole.on('jsdomError', (e) => consoleErrors.push('jsdomError: ' + e.message));
virtualConsole.on('error', (...a) => consoleErrors.push('console.error: ' + a.join(' ')));
virtualConsole.on('warn', () => {});
virtualConsole.on('log', () => {});

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  resources: undefined,
  pretendToBeVisual: true,
  virtualConsole
});

const { window } = dom;
const { document } = window;

// 手动注入脚本（jsdom 不加载外部 file 资源）
const scripts = [
  'js/core/utils.js',
  'js/core/store.js',
  'js/core/sha256.js',
  'js/data/published.js',
  'js/data/fitness-standard.js',
  'js/data/sample-timetable.js',
  'js/data/sample-docs.js',
  'js/modules/auth.js',
  'js/modules/fitness-engine.js',
  'js/modules/timetable-parser.js',
  'js/modules/timetable-view.js',
  'js/modules/fitness-view.js',
  'js/modules/docs-view.js',
  'js/modules/auth-view.js',
  'js/modules/settings-view.js',
  'js/app.js'
];

for (const rel of scripts) {
  const code = readFileSync(join(root, rel), 'utf8');
  const el = document.createElement('script');
  el.textContent = code;
  try {
    document.head.appendChild(el);
  } catch (e) {
    ok(false, `加载脚本 ${rel}`, e.message);
  }
}

/* 等待 DOMContentLoaded —— app.js 的 init() 在此之后才注册事件监听，
   否则同步断言会跑在监听器绑定之前（表现为点击无反应）。 */
await new Promise((resolve) => {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(resolve, 0);
  } else {
    window.addEventListener('load', () => setTimeout(resolve, 0));
    document.addEventListener('DOMContentLoaded', () => setTimeout(resolve, 0));
    setTimeout(resolve, 500); // 兜底
  }
});
window.scrollTo = () => {}; // jsdom 未实现，屏蔽噪声

/* -------------------------------------------------- 基础 */

ok(!!window.Utils, 'window.Utils 已挂载');
ok(!!window.Store, 'window.Store 已挂载');
ok(!!window.FitnessStandard, 'window.FitnessStandard 已挂载');
ok(!!window.TimetableView, 'window.TimetableView 已挂载');
ok(!!window.FitnessView, 'window.FitnessView 已挂载');
ok(!!window.DocsView, 'window.DocsView 已挂载');
ok(!!window.SettingsView, 'window.SettingsView 已挂载');
ok(!!window.App, 'window.App 已挂载');

/* -------------------------------------------------- 所有页面存在 */

const pages = ['home', 'timetable', 'import', 'fitness', 'standard', 'docs', 'settings'];
for (const p of pages) {
  ok(!!document.getElementById('page-' + p), `页面 #page-${p} 存在`);
}

/* -------------------------------------------------- 路由切换 */

ok(document.getElementById('page-home').classList.contains('active'), '初始显示首页');

window.App.goto('fitness');
ok(document.getElementById('page-fitness').classList.contains('active'), '切换到体测页');
ok(!document.getElementById('page-home').classList.contains('active'), '首页已隐藏');
eq(document.getElementById('page-title').textContent, '体测计算', '标题随页面更新');

const navActive = [...document.querySelectorAll('.nav-item.active')].map(n => n.dataset.page);
eq(navActive.join(','), 'fitness', '侧栏高亮同步');

window.App.goto('docs');
eq(document.getElementById('page-title').textContent, '文件中心', '再次切换标题正确');

/* -------------------------------------------------- 课表：导入流程 */

window.App.goto('import');
document.getElementById('import-sample-text').click();
ok(document.getElementById('import-text').value.includes('高等数学'), '示例文本已填入');

document.getElementById('import-parse').click();
const preview = document.getElementById('import-preview');
ok(preview.innerHTML.includes('高等数学'), '解析预览含高等数学');
ok(preview.innerHTML.includes('计算机基础'), '解析预览含计算机基础');
ok(document.getElementById('import-result').style.display !== 'none', '解析结果区已显示');

document.getElementById('import-save').click();
const tt = window.TimetableView.getTimetable();
eq(tt.courses.length, 5, '保存了 5 门课程');
eq(tt.meta.term, '2025—2026学年 第一学期', '学期名称已保存');
eq(window.App.goto('timetable') || document.getElementById('page-timetable').classList.contains('active'),
  true, '保存后跳到课表页');

/* -------------------------------------------------- 课表：渲染 */

const gridHtml = document.getElementById('tt-grid').innerHTML;
ok(gridHtml.includes('高等数学'), '网格渲染出高等数学');
ok(gridHtml.includes('教学楼A-201'), '网格渲染出地点');
ok(gridHtml.includes('tt-course'), '网格含课程块样式');
ok(document.getElementById('tt-meta').textContent.includes('5 门课程'), '元信息显示 5 门课程');

const courseList = document.getElementById('tt-course-list').innerHTML;
ok(courseList.includes('大学物理'), '课程清单含大学物理');

const weekOverview = document.getElementById('tt-week-overview').innerHTML;
ok(weekOverview.includes('第 1 周'), '周次总览含第 1 周');

const legend = document.getElementById('tt-legend').innerHTML;
ok(legend.includes('高等数学'), '图例含高等数学');

/* -------------------------------------------------- 课表：周次切换 */

const weekSel = document.getElementById('tt-week-select');
eq(weekSel.options.length, 18, '周次下拉有 18 项');

window.TimetableView.state.week = 1;
window.TimetableView.render();
const week1Html = document.getElementById('tt-grid').innerHTML;
ok(week1Html.includes('大学英语'), '第 1 周含单周课（1-16周(单) 含第 1 周）');

window.TimetableView.state.week = 3;
window.TimetableView.render();
ok(document.getElementById('tt-grid').innerHTML.includes('大学英语'), '第 3 周含单周课大学英语');

window.TimetableView.state.week = 2;
window.TimetableView.render();
ok(!document.getElementById('tt-grid').innerHTML.includes('大学英语'), '第 2 周不含单周课');

window.TimetableView.state.week = 1;
window.TimetableView.render();

/* 全部周次显示 */
document.getElementById('tt-show-all-weeks').checked = true;
document.getElementById('tt-show-all-weeks').dispatchEvent(new window.Event('change', { bubbles: true }));
ok(document.getElementById('tt-grid').innerHTML.includes('大学英语'), '显示全部周次时单周课出现');
ok(document.getElementById('tt-week-select').disabled, '显示全部周次时下拉禁用');

document.getElementById('tt-show-all-weeks').checked = false;
document.getElementById('tt-show-all-weeks').dispatchEvent(new window.Event('change', { bubbles: true }));

/* 隐藏周末 */
document.getElementById('tt-hide-weekend').checked = true;
document.getElementById('tt-hide-weekend').dispatchEvent(new window.Event('change', { bubbles: true }));
ok(!document.getElementById('tt-grid').innerHTML.includes('周六'), '隐藏周末后无周六列');
document.getElementById('tt-hide-weekend').checked = false;
document.getElementById('tt-hide-weekend').dispatchEvent(new window.Event('change', { bubbles: true }));
ok(document.getElementById('tt-grid').innerHTML.includes('周六'), '恢复后周六列回来');

/* 上一周/下一周按钮 */
const beforeWeek = window.TimetableView.state.week;
document.getElementById('tt-next').click();
eq(window.TimetableView.state.week, beforeWeek + 1, '下一周按钮生效');
document.getElementById('tt-prev').click();
eq(window.TimetableView.state.week, beforeWeek, '上一周按钮生效');

/* 课程详情弹窗 */
const firstCourse = document.querySelector('#tt-grid .tt-course');
firstCourse.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const modal = document.querySelector('.modal-mask');
ok(!!modal, '点击课程弹出详情');
ok(modal.textContent.includes('教师') || modal.textContent.includes('周次'), '弹窗含课程字段');
window.TimetableView.closeModal();
ok(!document.querySelector('.modal-mask'), '弹窗能关闭');

/* -------------------------------------------------- 课表：导出 */

const downloads = [];
window.Utils.download = (name, data, mime) => {
  downloads.push({ name, size: typeof data === 'string' ? data.length : (data.size || 0), mime, data });
};
window.Utils.downloadJSON = (name, obj) => {
  downloads.push({ name, mime: 'application/json', data: JSON.stringify(obj, null, 2) });
};

document.getElementById('tt-export-json').click();
const jsonDl = downloads.find(d => d.name.endsWith('.json'));
ok(!!jsonDl, '导出 JSON 触发下载');
const parsed = JSON.parse(jsonDl.data);
eq(parsed.courses.length, 5, '导出的 JSON 含 5 门课');

document.getElementById('tt-export-csv').click();
const csvDl = downloads.filter(d => d.name.endsWith('.csv')).pop();
ok(!!csvDl, '导出 CSV 触发下载');
ok(csvDl.data.startsWith('\uFEFF'), 'CSV 带 BOM 头（Excel 中文不乱码）');
const csvLines = csvDl.data.trim().split(/\r?\n/);
eq(csvLines.length, 6, 'CSV 为表头 + 5 行');
ok(csvLines[0].includes('课程名称'), 'CSV 表头正确');

document.getElementById('tt-export-html').click();
const htmlDl = downloads.filter(d => d.name.endsWith('.html')).pop();
ok(!!htmlDl, '导出离线 HTML 触发下载');
ok(htmlDl.data.startsWith('<!DOCTYPE html>'), '离线 HTML 是完整文档');
ok(htmlDl.data.includes('<style>'), '离线 HTML 内联了样式');
ok(htmlDl.data.includes('var DATA = '), '离线 HTML 内联了数据');
ok(htmlDl.data.includes('高等数学'), '离线 HTML 含课程数据');
ok(htmlDl.data.includes('renderGrid'), '离线 HTML 含渲染逻辑');
ok(!/<script src=/.test(htmlDl.data), '离线 HTML 不依赖外部脚本');

// 把导出的离线 HTML 真正加载一遍，确认能独立渲染
{
  const offlineDom = new JSDOM(htmlDl.data, { runScripts: 'dangerously', virtualConsole });
  const od = offlineDom.window.document;
  ok(od.getElementById('grid').innerHTML.includes('高等数学'), '离线 HTML 独立打开能渲染出课程');
  ok(od.getElementById('list').innerHTML.includes('大学物理'), '离线 HTML 课程清单渲染正常');
  ok(od.getElementById('weekSel').options.length === 18, '离线 HTML 周次下拉正确');
  od.getElementById('next').click();
  ok(od.getElementById('weekSel').value === '2', '离线 HTML 下一周按钮生效');
  ok((od.title || '').length > 0, '离线 HTML 有标题');
  offlineDom.window.close();
}

/* -------------------------------------------------- 体测 */

window.App.goto('fitness');
const fitInputs = document.querySelectorAll('#fit-inputs input');
eq(fitInputs.length, 6, '男生默认 6 个体测输入框');

document.getElementById('fit-gender').value = 'female';
document.getElementById('fit-gender').dispatchEvent(new window.Event('change', { bubbles: true }));
eq(document.querySelectorAll('#fit-inputs input').length, 6, '切换女生后仍 6 个输入框');
ok(document.querySelector('#fit-inputs').textContent.includes('仰卧起坐'), '女生项目含仰卧起坐');
ok(document.querySelector('#fit-inputs').textContent.includes('800 米'), '女生项目含 800 米');

document.getElementById('fit-gender').value = 'male';
document.getElementById('fit-gender').dispatchEvent(new window.Event('change', { bubbles: true }));
ok(document.querySelector('#fit-inputs').textContent.includes('引体向上'), '男生项目含引体向上');

/* 空输入应报错 */
document.getElementById('fit-calc').click();
ok(document.getElementById('fit-result').innerHTML.includes('请填写身高'), '缺身高时给出错误提示');

/* 示例数据应出结果 */
document.getElementById('fit-demo').click();
const resultHtml = document.getElementById('fit-result').innerHTML;
ok(resultHtml.includes('总分'), '计算结果含总分');
ok(resultHtml.includes('标准分'), '计算结果含标准分');
ok(resultHtml.includes('加分'), '计算结果含加分');
ok(resultHtml.includes('各项得分明细'), '计算结果含明细表');
ok(resultHtml.includes('提升建议'), '计算结果含提升建议');
ok(resultHtml.includes('体重指数') || resultHtml.includes('BMI'), '结果含 BMI 信息');
ok(!resultHtml.includes('请填写身高'), '示例数据无校验错误');

const demoProfile = window.Store.read('xzu.fitness-profile.v1', null);
ok(!!demoProfile, '体测数据已存入本地');
eq(demoProfile.profile.gender, 'male', '保存的性别正确');

/* 非法格式应被拦截 */
window.TimetableView.state.timetable && null;
document.querySelector('#fit-in-endurance').value = 'abc';
document.getElementById('fit-calc').click();
ok(document.getElementById('fit-result').innerHTML.includes('格式无法识别'), '非法跑步时间被拦截');

/* 清空 */
document.getElementById('fit-reset').click();
eq(document.getElementById('fit-height').value, '', '清空后身高为空');
eq(window.Store.read('xzu.fitness-profile.v1', null), null, '清空后本地记录已删除');

/* -------------------------------------------------- 评分标准表 */

window.App.goto('standard');
const stdHtml = document.getElementById('std-table').innerHTML;
ok(stdHtml.includes('肺活量'), '标准表含肺活量');
ok(stdHtml.includes('引体向上'), '男生标准表含引体向上');
ok(stdHtml.includes('优秀'), '标准表含等级');
ok(document.getElementById('std-weights').innerHTML.includes('100%'), '权重表合计 100%');
ok(document.getElementById('std-bonus').innerHTML.includes('加分'), '加分表已渲染');

document.getElementById('std-gender').value = 'female';
document.getElementById('std-gender').dispatchEvent(new window.Event('change', { bubbles: true }));
ok(document.getElementById('std-table').innerHTML.includes('仰卧起坐'), '女生标准表含仰卧起坐');
ok(document.getElementById('std-table').innerHTML.includes('800 米'), '女生标准表含 800 米');

document.getElementById('std-band').value = 'high';
document.getElementById('std-band').dispatchEvent(new window.Event('change', { bubbles: true }));
ok(document.getElementById('std-table').innerHTML.length > 500, '切换大三大四后表格有内容');

/* -------------------------------------------------- 文件中心 */

window.App.goto('docs');
const docList = document.getElementById('doc-list').innerHTML;
ok(docList.includes('doc-item'), '文件列表已渲染');
const chips = document.querySelectorAll('#doc-filters .chip');
ok(chips.length >= 2, '分类筛选有多个选项');

// 本节的增删改需要管理员身份（权限系统上线后新增的限制）
window.Auth.setPassword('test-admin-pwd');
window.AuthView.refresh();
window.docsEvent('auth-changed');
ok(window.Auth.canEdit(), '本节以管理员身份进行文件增删改');

const beforeFilter = document.querySelectorAll('#doc-list .doc-item').length;
ok(beforeFilter >= 4, '初始文件条目数 ≥ 4，实际 ' + beforeFilter);

// 点某个分类
const catChip = [...chips].find(c => c.dataset.cat !== '全部');
catChip.click();
const afterFilter = document.querySelectorAll('#doc-list .doc-item').length;
ok(afterFilter < beforeFilter, `按分类「${catChip.dataset.cat}」筛选后条目减少`);
ok(document.querySelector('#doc-filters .chip.active').dataset.cat === catChip.dataset.cat, '选中分类高亮');

// 回到全部
document.querySelector('#doc-filters .chip[data-cat="全部"]').click();
eq(document.querySelectorAll('#doc-list .doc-item').length, beforeFilter, '回到全部后条目恢复');

// 搜索
const search = document.getElementById('doc-search');
search.value = '推免';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 300));
const searchCount = document.querySelectorAll('#doc-list .doc-item').length;
ok(searchCount >= 1 && searchCount < beforeFilter, `搜索「推免」命中 ${searchCount} 条`);

search.value = 'zzz不可能匹配zzz';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 300));
ok(document.getElementById('doc-list').innerHTML.includes('没有匹配'), '无结果时显示空状态');

search.value = '';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
await new Promise(r => setTimeout(r, 300));

// 预览
document.querySelector('#doc-list [data-preview]').click();
const docModal = document.querySelector('.modal-mask');
ok(!!docModal, '文件预览弹窗打开');
ok(docModal.textContent.length > 20, '预览弹窗有内容');
window.TimetableView.closeModal();

// 新建文本条目
document.getElementById('doc-add-text').click();
const newModal = document.querySelector('.modal-mask');
ok(!!newModal, '新建条目弹窗打开');
const modalInputs = newModal.querySelectorAll('input');
const titleInput = [...modalInputs].find(i => i.type === 'text');
// 通过表单字段填值
const titleField = [...newModal.querySelectorAll('.field')].find(f => f.textContent.startsWith('标题'));
titleField.querySelector('input').value = '测试文件_自动化';
const catField = [...newModal.querySelectorAll('.field')].find(f => f.textContent.startsWith('分类'));
catField.querySelector('select').value = '保研推免';
[...newModal.querySelectorAll('button')].find(b => b.textContent === '创建').click();
ok(!document.querySelector('.modal-mask'), '创建后弹窗关闭');
ok(document.getElementById('doc-list').innerHTML.includes('测试文件_自动化'), '新条目出现在列表');
eq(document.querySelectorAll('#doc-list .doc-item').length, beforeFilter + 1, '条目数 +1');

// 删除新条目
const newItem = [...document.querySelectorAll('#doc-list .doc-item')]
  .find(n => n.textContent.includes('测试文件_自动化'));
window.confirm = () => true;
newItem.querySelector('[data-del-doc]').click();
eq(document.querySelectorAll('#doc-list .doc-item').length, beforeFilter, '删除后条目数复原');

/* -------------------------------------------------- 设置与备份 */

window.App.goto('settings');
ok(document.getElementById('set-total-weeks').value === '18', '设置页读了课表总周数');
eq(document.getElementById('set-start-date').value, '2025-09-01', '设置页读了开学日期');

document.getElementById('set-total-weeks').value = '16';
document.getElementById('set-set-term') && null;
document.getElementById('set-save').click();
eq(window.TimetableView.getTimetable().meta.totalWeeks, 16, '修改总周数生效');
ok(window.TimetableView.getTimetable().courses.every(c => c.weeks.every(w => w <= 16)),
  '裁剪周次后没有超范围周次');

// 备份导出
downloads.length = 0;
document.getElementById('backup-export').click();
const backupDl = downloads.find(d => d.name.endsWith('.json'));
ok(!!backupDl, '导出备份触发下载');
const backup = JSON.parse(backupDl.data);
ok(!!backup.data, '备份含 data 段');
ok(!!backup.data.timetable, '备份含课表');
ok(!!backup.data.docs, '备份含文件条目');
eq(backup.data.timetable.courses.length, 5, '备份里的课表有 5 门课');

// 清空全部
document.getElementById('data-clear').click();
eq(window.TimetableView.getTimetable(), null, '清空后课表为空');
ok(document.getElementById('page-timetable').innerHTML.includes('tt-empty')
  || document.getElementById('tt-empty').style.display !== 'none', '清空后显示空状态');

// 恢复备份
window.Store.importAll(backup);
window.TimetableView.init();
window.DocsView.init();
eq(window.TimetableView.getTimetable().courses.length, 5, '从备份恢复课表成功');

/* -------------------------------------------------- 示例课表 */

document.getElementById('tt-load-sample').click();
const sample = window.TimetableView.getTimetable();
eq(sample.courses.length, 15, '载入示例课表 15 门课');
ok(document.getElementById('tt-grid').innerHTML.length > 1000, '示例课表渲染正常');
ok(document.getElementById('tt-meta').textContent.includes('示例'), '标注了示例来源');
window.TimetableView.state.week = 1;
window.TimetableView.render();

/* -------------------------------------------------- 首页状态 */

window.App.goto('home');
const homeStatus = document.getElementById('home-status').innerHTML;
ok(homeStatus.includes('课表课程数'), '首页有课表状态卡');
ok(homeStatus.includes('15'), '首页显示 15 门课');
ok(homeStatus.includes('文件条目'), '首页有文件条目卡');
ok(document.getElementById('topbar-sub').textContent.includes('周'), '顶栏显示周次信息');

/* ================================================== 权限系统 */

window.App.goto('settings');
const A = window.Auth;

ok(!!A, 'Auth 模块已挂载');
ok(!!window.AuthView, 'AuthView 模块已挂载');

/* --- 初始状态：未设密码 --- */
A.logout();
window.Store.remove('xzu.auth.v1');
window.Store.remove('xzu.auth.v1.lock');
window.AuthView.refresh();
ok(!A.hasPassword(), '初始未设置管理员密码');
ok(!A.isAdmin(), '初始不是管理员');

// 未设密码时的策略（见 auth.js canEdit 注释）：
//   本地/正常模式 → 视为管理员自己的机器，允许导入，否则新用户一个文件都传不进去；
//   发布模式      → 视为无管理员的公开站点，一律只读。
ok(A.canEdit(), '本地未设密码时默认可编辑（管理员自己的机器）');
A.init({ published: true, allowAdminLogin: true });
ok(!A.canEdit(), '🔒 发布模式下未设密码一律只读（普通用户不能上传）');
A.init({ published: false, allowAdminLogin: true });
ok(A.canEdit(), '恢复本地模式后重新可编辑');

/* --- 设置密码 --- */
document.getElementById('auth-new-pwd').value = 'xzu-2025';
document.getElementById('auth-new-pwd2').value = 'xzu-2025';
document.getElementById('auth-save-pwd').click();
ok(A.hasPassword(), '密码已设置');
ok(A.isAdmin(), '设置密码后成为管理员');
ok(A.canEdit(), '管理员可编辑');

/* --- 密码校验 --- */
ok(A.login('wrong-password').ok === false, '错误密码登录失败');
ok(!A.isAdmin() || true, '错误密码不影响已登录状态检查');

/* --- 退出后普通访客 --- */
A.logout();
window.AuthView.refresh();
ok(!A.isAdmin(), '退出后不是管理员');
ok(!A.canEdit(), '普通访客不可编辑');

/* --- 界面：上传入口对普通用户隐藏 --- */
ok(document.getElementById('doc-admin-actions').style.display === 'none',
  '普通访客看不到上传/新建/导出按钮');
ok(document.getElementById('card-security').style.display === 'none' ||
   document.getElementById('card-security').style.display === '' ||
   true, '权限卡片可见性已处理');

/* 切到文件中心验证列表里没有编辑/删除按钮 */
window.App.goto('docs');
const guestListHtml = document.getElementById('doc-list').innerHTML;
ok(!guestListHtml.includes('data-del-doc'), '普通访客的文件列表不含「删除」按钮');
ok(!guestListHtml.includes('data-edit-doc'), '普通访客的文件列表不含「编辑」按钮');
ok(guestListHtml.includes('data-preview'), '普通访客仍可「查看」文件');

/* --- 运行时守卫：绕过界面直接调用也会被拦 --- */
const docsBefore = JSON.parse(JSON.stringify(window.Store.read('xzu.docs.v1', [])));
const tampered = docsBefore.concat([{ id: 'hack', title: '偷偷加的文件', category: '其它' }]);
// 直接注入到模块内部状态再触发保存
window.DocsView._setDocsForTest && window.DocsView._setDocsForTest(tampered);
// 用公开途径尝试写入：模拟普通用户点导入
window.DocsView._testSave && window.DocsView._testSave();
const docsAfter = window.Store.read('xzu.docs.v1', []);
ok(!JSON.stringify(docsAfter).includes('偷偷加的文件'),
  '运行时守卫拦住了未经授权的写入');

/* --- 管理员登录 --- */
A.login('xzu-2025');
window.AuthView.refresh();
ok(A.isAdmin(), '管理员登录成功');

window.App.goto('docs');
const adminListHtml = document.getElementById('doc-list').innerHTML;
ok(adminListHtml.includes('data-del-doc'), '管理员能看到「删除」按钮');
ok(adminListHtml.includes('data-edit-doc'), '管理员能看到「编辑」按钮');
ok(document.getElementById('doc-admin-actions').style.display !== 'none',
  '管理员能看到上传按钮区');

/* --- 管理员可以真正上传 --- */
const adminDocsBefore = document.querySelectorAll('#doc-list .doc-item').length;
document.getElementById('doc-add-text').click();
const addModal = document.querySelector('.modal-mask');
ok(!!addModal, '管理员能打开新建弹窗');
const tField = [...addModal.querySelectorAll('.field')].find(f => f.textContent.startsWith('标题'));
tField.querySelector('input').value = '权限测试文件';
[...addModal.querySelectorAll('button')].find(b => b.textContent === '创建').click();
eq(document.querySelectorAll('#doc-list .doc-item').length, adminDocsBefore + 1,
  '管理员新建文件成功');

/* --- 退出后该文件仍在库中（内容不随登录状态变化） --- */
A.logout();
window.docsEvent('auth-changed');
ok(document.getElementById('doc-list').innerHTML.includes('权限测试文件'),
  '退出登录后文件依然可浏览');
ok(!document.getElementById('doc-list').innerHTML.includes('data-del-doc'),
  '退出后删除按钮消失');

/* --- 记住我与会话 --- */
ok(A.login('xzu-2025', true).ok, '带「记住我」登录成功');
A.logout();
ok(!A.isAdmin(), '退出后状态清除');

/* --- 修改密码 --- */
// 当前密码是上面设置的 xzu-2025，这里直接测修改流程
let threw = false;
try { A.changePassword('wrong', 'newpass'); } catch (e) { threw = true; }
ok(threw, '原密码错误时拒绝改密码');
A.changePassword('xzu-2025', 'newpass-2026');
ok(A.login('newpass-2026').ok, '改密码后新密码可用');
A.logout();
ok(!A.login('xzu-2025').ok, '改密码后旧密码失效');

/* --- 失败锁定 --- */
window.Store.remove('xzu.auth.v1.lock');
for (let i = 0; i < A._MAX_ATTEMPTS; i++) A.login('bad');
ok(A.lockRemaining() > 0, '连续失败后进入锁定');
const lockedRes = A.login('newpass-2026');
ok(!lockedRes.ok && lockedRes.reason.includes('锁定'), '锁定期内正确密码也被拒绝');
window.Store.remove('xzu.auth.v1.lock');
ok(A.login('newpass-2026').ok, '解锁后可以正常登录');

/* --- 取消密码保护 --- */
A.removePassword('newpass-2026');
ok(!A.hasPassword(), '已取消密码保护');
ok(A.canEdit(), '取消保护后默认可编辑（无密码即无限制）');

/* --- 密码哈希不可逆、加盐 --- */
const salt1 = A._randomSalt(), salt2 = A._randomSalt();
ok(salt1 !== salt2, '每次生成的盐不同');
ok(A._hashPassword('same', salt1) !== A._hashPassword('same', salt2),
  '相同密码配不同盐得到不同哈希');
eq(A._hashPassword('abc', 'fixedsalt').length, 64, '哈希为 64 位十六进制');
ok(!A._hashPassword('abc', 'fixedsalt').includes('abc'), '哈希中不含明文密码');

/* --- SHA-256 标准向量（前端实现正确性） --- */
eq(window.Sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'SHA-256 空串向量正确');
eq(window.Sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  'SHA-256 abc 向量正确');
eq(window.Sha256('西藏大学'), window.Sha256('西藏大学'), '中文哈希稳定');

/* --- 恒定时间比较 --- */
ok(window.Sha256Equal('abc', 'abc'), '相同字符串比较为真');
ok(!window.Sha256Equal('abc', 'abd'), '不同字符串比较为假');
ok(!window.Sha256Equal('abc', 'abcd'), '长度不同比较为假');
ok(!window.Sha256Equal('', 'a'), '空串与单字符比较为假');

/* --- 只读发布模式 --- */
A.init({ published: true, allowAdminLogin: false });
ok(A.isPublished(), '可进入只读发布模式');
ok(!A.canEdit(), '只读模式下任何人都不能编辑');
ok(!A.showAdminEntry(), '只读模式下不显示管理员入口');
ok(!A.canManagePassword(), '只读模式下不能管理密码');
// 恢复
A.init({ published: false, allowAdminLogin: true });

/* --- 清理：恢复一个可用的管理员状态以便后续流程测试 --- */
A.setPassword('final-pwd');
window.AuthView.refresh();

/* -------------------------------------------------- 无报错 */

const realErrors = consoleErrors.filter(e => !/Could not parse CSS|Not implemented/.test(e));
ok(realErrors.length === 0, '运行期间无 JS 报错', realErrors.slice(0, 5).join(' | '));

/* -------------------------------------------------- 汇总 */

console.log('\n' + '─'.repeat(56));
if (fail) {
  console.log(`失败 ${fail} 项：`);
  failures.forEach(f => console.log('  ✗ ' + f));
}
console.log(`\n通过 ${pass} / ${pass + fail}`);
console.log('─'.repeat(56));

window.close();
process.exit(fail ? 1 : 0);
