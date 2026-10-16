/**
 * 生成示例数据：js/data/sample-timetable.js、js/data/sample-docs.js
 *
 * ⚠️ 这些是「格式示例」而非真实校方数据：
 *    - 课表用于演示导入/查看/导出流程，课程与教师均为虚构
 *    - 文件中心的条目是占位记录，正文需你放入真实文件
 *
 * 运行：node tools/gen-sample-data.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '..', 'js', 'data');

/* ------------------------------------------------------------ 课表 */

// 节次起止时间（西藏大学作息示意，可在课表设置中调整）
const SECTIONS = [
  { no: 1, start: '08:00', end: '08:45' },
  { no: 2, start: '08:55', end: '09:40' },
  { no: 3, start: '10:00', end: '10:45' },
  { no: 4, start: '10:55', end: '11:40' },
  { no: 5, start: '14:00', end: '14:45' },
  { no: 6, start: '14:55', end: '15:40' },
  { no: 7, start: '16:00', end: '16:45' },
  { no: 8, start: '16:55', end: '17:40' },
  { no: 9, start: '19:00', end: '19:45' },
  { no: 10, start: '19:55', end: '20:40' },
  { no: 11, start: '20:50', end: '21:35' },
  { no: 12, start: '21:45', end: '22:30' }
];

function weeks(a, b, parity) {
  const out = [];
  for (let w = a; w <= b; w++) {
    if (parity === 'odd' && w % 2 === 0) continue;
    if (parity === 'even' && w % 2 === 1) continue;
    out.push(w);
  }
  return out;
}

/** 示例课程（虚构，仅用于演示） */
const COURSES = [
  { name: '高等数学（上）', teacher: '次仁老师', location: '纳金校区 教学楼A-201', weekday: 1, sections: [1, 2], weeks: weeks(1, 16), credit: '5' },
  { name: '大学英语（一）', teacher: '卓玛老师', location: '纳金校区 外语楼B-105', weekday: 1, sections: [3, 4], weeks: weeks(1, 16), credit: '4' },
  { name: '计算机基础', teacher: '李老师', location: '新校区 实验楼C-302', weekday: 1, sections: [5, 6], weeks: weeks(1, 12), credit: '3' },
  { name: '思想道德与法治', teacher: '王老师', location: '纳金校区 教学楼A-108', weekday: 2, sections: [1, 2], weeks: weeks(1, 16), credit: '3' },
  { name: '藏语文基础', teacher: '扎西老师', location: '纳金校区 文科楼D-210', weekday: 2, sections: [3, 4], weeks: weeks(1, 16), credit: '3' },
  { name: '体育（一）', teacher: '张老师', location: '纳金校区 田径场', weekday: 2, sections: [5, 6], weeks: weeks(1, 16), credit: '1' },
  { name: '大学物理', teacher: '刘老师', location: '新校区 实验楼C-201', weekday: 3, sections: [1, 2], weeks: weeks(1, 16), credit: '4' },
  { name: '程序设计基础', teacher: '陈老师', location: '新校区 实验楼C-405', weekday: 3, sections: [3, 4], weeks: weeks(3, 16), credit: '4' },
  { name: '形势与政策', teacher: '赵老师', location: '纳金校区 教学楼A-301', weekday: 3, sections: [9, 10], weeks: weeks(4, 12, 'odd'), credit: '1' },
  { name: '线性代数', teacher: '周老师', location: '纳金校区 教学楼A-202', weekday: 4, sections: [1, 2], weeks: weeks(1, 16), credit: '3' },
  { name: '大学英语（一）', teacher: '卓玛老师', location: '纳金校区 外语楼B-105', weekday: 4, sections: [5, 6], weeks: weeks(1, 16), credit: '4' },
  { name: '物理实验', teacher: '孙老师', location: '新校区 实验楼C-108', weekday: 4, sections: [7, 8], weeks: weeks(5, 16, 'even'), credit: '1' },
  { name: '高等数学（上）', teacher: '次仁老师', location: '纳金校区 教学楼A-201', weekday: 5, sections: [1, 2], weeks: weeks(1, 16), credit: '5' },
  { name: '民族理论与政策', teacher: '马老师', location: '纳金校区 文科楼D-105', weekday: 5, sections: [3, 4], weeks: weeks(1, 12), credit: '2' },
  { name: '专业导论', teacher: '吴老师', location: '新校区 实验楼C-501', weekday: 5, sections: [5, 6], weeks: weeks(1, 8), credit: '1' }
];

const courses = COURSES.map((c, i) => ({
  id: 'sample-' + (i + 1),
  name: c.name,
  teacher: c.teacher,
  location: c.location,
  className: '',
  credit: c.credit,
  note: '',
  weekday: c.weekday,
  sections: { start: c.sections[0], end: c.sections[1] },
  weeks: c.weeks,
  weeksText: (function () {
    const a = c.weeks[0], b = c.weeks[c.weeks.length - 1];
    return c.weeks.length ? a + '-' + b + '周' : '';
  })()
}));

const timetableSample = {
  meta: {
    term: '2025—2026学年 第一学期',
    startDate: '2025-09-01',
    totalWeeks: 18,
    sectionsPerDay: 12,
    source: '示例数据（虚构课程，请替换为你的真实课表）',
    updatedAt: null,
    sectionTimes: SECTIONS
  },
  courses
};

/* --------------------------------------------------------- 文件中心 */

/**
 * 文件条目 schema：
 *   id, title, category, college, year, fileType, size, addedAt, source,
 *   description, tags[], url（外链）| content（内嵌文本）| file（本地导入）
 */
const docsSample = [
  {
    id: 'doc-sample-1',
    title: '推荐免试攻读研究生工作实施办法（示例占位）',
    category: '保研推免',
    college: '全校',
    year: '2025',
    fileType: 'pdf',
    size: 0,
    addedAt: null,
    source: '示例条目',
    description: '占位条目：请用「导入文件」放入教务处发布的正式文件后删除本条。',
    tags: ['推免', '实施办法', '教务处'],
    url: '',
    placeholder: true
  },
  {
    id: 'doc-sample-2',
    title: '本科生综合测评办法（示例占位）',
    category: '评奖评优',
    college: '全校',
    year: '2025',
    fileType: 'pdf',
    size: 0,
    addedAt: null,
    source: '示例条目',
    description: '占位条目：综合测评成绩一般由学业成绩、思想品德、文体活动等部分组成，具体权重以校方文件为准。',
    tags: ['综合测评', '奖学金', '德育'],
    url: '',
    placeholder: true
  },
  {
    id: 'doc-sample-3',
    title: '学生学籍管理规定（示例占位）',
    category: '学籍管理',
    college: '全校',
    year: '2025',
    fileType: 'pdf',
    size: 0,
    addedAt: null,
    source: '示例条目',
    description: '占位条目：含休学、复学、转专业、退学等条款，请以学生手册为准。',
    tags: ['学籍', '转专业', '休学'],
    url: '',
    placeholder: true
  },
  {
    id: 'doc-sample-4',
    title: '校历（示例占位）',
    category: '教学运行',
    college: '全校',
    year: '2025',
    fileType: 'pdf',
    size: 0,
    addedAt: null,
    source: '示例条目',
    description: '占位条目：用于对照课表设置里的「开学日期」和总周数。',
    tags: ['校历', '开学', '考试周'],
    url: '',
    placeholder: true
  },
  {
    id: 'doc-sample-5',
    title: '学生体质健康标准测试安排（示例占位）',
    category: '体测体育',
    college: '全校',
    year: '2025',
    fileType: 'pdf',
    size: 0,
    addedAt: null,
    source: '示例条目',
    description: '占位条目：通常包含测试时间、地点、免测与缓测申请流程。',
    tags: ['体测', '免测', '缓测'],
    url: '',
    placeholder: true
  }
];

/* ------------------------------------------------------------ 输出 */

writeFileSync(join(DATA, 'sample-timetable.js'),
  `/**
 * 示例课表数据（虚构，仅用于演示）
 * ⚠️ 由 tools/gen-sample-data.mjs 生成，请勿手工编辑。
 */
(function (global) {
  'use strict';
  global.SAMPLE_TIMETABLE = ${JSON.stringify(timetableSample, null, 2)};
})(typeof window !== 'undefined' ? window : globalThis);
`, 'utf8');

writeFileSync(join(DATA, 'sample-docs.js'),
  `/**
 * 示例文件条目（占位，仅用于演示分类与预览流程）
 * ⚠️ 由 tools/gen-sample-data.mjs 生成，请勿手工编辑。
 */
(function (global) {
  'use strict';
  global.SAMPLE_DOCS = ${JSON.stringify(docsSample, null, 2)};
})(typeof window !== 'undefined' ? window : globalThis);
`, 'utf8');

console.log('已生成示例数据：');
console.log('  js/data/sample-timetable.js  (' + courses.length + ' 门课程)');
console.log('  js/data/sample-docs.js       (' + docsSample.length + ' 个占位条目)');
