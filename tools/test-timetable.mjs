/**
 * 课表解析器测试
 * 运行：node tools/test-timetable.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const P = require(join(__dirname, '..', 'js', 'modules', 'timetable-parser.js'));

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + '\n      期望 ' + JSON.stringify(expected) + '\n      实际 ' + JSON.stringify(actual)); }
}
function group(n) { console.log('\n' + n); }

/* ------------------------------------------------------------ 周次 */
group('周次解析');
eq(P.parseWeeks('1-16周', 20).weeks.length, 16, '1-16周 -> 16 周');
eq(P.parseWeeks('1-16周', 20).weeks[0], 1, '起始为第 1 周');
eq(P.parseWeeks('1-16周', 20).weeks[15], 16, '结束为第 16 周');
eq(P.parseWeeks('1-16周(单)', 20).weeks, [1, 3, 5, 7, 9, 11, 13, 15], '单周');
eq(P.parseWeeks('1-16周(双)', 20).weeks, [2, 4, 6, 8, 10, 12, 14, 16], '双周');
eq(P.parseWeeks('1,3,5周', 20).weeks, [1, 3, 5], '枚举周次');
eq(P.parseWeeks('1-4,7-9周', 20).weeks, [1, 2, 3, 4, 7, 8, 9], '多段区间');
eq(P.parseWeeks('第3-5周', 20).weeks, [3, 4, 5], '带「第」字');
eq(P.parseWeeks('1—4周', 20).weeks, [1, 2, 3, 4], '全角破折号');
eq(P.parseWeeks('1-30周', 20).weeks.length, 20, '超出总周数被截断');
eq(P.parseWeeks('', 20).weeks, [], '空字符串 -> 空');
eq(P.parseWeeks('17-18周', 16).weeks, [], '超出范围 -> 空');

group('周次格式化');
eq(P.formatWeeks([1, 2, 3, 4, 5, 6], 20), '1-6周', '连续区间');
eq(P.formatWeeks([1, 3, 5, 7], 20), '1,3,5,7周(单)', '单周识别');
eq(P.formatWeeks([2, 4, 6], 20), '2,4,6周(双)', '双周识别');
eq(P.formatWeeks([1, 2, 5, 6], 20), '1-2,5-6周', '两段区间');

/* ------------------------------------------------------------ 节次 */
group('节次解析');
eq(P.parseSections('1-2节'), { start: 1, end: 2 }, '1-2节');
eq(P.parseSections('第3-4节'), { start: 3, end: 4 }, '第3-4节');
eq(P.parseSections('5'), { start: 5, end: 5 }, '单节');
eq(P.parseSections('3-4'), { start: 3, end: 4 }, '纯数字区间');
eq(P.parseSections('上午1-2节'), { start: 1, end: 2 }, '带「上午」');
eq(P.parseSections('1,2节'), { start: 1, end: 2 }, '逗号分隔');
eq(P.parseSections('4-3节'), { start: 3, end: 4 }, '逆序自动纠正');
eq(P.parseSections(''), null, '空 -> null');
eq(P.parseSections('abc'), null, '非法 -> null');

/* ------------------------------------------------------------ 星期 */
group('星期解析');
eq(P.parseWeekday('周一'), 1, '周一');
eq(P.parseWeekday('星期三'), 3, '星期三');
eq(P.parseWeekday('礼拜天'), 7, '礼拜天');
eq(P.parseWeekday('星期日'), 7, '星期日');
eq(P.parseWeekday('周7'), 7, '周7');
eq(P.parseWeekday('5'), 5, '数字 5');
eq(P.parseWeekday('Mon'), 1, 'Mon');
eq(P.parseWeekday('THU'), 4, 'THU');
eq(P.parseWeekday('乱七八糟'), null, '无法识别 -> null');

/* --------------------------------------------------------- CSV 导入 */
group('CSV 导入（中文表头）');
const csv = [
  '课程名称,教师,星期,节次,周次,上课地点',
  '高等数学,张伟,周一,1-2节,1-16周,教学楼A101',
  '大学英语,李娜,周三,3-4节,1-16周(单),外语楼B203',
  '计算机导论,王强,周五,5-6节,1-8周,实验楼C305'
].join('\n');
const r1 = P.parseAuto(csv, { totalWeeks: 20 });
eq(r1.courses.length, 3, '解析出 3 门课');
eq(r1.courses[0].name, '高等数学', '课程名正确');
eq(r1.courses[0].teacher, '张伟', '教师正确');
eq(r1.courses[0].weekday, 1, '星期正确');
eq(r1.courses[0].sections, { start: 1, end: 2 }, '节次正确');
eq(r1.courses[0].weeks.length, 16, '周次正确');
eq(r1.courses[0].location, '教学楼A101', '地点正确');
eq(r1.courses[1].weeks, [1, 3, 5, 7, 9, 11, 13, 15], '单周课正确');
eq(r1.errors.length, 0, '无错误');

group('CSV 导入（英文表头）');
const csvEn = [
  'name,teacher,weekday,sections,weeks,location',
  'Linear Algebra,Smith,2,3-4,1-8,Building D'
].join('\n');
const r2 = P.parseAuto(csvEn, { totalWeeks: 20 });
eq(r2.courses.length, 1, '英文表头解析成功');
eq(r2.courses[0].weekday, 2, '英文星期');
eq(r2.courses[0].name, 'Linear Algebra', '英文课程名');

group('TSV 导入');
const tsv = '课程\t教师\t星期\t节次\t周次\t地点\n体育\t赵敏\t周二\t3-4节\t1-16周\t操场';
const r3 = P.parseAuto(tsv, { totalWeeks: 20 });
eq(r3.courses.length, 1, 'TSV 解析成功');
eq(r3.courses[0].location, '操场', 'TSV 地点');

group('无表头 CSV（按位置猜列）');
const noHeader = '离散数学,陈刚,周四,1-2节,1-16周,理科楼301';
const r4 = P.parseAuto(noHeader, { totalWeeks: 20 });
eq(r4.courses.length, 1, '无表头也能解析');
eq(r4.courses[0].name, '离散数学', '位置推断课程名');
eq(r4.warnings.length > 0, true, '给出提示');

/* --------------------------------------------------------- 块文本 */
group('块文本导入（课程表 App 常见格式）');
const block = [
  '大学物理',
  '刘洋',
  '1-16周',
  '1-2节',
  '周一',
  '综合楼D401',
  '',
  '线性代数',
  '孙丽',
  '1-8周',
  '3-4节',
  '周三',
  '教学楼B102'
].join('\n');
const r5 = P.parseAuto(block, { totalWeeks: 20 });
eq(r5.courses.length, 2, '块文本解析出 2 门课');
eq(r5.courses[0].name, '大学物理', '第一门课程名');
eq(r5.courses[0].teacher, '刘洋', '第一门教师');
eq(r5.courses[0].weekday, 1, '第一门星期');
eq(r5.courses[0].location, '综合楼D401', '第一门地点');
eq(r5.courses[1].name, '线性代数', '第二门课程名');

/* ---------------------------------------------------------- JSON */
group('JSON 导入（本站格式）');
const json = JSON.stringify({
  meta: { term: '2025-2026学年第一学期', totalWeeks: 18 },
  courses: [
    { name: '数据结构', teacher: '周杰', weekday: 2, sections: { start: 1, end: 2 }, weeks: [1, 2, 3, 4, 5], location: '计算机楼201' }
  ]
});
const r6 = P.parseAuto(json);
eq(r6.courses.length, 1, 'JSON 解析成功');
eq(r6.courses[0].name, '数据结构', 'JSON 课程名');
eq(r6.courses[0].weeksText, '1-5周', '周次文本生成');

group('JSON 导入（宽松格式：字符串星期/节次）');
const looseJson = JSON.stringify([
  { name: '思政', teacher: '马老师', weekday: '周五', sections: '3-4节', weeks: '1-16周' }
]);
const r7 = P.parseAuto(looseJson, { totalWeeks: 20 });
eq(r7.courses.length, 1, '宽松 JSON 解析成功');
eq(r7.courses[0].weekday, 5, '字符串星期被转换');

/* --------------------------------------------------------- 错误处理 */
group('错误处理');
eq(P.parseAuto('', {}).courses.length, 0, '空内容 -> 无课程');
eq(P.parseAuto('', {}).errors.length > 0, true, '空内容给出错误');
eq(P.parseAuto('{bad json', {}).errors.length > 0, true, '坏 JSON 给出错误');
const badRows = ['课程名称,星期,节次', ',周一,1-2节'].join('\n');
eq(P.parseAuto(badRows, {}).errors.length, 1, '缺课程名报错');
const badWeekday = ['课程名称,星期,节次', '高数,不知道,1-2节'].join('\n');
eq(P.parseAuto(badWeekday, {}).errors.length, 1, '非法星期报错');

/* ------------------------------------------------------- 模型功能 */
group('课表模型：冲突检测');
const tt = P.createTimetable({ totalWeeks: 20 });
tt.courses = [
  { id: 'a', name: 'A课', weekday: 1, sections: { start: 1, end: 2 }, weeks: [1, 2], location: '' },
  { id: 'b', name: 'B课', weekday: 1, sections: { start: 2, end: 3 }, weeks: [2, 3], location: '' },
  { id: 'c', name: 'C课', weekday: 1, sections: { start: 5, end: 6 }, weeks: [1, 2], location: '' }
];
const conflicts = P.findConflicts(tt);
eq(conflicts.length > 0, true, '检出时段冲突');
eq(conflicts[0].week, 2, '冲突发生在第 2 周');
eq([conflicts[0].a.id, conflicts[0].b.id].sort().join(''), 'ab', '冲突课程为 A 与 B');
eq(conflicts.every(c => !(c.a.id === 'c' || c.b.id === 'c')), true, '不误报不冲突的课程');

group('课表模型：某周某天课程');
eq(P.coursesAt(tt, 1, 1).length, 2, '第 1 周周一有 2 门');
eq(P.coursesAt(tt, 1, 3).length, 1, '第 3 周周一有 1 门');
eq(P.coursesAt(tt, 2, 1).length, 0, '第 1 周周二无课');

group('课表模型：教学周推算');
eq(P.currentWeek({ startDate: '2025-09-01', totalWeeks: 20 }, new Date('2025-09-01T12:00:00')), 1, '开学当天为第 1 周');
eq(P.currentWeek({ startDate: '2025-09-01', totalWeeks: 20 }, new Date('2025-09-08T12:00:00')), 2, '开学次周为第 2 周');
eq(P.currentWeek({ startDate: '2025-09-01', totalWeeks: 20 }, new Date('2025-09-10T12:00:00')), 2, '第 2 周中间');
eq(P.currentWeek({ startDate: '2025-09-01', totalWeeks: 20 }, new Date('2026-03-01T12:00:00')), 20, '超出总周数被截断');
eq(P.currentWeek({ totalWeeks: 20 }, new Date()), 1, '未设开学日期 -> 第 1 周');

group('课表校验与规范化');
const fixMe = { courses: [{ name: 'X', weekday: '周一', sections: '3-4节', weeks: '1-5周' }] };
const v = P.validateTimetable(fixMe);
eq(v.ok, true, '校验通过');
eq(fixMe.courses[0].weekday, 1, '星期被规范化');
eq(fixMe.courses[0].weeksText, '1-5周', '周次文本补齐');
eq(fixMe.courses[0].id !== undefined, true, '自动补 id');
eq(P.validateTimetable(null).ok, false, '空数据校验失败');

console.log('\n──────────────────────────────');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
