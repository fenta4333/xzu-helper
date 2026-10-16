/**
 * 课表解析器
 *
 * 支持多种常见导入格式，全部本地解析：
 *   1. JSON（本站导出的格式）
 *   2. CSV / TSV（表头自动识别，中英文均可）
 *   3. 粘贴文本（每行一门课，逗号/制表符/多空格分隔）
 *   4. 课程表类 App 的「教师/地点/周次」分行文本
 *
 * 纯逻辑，可在 Node 下测试。
 */
(function (global) {
  'use strict';

  var WEEKDAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  var WEEKDAY_FULL = ['', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

  /* ------------------------------------------------------------ 周次 */

  /**
   * 解析周次字符串
   * 支持："1-16周"、"1-16"、"1,3,5"、"1-8,10-16"、"1-16周(单)"、"1-16周(双)"、"单周"、"双周"
   * @returns {{weeks:number[], odd:boolean, even:boolean}}
   */
  function parseWeeks(input, totalWeeks) {
    totalWeeks = totalWeeks || 20;
    var result = { weeks: [], odd: false, even: false };
    if (input === null || input === undefined || input === '') return result;

    var s = String(input).trim();
    var odd = /单周|\(单\)|（单）|奇数周/.test(s);
    var even = /双周|\(双\)|（双）|偶数周/.test(s);
    result.odd = odd;
    result.even = even;

    // 去掉中文与修饰词，只留下数字、逗号、连字符
    s = s.replace(/第/g, '')
      .replace(/周|星期/g, ',')
      .replace(/\(单\)|（单）|\(双\)|（双）|单周|双周/g, '')
      .replace(/[，、;；]/g, ',')
      .replace(/[－—–~～]/g, '-')
      .replace(/\s/g, '');

    var set = {};
    s.split(',').forEach(function (part) {
      if (!part) return;
      var range = part.match(/^(\d+)-(\d+)$/);
      if (range) {
        var a = parseInt(range[1], 10), b = parseInt(range[2], 10);
        if (a > b) { var t = a; a = b; b = t; }
        for (var i = a; i <= b; i++) {
          if (i >= 1 && i <= totalWeeks) set[i] = true;
        }
        return;
      }
      var single = part.match(/^(\d+)$/);
      if (single) {
        var n = parseInt(single[1], 10);
        if (n >= 1 && n <= totalWeeks) set[n] = true;
      }
    });

    var weeks = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    if (odd) weeks = weeks.filter(function (w) { return w % 2 === 1; });
    if (even) weeks = weeks.filter(function (w) { return w % 2 === 0; });
    result.weeks = weeks;
    return result;
  }

  /** 周次数组 -> 紧凑字符串 */
  function formatWeeks(weeks, totalWeeks) {
    if (!weeks || !weeks.length) return '';
    var arr = weeks.slice().sort(function (a, b) { return a - b; });
    var parts = [], start = arr[0], prev = arr[0];
    for (var i = 1; i <= arr.length; i++) {
      var cur = arr[i];
      if (cur === prev + 1) { prev = cur; continue; }
      parts.push(start === prev ? String(start) : start + '-' + prev);
      start = prev = cur;
    }
    var text = parts.join(',') + '周';
    // 判断是否单双周
    if (arr.length > 1 && arr.every(function (w) { return w % 2 === 1; })) text = parts.join(',') + '周(单)';
    else if (arr.length > 1 && arr.every(function (w) { return w % 2 === 0; })) text = parts.join(',') + '周(双)';
    return text;
  }

  /* ------------------------------------------------------------ 节次 */

  /**
   * 解析节次
   * 支持："1-2节"、"第3-4节"、"3-4"、"5"、"1,2节"、"上午1-2节"
   * @returns {{start:number, end:number}|null}
   */
  function parseSections(input) {
    if (input === null || input === undefined || input === '') return null;
    var s = String(input).trim()
      .replace(/第/g, '').replace(/节/g, '').replace(/[，、;；]/g, ',')
      .replace(/[－—–~～]/g, '-')
      .replace(/上午|下午|晚上|早上/g, '')
      .replace(/\s/g, '');
    if (!s) return null;

    var range = s.match(/^(\d+)-(\d+)$/);
    if (range) {
      var a = parseInt(range[1], 10), b = parseInt(range[2], 10);
      if (a > b) { var t = a; a = b; b = t; }
      return { start: a, end: b };
    }
    var list = s.split(',').filter(Boolean).map(Number).filter(function (n) { return !isNaN(n); });
    if (list.length >= 2) {
      return { start: Math.min.apply(null, list), end: Math.max.apply(null, list) };
    }
    var single = parseInt(s, 10);
    if (!isNaN(single)) return { start: single, end: single };
    return null;
  }

  /* ------------------------------------------------------------ 星期 */

  function parseWeekday(input) {
    if (input === null || input === undefined || input === '') return null;
    var s = String(input).trim();
    var map = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7,
      'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6, 'sun': 7
    };
    var cn = s.match(/^(?:星期|周|礼拜)\s*([一二三四五六日天])$/);
    if (cn) return map[cn[1]];
    var en = s.match(/^(mon|tue|wed|thu|fri|sat|sun)/i);
    if (en) return map[en[1].toLowerCase()];
    var num = s.match(/^[1-7]$/);
    if (num) return parseInt(s, 10);
    // "星期1" 之类
    var mixed = s.match(/^(?:星期|周|礼拜)\s*([1-7])$/);
    if (mixed) return parseInt(mixed[1], 10);
    return null;
  }

  /* ------------------------------------------------------- 表头识别 */

  var HEADER_ALIASES = {
    name: ['课程名称', '课程名', '课程', 'name', 'course', '科目', '教学班名称'],
    teacher: ['教师', '老师', '任课教师', '授课教师', 'teacher', '教师姓名'],
    location: ['上课地点', '地点', '教室', 'location', 'room', '场地'],
    weekday: ['星期', '周几', 'weekday', 'day', '上课星期'],
    sections: ['节次', '时间', '上课时间', '节', 'sections', 'period', '上课节次'],
    weeks: ['周次', '上课周次', 'weeks', '教学周', '周数', '起止周'],
    className: ['班级', '教学班', 'class', '上课班级'],
    credit: ['学分', 'credit'],
    note: ['备注', 'note', '说明', '备注信息']
  };

  function detectHeader(cells) {
    var map = {};
    cells.forEach(function (raw, idx) {
      var c = String(raw || '').trim().toLowerCase().replace(/\s/g, '');
      if (!c) return;
      Object.keys(HEADER_ALIASES).forEach(function (field) {
        if (map[field] !== undefined) return;
        var hit = HEADER_ALIASES[field].some(function (alias) {
          return c === alias || c.indexOf(alias) >= 0;
        });
        if (hit) map[field] = idx;
      });
    });
    return map;
  }

  /* ------------------------------------------------------ 记录构建 */

  /**
   * 构建课程记录
   * @param {object} raw {name, teacher, location, weekday, sections, weeks, ...}
   */
  function buildCourse(raw, opts) {
    opts = opts || {};
    var warnings = [];
    var name = String(raw.name || '').trim();
    if (!name) return { error: '缺少课程名称' };

    var weekday = parseWeekday(raw.weekday);
    if (!weekday) return { error: '无法识别星期：' + raw.weekday };

    var sections = parseSections(raw.sections);
    if (!sections) return { error: '无法识别节次：' + raw.sections };

    var wk = parseWeeks(raw.weeks, opts.totalWeeks);
    if (!wk.weeks.length) {
      warnings.push('未识别到周次，默认按 1-' + (opts.totalWeeks || 20) + ' 周处理');
      for (var i = 1; i <= (opts.totalWeeks || 20); i++) wk.weeks.push(i);
    }

    return {
      course: {
        id: raw.id || ('c' + Math.random().toString(36).slice(2, 9)),
        name: name,
        teacher: String(raw.teacher || '').trim(),
        location: String(raw.location || '').trim(),
        className: String(raw.className || '').trim(),
        credit: raw.credit ? String(raw.credit).trim() : '',
        note: String(raw.note || '').trim(),
        weekday: weekday,
        sections: sections,
        weeks: wk.weeks,
        weeksText: formatWeeks(wk.weeks)
      },
      warnings: warnings
    };
  }

  /* ------------------------------------------------------ 文本解析 */

  /** 从二维数组（CSV 已切分）解析 */
  function fromRows(rows, opts) {
    opts = opts || {};
    var courses = [], errors = [], warnings = [];
    if (!rows.length) return { courses: courses, errors: ['内容为空'], warnings: warnings };

    var headerMap = detectHeader(rows[0]);
    var hasHeader = Object.keys(headerMap).length >= 2;
    var dataRows = hasHeader ? rows.slice(1) : rows;

    if (!hasHeader) {
      // 无表头：按位置猜测 课程,教师,星期,节次,周次,地点
      headerMap = { name: 0, teacher: 1, weekday: 2, sections: 3, weeks: 4, location: 5 };
      warnings.push('未识别到表头，按「课程,教师,星期,节次,周次,地点」顺序解析');
    }

    dataRows.forEach(function (row, i) {
      var raw = {};
      Object.keys(headerMap).forEach(function (field) {
        raw[field] = row[headerMap[field]];
      });
      var res = buildCourse(raw, opts);
      if (res.error) {
        errors.push('第 ' + (i + 1 + (hasHeader ? 1 : 0)) + ' 行：' + res.error);
      } else {
        courses.push(res.course);
        res.warnings.forEach(function (w) {
          warnings.push('第 ' + (i + 1 + (hasHeader ? 1 : 0)) + ' 行：' + w);
        });
      }
    });

    return { courses: courses, errors: errors, warnings: warnings };
  }

  /** 解析 CSV/TSV 文本 */
  function parseCSVText(text, opts) {
    opts = opts || {};
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    var rows = lines.map(function (line) {
      // 优先按制表符，其次逗号
      if (line.indexOf('\t') >= 0) return line.split('\t');
      return splitCSVLine(line);
    });
    return fromRows(rows, opts);
  }

  function splitCSVLine(line) {
    var out = [], field = '', inQuote = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (inQuote) {
        if (c === '"') {
          if (line[i + 1] === '"') { field += '"'; i++; }
          else inQuote = false;
        } else field += c;
      } else {
        if (c === '"') inQuote = true;
        else if (c === ',') { out.push(field); field = ''; }
        else field += c;
      }
    }
    out.push(field);
    return out;
  }

  /**
   * 解析「课程表 App」常见的分行块文本
   * 形如：
   *   高等数学
   *   张三
   *   1-16周
   *   1-2节
   *   教学楼A101
   */
  function parseBlockText(text, opts) {
    opts = opts || {};
    // 保留空行：空行是最可靠的块分隔符
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); });
    var courses = [], errors = [], warnings = [];
    var cur = {};
    var pendingWarn = [];

    function isComplete(c) {
      return !!(c.name && c.weekday && c.sections && c.weeks);
    }

    function flush() {
      if (!Object.keys(cur).length) return;
      var res = buildCourse(cur, opts);
      if (res.error) errors.push('「' + (cur.name || '未命名') + '」：' + res.error);
      else {
        courses.push(res.course);
        res.warnings.forEach(function (w) { pendingWarn.push(w); });
      }
      cur = {};
    }

    lines.forEach(function (line) {
      if (line === '') { flush(); return; }   // 空行切块

      var isWeeks = /^\d+\s*[-~至—–]\s*\d+\s*周/.test(line) || /^第?\d+.*周/.test(line);
      var isSections = /节/.test(line) && /\d/.test(line);
      var isWeekday = /^(星期|周|礼拜)/.test(line) && /[一二三四五六日天1-7]/.test(line);
      var isLocation = /楼|教室|馆|场|室|Room|room|操场|中心/.test(line);

      // 块信息已齐全，又遇到一行不属于任何字段的文本 -> 视为下一门课的开始
      if (isComplete(cur) && !isWeeks && !isSections && !isWeekday && !isLocation) {
        flush();
      }

      if (isWeeks) cur.weeks = line;
      else if (isSections) cur.sections = line;
      else if (isWeekday) cur.weekday = line;
      else if (isLocation) cur.location = line;
      else if (!cur.name) cur.name = line;
      else if (!cur.teacher) cur.teacher = line;
      else cur.note = (cur.note ? cur.note + ' ' : '') + line;
    });
    flush();

    pendingWarn.forEach(function (w) { warnings.push(w); });
    return { courses: courses, errors: errors, warnings: warnings };
  }

  /* ------------------------------------------------------ 统一入口 */

  /**
   * 自动识别格式并解析
   * @param {string} text 原始文本
   * @param {object} opts {totalWeeks}
   */
  function parseAuto(text, opts) {
    opts = opts || {};
    var trimmed = String(text || '').trim();
    if (!trimmed) return { courses: [], errors: ['内容为空'], warnings: [], format: 'empty' };

    // JSON
    if (trimmed[0] === '{' || trimmed[0] === '[') {
      try {
        var json = JSON.parse(trimmed);
        return fromJSON(json, opts);
      } catch (e) {
        return { courses: [], errors: ['JSON 格式错误：' + e.message], warnings: [], format: 'json' };
      }
    }

    // 含分隔符且首行像表头 -> CSV
    var firstLine = trimmed.split(/\r?\n/)[0];
    var looksTabular = (firstLine.indexOf('\t') >= 0 || firstLine.indexOf(',') >= 0);
    if (looksTabular) {
      var csvRes = parseCSVText(trimmed, opts);
      csvRes.format = 'csv';
      if (csvRes.courses.length) return csvRes;
      // CSV 失败则回退块文本
    }

    var blockRes = parseBlockText(trimmed, opts);
    blockRes.format = 'block';
    if (!blockRes.courses.length && looksTabular) {
      var retry = parseCSVText(trimmed, opts);
      retry.format = 'csv';
      return retry;
    }
    return blockRes;
  }

  /** 从 JSON 对象解析（本站格式或宽松格式） */
  function fromJSON(json, opts) {
    opts = opts || {};
    var courses = [], errors = [], warnings = [];
    var meta = {};

    // 本站导出格式
    if (json && json.courses && Array.isArray(json.courses)) {
      meta = json.meta || {};
      var totalWeeks = meta.totalWeeks || opts.totalWeeks || 20;
      json.courses.forEach(function (c, i) {
        if (!c || !c.name) { errors.push('第 ' + (i + 1) + ' 门课程缺少名称'); return; }
        var weekday = parseWeekday(c.weekday) || c.weekday;
        var sections = (typeof c.sections === 'object' && c.sections)
          ? c.sections
          : parseSections(c.sections);
        if (!weekday || !sections) {
          errors.push('「' + c.name + '」缺少可识别的星期或节次');
          return;
        }
        var weeks = Array.isArray(c.weeks) ? c.weeks.slice() : parseWeeks(c.weeks, totalWeeks).weeks;
        courses.push({
          id: c.id || ('c' + (i + 1)),
          name: String(c.name),
          teacher: c.teacher || '',
          location: c.location || '',
          className: c.className || '',
          credit: c.credit || '',
          note: c.note || '',
          weekday: Number(weekday),
          sections: { start: Number(sections.start), end: Number(sections.end) },
          weeks: weeks,
          weeksText: formatWeeks(weeks)
        });
      });
      return { courses: courses, errors: errors, warnings: warnings, meta: meta, format: 'json' };
    }

    // 数组格式
    if (Array.isArray(json)) {
      // 对象数组：直接构造，避免走表头识别（字段名会被误判成表头）
      if (json.length && typeof json[0] === 'object' && !Array.isArray(json[0])) {
        json.forEach(function (o, i) {
          var res = buildCourse({
            id: o.id,
            name: o.name || o.课程名称 || o.课程,
            teacher: o.teacher || o.教师 || o.老师,
            location: o.location || o.地点 || o.教室 || o.上课地点,
            weekday: o.weekday || o.星期 || o.周几,
            sections: o.sections || o.节次 || o.时间,
            weeks: o.weeks || o.周次,
            className: o.className || o.班级,
            credit: o.credit || o.学分,
            note: o.note || o.备注
          }, opts);
          if (res.error) errors.push('第 ' + (i + 1) + ' 项：' + res.error);
          else courses.push(res.course);
        });
        return { courses: courses, errors: errors, warnings: warnings, format: 'json' };
      }
      // 二维数组：走表头识别
      return fromRows(json, opts);
    }

    return { courses: [], errors: ['无法识别的 JSON 结构'], warnings: [], format: 'json' };
  }

  /* ------------------------------------------------------ 课表模型 */

  /** 创建空课表 */
  function createTimetable(meta) {
    return {
      meta: Object.assign({
        term: '',
        startDate: '',
        totalWeeks: 20,
        sectionsPerDay: 12,
        source: '',
        updatedAt: Date.now()
      }, meta || {}),
      courses: []
    };
  }

  /** 校验课表结构 */
  function validateTimetable(tt) {
    if (!tt || typeof tt !== 'object') return { ok: false, error: '课表数据为空' };
    if (!Array.isArray(tt.courses)) return { ok: false, error: '缺少 courses 数组' };
    if (!tt.meta) tt.meta = createTimetable().meta;
    if (!tt.meta.totalWeeks) tt.meta.totalWeeks = 20;
    if (!tt.meta.sectionsPerDay) tt.meta.sectionsPerDay = 12;
    tt.courses.forEach(function (c) {
      if (!c.id) c.id = 'c' + Math.random().toString(36).slice(2, 9);
      if (typeof c.weekday === 'string') c.weekday = parseWeekday(c.weekday) || 1;
      if (typeof c.sections === 'string') c.sections = parseSections(c.sections) || { start: 1, end: 2 };
      if (!Array.isArray(c.weeks)) c.weeks = parseWeeks(c.weeks, tt.meta.totalWeeks).weeks;
      c.weeksText = formatWeeks(c.weeks);
    });
    return { ok: true, timetable: tt };
  }

  /** 某周某天的课程 */
  function coursesAt(timetable, weekday, week) {
    return timetable.courses.filter(function (c) {
      return Number(c.weekday) === Number(weekday) &&
        (!week || c.weeks.indexOf(Number(week)) >= 0);
    }).sort(function (a, b) { return a.sections.start - b.sections.start; });
  }

  /** 统计冲突（同一时段重叠） */
  function findConflicts(timetable) {
    var conflicts = [];
    var bySlot = {};
    timetable.courses.forEach(function (c) {
      c.weeks.forEach(function (w) {
        for (var s = c.sections.start; s <= c.sections.end; s++) {
          var key = c.weekday + '|' + w + '|' + s;
          (bySlot[key] = bySlot[key] || []).push(c);
        }
      });
    });
    var seen = {};
    Object.keys(bySlot).forEach(function (key) {
      var list = bySlot[key];
      if (list.length < 2) return;
      for (var i = 0; i < list.length; i++) {
        for (var j = i + 1; j < list.length; j++) {
          var pair = [list[i].id, list[j].id].sort().join('+') + '@' + key.split('|').slice(0, 2).join('|');
          if (seen[pair]) continue;
          seen[pair] = true;
          var parts = key.split('|');
          conflicts.push({
            week: Number(parts[1]),
            weekday: Number(parts[0]),
            section: Number(parts[2]),
            a: list[i],
            b: list[j]
          });
        }
      }
    });
    return conflicts;
  }

  /** 今日/本周课程（按真实日期推算教学周） */
  function currentWeek(meta, date) {
    if (!meta.startDate) return 1;
    var start = new Date(meta.startDate + 'T00:00:00');
    var now = date ? new Date(date) : new Date();
    var diffDays = Math.floor((now - start) / 86400000);
    var week = Math.floor(diffDays / 7) + 1;
    return Math.max(1, Math.min(week, meta.totalWeeks || 20));
  }

  var api = {
    WEEKDAY_NAMES: WEEKDAY_NAMES,
    WEEKDAY_FULL: WEEKDAY_FULL,
    parseWeeks: parseWeeks,
    formatWeeks: formatWeeks,
    parseSections: parseSections,
    parseWeekday: parseWeekday,
    parseAuto: parseAuto,
    parseCSVText: parseCSVText,
    parseBlockText: parseBlockText,
    fromJSON: fromJSON,
    fromRows: fromRows,
    buildCourse: buildCourse,
    createTimetable: createTimetable,
    validateTimetable: validateTimetable,
    coursesAt: coursesAt,
    findConflicts: findConflicts,
    currentWeek: currentWeek
  };

  global.TimetableParser = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
