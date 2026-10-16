/**
 * 课表视图：渲染、周次切换、导出（JSON / CSV / 离线 HTML / 图片 / 打印）
 */
(function (global) {
  'use strict';

  var U = global.Utils;
  var P = global.TimetableParser;

  /** 课程配色（按课程名稳定取色） */
  var PALETTE = [
    { bg: '#e8f0fb', fg: '#12457f', bar: '#1a5fb4' },
    { bg: '#fdeceb', fg: '#8f2318', bar: '#c8321e' },
    { bg: '#e9f7ef', fg: '#14532d', bar: '#15803d' },
    { bg: '#fef6e0', fg: '#7c4a03', bar: '#d4a017' },
    { bg: '#f0ebfb', fg: '#4c1d95', bar: '#7c3aed' },
    { bg: '#e6f6f8', fg: '#155e75', bar: '#0891b2' },
    { bg: '#fdeef7', fg: '#831843', bar: '#db2777' },
    { bg: '#eef2f7', fg: '#334155', bar: '#64748b' },
    { bg: '#f0fdf4', fg: '#166534', bar: '#22c55e' },
    { bg: '#fff1f2', fg: '#9f1239', bar: '#f43f5e' }
  ];

  function colorOf(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 100000;
    return PALETTE[hash % PALETTE.length];
  }

  var state = {
    timetable: null,
    week: 1,
    showAllWeeks: false,
    hideWeekend: false
  };

  function tt() { return state.timetable; }

  /* ------------------------------------------------------------ 渲染 */

  function render() {
    var timetable = tt();
    var emptyBox = U.$('#tt-empty');
    var mainBox = U.$('#tt-main');

    if (!timetable || !timetable.courses.length) {
      emptyBox.style.display = '';
      mainBox.style.display = 'none';
      return;
    }
    emptyBox.style.display = 'none';
    mainBox.style.display = '';

    renderHeader();
    renderToolbar();
    renderGrid();
    renderCourseList();
    renderWeekOverview();
    renderAlert();
  }

  function renderHeader() {
    var t = tt();
    U.$('#tt-term').textContent = t.meta.term || '我的课表';
    var parts = [];
    if (t.meta.startDate) parts.push('开学 ' + t.meta.startDate);
    parts.push('共 ' + t.meta.totalWeeks + ' 周');
    parts.push(t.courses.length + ' 门课程');
    if (t.meta.source) parts.push(t.meta.source);
    U.$('#tt-meta').textContent = parts.join(' · ');
  }

  function renderToolbar() {
    var t = tt();
    var sel = U.$('#tt-week-select');
    var html = '';
    // 用 defaultWeek 判断，学期结束后不会把最后一周误标成「本周」
    var todayWeek = defaultWeek(t.meta);
    var hasToday = todayWeek >= 1 && todayWeek <= t.meta.totalWeeks;
    for (var w = 1; w <= t.meta.totalWeeks; w++) {
      html += '<option value="' + w + '">第 ' + w + ' 周' +
        (hasToday && w === todayWeek ? '（本周）' : '') + '</option>';
    }
    sel.innerHTML = html;
    sel.value = String(state.week);
    sel.disabled = state.showAllWeeks;
    U.$('#tt-prev').disabled = state.showAllWeeks || state.week <= 1;
    U.$('#tt-next').disabled = state.showAllWeeks || state.week >= t.meta.totalWeeks;
    U.$('#tt-this-week').disabled = state.showAllWeeks || !hasToday;
    U.$('#tt-show-all-weeks').checked = state.showAllWeeks;
    U.$('#tt-hide-weekend').checked = state.hideWeekend;
  }

  function renderAlert() {
    var t = tt();
    var box = U.$('#tt-alert');
    var conflicts = P.findConflicts(t);
    if (!conflicts.length) { box.innerHTML = ''; return; }

    var groups = {};
    conflicts.forEach(function (c) {
      var key = c.a.name + '|' + c.b.name;
      groups[key] = groups[key] || { a: c.a, b: c.b, weeks: [] };
      if (groups[key].weeks.indexOf(c.week) < 0) groups[key].weeks.push(c.week);
    });

    var items = Object.keys(groups).map(function (k) {
      var g = groups[k];
      return '<li>「' + U.escapeHtml(g.a.name) + '」与「' + U.escapeHtml(g.b.name) +
        '」在第 ' + g.weeks.sort(function (x, y) { return x - y; }).join('、') + ' 周时段重叠</li>';
    }).join('');

    box.innerHTML = '<div class="alert alert-warn"><strong>⚠ 检测到 ' + Object.keys(groups).length +
      ' 组时间冲突</strong>（可能是选课重叠或解析误差，请核对）<ul style="margin:6px 0 0;padding-left:20px">' +
      items + '</ul></div>';
  }

  function visibleWeekdays() {
    return state.hideWeekend ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7];
  }

  function renderGrid() {
    var t = tt();
    var days = visibleWeekdays();
    var sectionsPerDay = t.meta.sectionsPerDay || 12;
    var months = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    var todayIdx = new Date().getDay(); // 0=周日
    var todayWeekday = todayIdx === 0 ? 7 : todayIdx;

    var html = '<table class="tt-grid"><thead><tr><th class="tt-period">节次</th>';
    days.forEach(function (d) {
      var isToday = (d === todayWeekday);
      html += '<th class="' + (isToday ? 'today' : '') + '">' + months[d] +
        (isToday ? '<br><span style="font-size:10px">今天</span>' : '') + '</th>';
    });
    html += '</tr></thead><tbody>';

    // 计算每个格子要放的课程
    var grid = {};   // "weekday-section" -> [course]
    t.courses.forEach(function (c) {
      var active = state.showAllWeeks || c.weeks.indexOf(state.week) >= 0;
      if (!active) return;
      for (var s = c.sections.start; s <= c.sections.end; s++) {
        var key = c.weekday + '-' + s;
        (grid[key] = grid[key] || []).push(c);
      }
    });

    for (var s = 1; s <= sectionsPerDay; s++) {
      html += '<tr><td class="tt-period"><b>' + s + '</b>' + sectionTime(t, s) + '</td>';
      days.forEach(function (d) {
        var list = grid[d + '-' + s] || [];
        html += '<td class="tt-cell">';
        if (list.length) {
          // 只在课程起始节显示完整信息，其余节次留空避免重复
          var main = list[0];
          if (main.sections.start === s) {
            var c = colorOf(main.name);
            var extra = list.length > 1 ? ' ＋' + (list.length - 1) : '';
            html += '<div class="tt-course" style="background:' + c.bg + ';color:' + c.fg +
              ';border-left-color:' + c.bar + '" data-course="' + U.escapeHtml(main.id) + '">' +
              '<b>' + U.escapeHtml(main.name) + extra + '</b>' +
              '<span>' + U.escapeHtml(main.location || '') + '</span>' +
              '<span>' + U.escapeHtml(main.teacher || '') + '</span>' +
              '</div>';
          } else {
            var c2 = colorOf(main.name);
            html += '<div style="height:100%;background:' + c2.bg + ';opacity:.5;border-radius:6px"></div>';
          }
        }
        html += '</td>';
      });
      html += '</tr>';
    }
    html += '</tbody></table>';
    U.$('#tt-grid').innerHTML = html;

    // 点击课程看详情
    U.$$('#tt-grid .tt-course').forEach(function (node) {
      node.addEventListener('click', function () {
        var id = node.getAttribute('data-course');
        var course = t.courses.filter(function (c) { return String(c.id) === String(id); })[0];
        if (course) showCourseDetail(course);
      });
    });

    renderLegend();
  }

  function sectionTime(t, s) {
    var times = (t.meta.sectionTimes || []).filter(function (x) { return x.no === s; })[0];
    if (!times) return '';
    return times.start.slice(0, 5);
  }

  function renderLegend() {
    var t = tt();
    var seen = {};
    var html = '';
    t.courses.forEach(function (c) {
      if (seen[c.name]) return;
      seen[c.name] = true;
      var col = colorOf(c.name);
      html += '<span><i style="background:' + col.bar + '"></i>' + U.escapeHtml(c.name) + '</span>';
    });
    U.$('#tt-legend').innerHTML = html;
  }

  function renderCourseList() {
    var t = tt();
    U.$('#tt-course-count').textContent = t.courses.length + ' 门';
    var html = t.courses.map(function (c) {
      var col = colorOf(c.name);
      return '<div class="tt-list-item">' +
        '<span class="swatch" style="background:' + col.bar + '"></span>' +
        '<span class="info"><b>' + U.escapeHtml(c.name) + '</b>' +
        '<div>' + P.WEEKDAY_NAMES[c.weekday] + ' ' +
        (c.sections.start === c.sections.end
          ? '第' + c.sections.start + '节'
          : '第' + c.sections.start + '-' + c.sections.end + '节') +
        ' · ' + U.escapeHtml(c.weeksText || '') + '</div>' +
        '<div>' + U.escapeHtml([c.teacher, c.location].filter(Boolean).join(' · ')) + '</div>' +
        '</span>' +
        '<button class="btn btn-sm" data-edit="' + U.escapeHtml(c.id) + '">编辑</button>' +
        '<button class="btn btn-sm btn-danger" data-del="' + U.escapeHtml(c.id) + '">删除</button>' +
        '</div>';
    }).join('');
    U.$('#tt-course-list').innerHTML = html;

    U.$$('#tt-course-list [data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del');
        var course = t.courses.filter(function (c) { return String(c.id) === String(id); })[0];
        if (!course) return;
        if (!confirm('确定删除课程「' + course.name + '」？')) return;
        t.courses = t.courses.filter(function (c) { return String(c.id) !== String(id); });
        save();
        render();
        U.toast('已删除', 'ok');
      });
    });

    U.$$('#tt-course-list [data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-edit');
        var course = t.courses.filter(function (c) { return String(c.id) === String(id); })[0];
        if (course) editCourse(course);
      });
    });
  }

  function renderWeekOverview() {
    var t = tt();
    var rows = '<table class="data"><thead><tr><th>周次</th><th>课程数</th><th>课程</th></tr></thead><tbody>';
    for (var w = 1; w <= t.meta.totalWeeks; w++) {
      var list = t.courses.filter(function (c) { return c.weeks.indexOf(w) >= 0; });
      if (!list.length) continue;
      var names = list.map(function (c) { return U.escapeHtml(c.name); }).join('、');
      var cls = (w === state.week) ? ' style="background:var(--brand-light)"' : '';
      rows += '<tr' + cls + '><td class="nowrap">第 ' + w + ' 周</td>' +
        '<td class="num">' + list.length + '</td><td class="small">' + names + '</td></tr>';
    }
    rows += '</tbody></table>';
    U.$('#tt-week-overview').innerHTML = rows;
  }

  /* -------------------------------------------------------- 课程详情 */

  function showCourseDetail(c) {
    var col = colorOf(c.name);
    var body = U.el('div', {}, [
      U.el('div', { class: 'mb-2' }, [
        U.el('span', { class: 'tag', style: 'background:' + col.bg + ';color:' + col.fg },
          c.name)
      ]),
      detailRow('教师', c.teacher),
      detailRow('时间', P.WEEKDAY_FULL[c.weekday] + ' 第 ' + c.sections.start + '-' + c.sections.end + ' 节'),
      detailRow('周次', c.weeksText || (c.weeks.join(','))),
      detailRow('地点', c.location),
      detailRow('班级', c.className),
      detailRow('学分', c.credit),
      detailRow('备注', c.note)
    ]);

    var modal = buildModal('课程详情', body, [
      { text: '关闭', cls: 'btn', onClick: closeModal }
    ]);
    document.body.appendChild(modal);
  }

  function detailRow(label, value) {
    if (!value) return null;
    return U.el('div', { class: 'mb-1' }, [
      U.el('span', { class: 'muted small', style: 'display:inline-block;width:56px' }, label),
      U.el('span', {}, String(value))
    ]);
  }

  function editCourse(course) {
    var f = {};
    var body = U.el('div', {});
    function field(label, key, value, type) {
      var input = U.el('input', { type: type || 'text', value: value || '' });
      f[key] = input;
      body.appendChild(U.el('div', { class: 'field' }, [
        U.el('label', {}, label), input
      ]));
    }
    field('课程名称', 'name', course.name);
    field('教师', 'teacher', course.teacher);
    field('地点', 'location', course.location);
    field('星期（1-7）', 'weekday', course.weekday, 'number');
    field('开始节次', 'start', course.sections.start, 'number');
    field('结束节次', 'end', course.sections.end, 'number');
    field('周次（如 1-16周 / 1-16周(单)）', 'weeks', course.weeksText || P.formatWeeks(course.weeks));
    field('备注', 'note', course.note);

    var modal = buildModal('编辑课程', body, [
      { text: '取消', cls: 'btn', onClick: closeModal },
      {
        text: '保存', cls: 'btn btn-primary', onClick: function () {
          if (!f.name.value.trim()) { U.toast('课程名不能为空', 'error'); return; }
          course.name = f.name.value.trim();
          course.teacher = f.teacher.value.trim();
          course.location = f.location.value.trim();
          course.weekday = U.clamp(parseInt(f.weekday.value, 10) || 1, 1, 7);
          course.sections = {
            start: U.clamp(parseInt(f.start.value, 10) || 1, 1, 20),
            end: U.clamp(parseInt(f.end.value, 10) || 1, 1, 20)
          };
          if (course.sections.end < course.sections.start) {
            var tmp = course.sections.start; course.sections.start = course.sections.end; course.sections.end = tmp;
          }
          var w = P.parseWeeks(f.weeks.value, tt().meta.totalWeeks);
          course.weeks = w.weeks.length ? w.weeks : course.weeks;
          course.weeksText = P.formatWeeks(course.weeks);
          course.note = f.note.value.trim();
          save();
          render();
          closeModal();
          U.toast('已保存', 'ok');
        }
      }
    ]);
    document.body.appendChild(modal);
  }

  /* ------------------------------------------------------------ 弹窗 */

  var modalStack = [];

  function buildModal(title, bodyNode, buttons) {
    var mask = U.el('div', { class: 'modal-mask' });
    var foot = U.el('div', { class: 'modal-foot' });
    (buttons || []).forEach(function (b) {
      foot.appendChild(U.el('button', { class: b.cls || 'btn', onclick: b.onClick }, b.text));
    });
    var modal = U.el('div', { class: 'modal' }, [
      U.el('div', { class: 'modal-head' }, [
        U.el('h3', {}, title),
        U.el('button', { class: 'modal-close', onclick: closeModal, title: '关闭' }, '×')
      ]),
      U.el('div', { class: 'modal-body' }, bodyNode),
      buttons && buttons.length ? foot : null
    ]);
    mask.appendChild(modal);
    mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
    modalStack.push(mask);
    return mask;
  }

  function closeModal() {
    var m = modalStack.pop();
    if (m && m.parentNode) m.parentNode.removeChild(m);
    // 关闭所有残留
    U.$$('.modal-mask').forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    modalStack.length = 0;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalStack.length) closeModal();
  });

  /* ------------------------------------------------------------ 导出 */

  function exportJSON() {
    var t = tt();
    var payload = {
      meta: Object.assign({}, t.meta, { updatedAt: Date.now(), source: '本地导出' }),
      courses: t.courses
    };
    U.downloadJSON(fileName('json'), payload);
    U.toast('已导出 JSON', 'ok');
  }

  function exportCSV() {
    var t = tt();
    var head = ['课程名称', '教师', '星期', '节次', '周次', '上课地点', '学分', '备注'];
    var lines = [head.join(',')];
    t.courses.forEach(function (c) {
      lines.push([
        csvCell(c.name), csvCell(c.teacher),
        P.WEEKDAY_NAMES[c.weekday],
        c.sections.start + '-' + c.sections.end + '节',
        csvCell(c.weeksText || ''),
        csvCell(c.location), csvCell(c.credit), csvCell(c.note)
      ].join(','));
    });
    // 加 BOM 让 Excel 正确识别中文
    U.download(fileName('csv'), '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8');
    U.toast('已导出 CSV（可用 Excel 打开）', 'ok');
  }

  function csvCell(v) {
    var s = String(v === null || v === undefined ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /**
   * 导出为「单文件离线网页」：把数据、样式、渲染逻辑全部内联，
   * 双击即可在任意浏览器打开，不需要本站在线，也不需要联网。
   */
  function exportOfflineHTML() {
    var t = tt();
    var data = JSON.stringify({
      meta: t.meta,
      courses: t.courses
    });
    var html = offlineTemplate(data);
    U.download(fileName('html'), html, 'text/html;charset=utf-8');
    U.toast('已导出离线网页，双击即可打开', 'ok');
  }

  function offlineTemplate(dataJson) {
    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>我的课表</title>\n<style>\n' +
      OFFLINE_CSS +
      '\n</style>\n</head>\n<body>\n' +
      '<div class="wrap">\n' +
      '  <header>\n' +
      '    <h1 id="term">我的课表</h1>\n' +
      '    <div class="meta" id="meta"></div>\n' +
      '  </header>\n' +
      '  <div class="toolbar">\n' +
      '    <button id="prev">← 上一周</button>\n' +
      '    <select id="weekSel"></select>\n' +
      '    <button id="next">下一周 →</button>\n' +
      '    <button id="allWeeks">显示全部周次</button>\n' +
      '    <button id="print">🖨 打印 / 存 PDF</button>\n' +
      '  </div>\n' +
      '  <div class="grid-wrap"><div id="grid"></div></div>\n' +
      '  <div class="legend" id="legend"></div>\n' +
      '  <h2>课程清单</h2>\n' +
      '  <div id="list"></div>\n' +
      '  <footer>由「西藏大学学业助手」导出的离线课表 · 导出时间 ' +
      new Date().toLocaleString('zh-CN') + '</footer>\n' +
      '</div>\n' +
      '<script>\nvar DATA = ' + dataJson + ';\n' + OFFLINE_JS + '\n</' + 'script>\n' +
      '</body>\n</html>';
  }

  var OFFLINE_CSS = [
    '*{box-sizing:border-box}',
    'body{margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;',
    'background:#f5f7fa;color:#1f2933;font-size:14px;line-height:1.6}',
    '.wrap{max-width:1100px;margin:0 auto}',
    'header{background:#fff;border:1px solid #e3e8ef;border-radius:12px;padding:18px 20px;margin-bottom:14px}',
    'h1{margin:0 0 6px;font-size:20px}',
    'h2{font-size:16px;margin:22px 0 10px}',
    '.meta{color:#8a94a6;font-size:12px}',
    '.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}',
    'button,select{padding:7px 13px;font-size:13px;font-family:inherit;border:1px solid #cbd5e1;',
    'background:#fff;border-radius:8px;cursor:pointer}',
    'button:hover{border-color:#1a5fb4;color:#1a5fb4}',
    'button:disabled{opacity:.45;cursor:not-allowed}',
    '.grid-wrap{overflow-x:auto;background:#fff;border:1px solid #e3e8ef;border-radius:12px}',
    'table{border-collapse:collapse;width:100%;min-width:820px;table-layout:fixed;font-size:12px}',
    'th,td{border:1px solid #e3e8ef;padding:0;vertical-align:top}',
    'thead th{background:#fafbfc;padding:9px 4px;font-weight:600;color:#52606d;text-align:center}',
    'td.p{width:60px;background:#fafbfc;text-align:center;font-size:11px;color:#8a94a6;padding:4px 2px}',
    'td.c{height:46px;padding:2px}',
    '.course{border-radius:6px;padding:4px 5px;font-size:11px;line-height:1.3;overflow:hidden;height:100%}',
    '.course b{display:block;font-size:11px}',
    '.course span{display:block;opacity:.85;font-size:10px}',
    '.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:#52606d}',
    '.legend i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px}',
    '.item{background:#fff;border:1px solid #e3e8ef;border-radius:8px;padding:10px 12px;margin-bottom:8px;',
    'display:flex;gap:10px;align-items:center}',
    '.item .sw{width:4px;align-self:stretch;border-radius:2px;flex:0 0 4px}',
    '.item .txt{flex:1}',
    '.item .txt div{font-size:12px;color:#8a94a6}',
    'footer{margin-top:26px;padding-top:14px;border-top:1px solid #e3e8ef;color:#8a94a6;font-size:12px;text-align:center}',
    '@media print{.toolbar{display:none}body{background:#fff;padding:0}.grid-wrap{border:none}}'
  ].join('\n');

  var OFFLINE_JS = [
    '(function(){',
    'var PALETTE=[["#e8f0fb","#12457f","#1a5fb4"],["#fdeceb","#8f2318","#c8321e"],["#e9f7ef","#14532d","#15803d"],',
    '["#fef6e0","#7c4a03","#d4a017"],["#f0ebfb","#4c1d95","#7c3aed"],["#e6f6f8","#155e75","#0891b2"],',
    '["#fdeef7","#831843","#db2777"],["#eef2f7","#334155","#64748b"],["#f0fdf4","#166534","#22c55e"],["#fff1f2","#9f1239","#f43f5e"]];',
    'function colorOf(n){var h=0;for(var i=0;i<n.length;i++)h=(h*31+n.charCodeAt(i))%100000;return PALETTE[h%PALETTE.length];}',
    'var DAYS=["","周一","周二","周三","周四","周五","周六","周日"];',
    'var week=1, allWeeks=false;',
    'var meta=DATA.meta||{}, courses=DATA.courses||[];',
    'var total=meta.totalWeeks||20, perDay=meta.sectionsPerDay||12;',
    'function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}',
    'function secTime(s){var t=(meta.sectionTimes||[]).filter(function(x){return x.no===s;})[0];return t?t.start.slice(0,5):"";}',
    'function renderHeader(){',
    '  document.getElementById("term").textContent=meta.term||"我的课表";',
    '  var p=[];if(meta.startDate)p.push("开学 "+meta.startDate);',
    '  p.push("共 "+total+" 周");p.push(courses.length+" 门课程");',
    '  document.getElementById("meta").textContent=p.join(" · ");',
    '  document.title=(meta.term||"我的课表");',
    '}',
    'function renderGrid(){',
    '  var grid={};',
    '  courses.forEach(function(c){',
    '    if(!allWeeks && c.weeks.indexOf(week)<0)return;',
    '    for(var s=c.sections.start;s<=c.sections.end;s++){',
    '      var k=c.weekday+"-"+s;(grid[k]=grid[k]||[]).push(c);',
    '    }',
    '  });',
    '  var todayIdx=new Date().getDay(), todayWd=todayIdx===0?7:todayIdx;',
    '  var h="<table><thead><tr><td class=\\"p\\">节次</td>";',
    '  for(var d=1;d<=7;d++){h+="<th"+(d===todayWd?" style=\\"background:#e8f0fb;color:#12457f\\"":"")+">"+DAYS[d]+"</th>";}',
    '  h+="</tr></thead><tbody>";',
    '  for(var s=1;s<=perDay;s++){',
    '    h+="<tr><td class=\\"p\\"><b>"+s+"</b><br>"+secTime(s)+"</td>";',
    '    for(var d=1;d<=7;d++){',
    '      var list=grid[d+"-"+s]||[];h+="<td class=\\"c\\">";',
    '      if(list.length){var m=list[0],col=colorOf(m.name);',
    '        if(m.sections.start===s){',
    '          var extra=list.length>1?" ＋"+(list.length-1):"";',
    '          h+="<div class=\\"course\\" style=\\"background:"+col[0]+";color:"+col[1]+";border-left:3px solid "+col[2]+"\\">"',
    '            +"<b>"+esc(m.name)+extra+"</b><span>"+esc(m.location||"")+"</span><span>"+esc(m.teacher||"")+"</span></div>";',
    '        } else { h+="<div style=\\"height:100%;background:"+col[0]+";opacity:.5;border-radius:6px\\"></div>"; }',
    '      }',
    '      h+="</td>";',
    '    }',
    '    h+="</tr>";',
    '  }',
    '  h+="</tbody></table>";',
    '  document.getElementById("grid").innerHTML=h;',
    '}',
    'function renderLegend(){',
    '  var seen={},h="";',
    '  courses.forEach(function(c){if(seen[c.name])return;seen[c.name]=1;',
    '    h+="<span><i style=\\"background:"+colorOf(c.name)[2]+"\\"></i>"+esc(c.name)+"</span>";});',
    '  document.getElementById("legend").innerHTML=h;',
    '}',
    'function weeksText(c){',
    '  if(c.weeksText)return c.weeksText;',
    '  var a=c.weeks.slice().sort(function(x,y){return x-y;});if(!a.length)return "";',
    '  var parts=[],st=a[0],pv=a[0];',
    '  for(var i=1;i<=a.length;i++){var cu=a[i];if(cu===pv+1){pv=cu;continue;}',
    '    parts.push(st===pv?String(st):st+"-"+pv);st=pv=cu;}',
    '  return parts.join(",")+"周";',
    '}',
    'function renderList(){',
    '  var h="";',
    '  courses.forEach(function(c){var col=colorOf(c.name);',
    '    h+="<div class=\\"item\\"><span class=\\"sw\\" style=\\"background:"+col[2]+"\\"></span><span class=\\"txt\\">"',
    '      +"<b>"+esc(c.name)+"</b><div>"+DAYS[c.weekday]+" 第"+c.sections.start+"-"+c.sections.end+"节 · "+esc(weeksText(c))+"</div>"',
    '      +"<div>"+esc([c.teacher,c.location].filter(Boolean).join(" · "))+"</div></span></div>";});',
    '  document.getElementById("list").innerHTML=h||"<p style=\\"color:#8a94a6\\">暂无课程</p>";',
    '}',
    'function renderToolbar(){',
    '  var sel=document.getElementById("weekSel"),h="";',
    '  for(var w=1;w<=total;w++)h+="<option value=\\""+w+"\\">第 "+w+" 周</option>";',
    '  sel.innerHTML=h;sel.value=String(week);sel.disabled=allWeeks;',
    '  document.getElementById("prev").disabled=allWeeks||week<=1;',
    '  document.getElementById("next").disabled=allWeeks||week>=total;',
    '  document.getElementById("allWeeks").textContent=allWeeks?"只看单周":"显示全部周次";',
    '}',
    'document.getElementById("prev").onclick=function(){if(week>1){week--;renderToolbar();renderGrid();}};',
    'document.getElementById("next").onclick=function(){if(week<total){week++;renderToolbar();renderGrid();}};',
    'document.getElementById("weekSel").onchange=function(e){week=parseInt(e.target.value,10);renderToolbar();renderGrid();};',
    'document.getElementById("allWeeks").onclick=function(){allWeeks=!allWeeks;renderToolbar();renderGrid();};',
    'document.getElementById("print").onclick=function(){window.print();};',
    'renderHeader();renderToolbar();renderGrid();renderLegend();renderList();',
    '})();'
  ].join('\n');

  /** 导出为 PNG 图片：把课表用 canvas 画出来 */
  function exportPNG() {
    var t = tt();
    var days = visibleWeekdays();
    var sectionsPerDay = t.meta.sectionsPerDay || 12;

    // 只画有课程的节次范围，避免图片过大
    var maxSection = 0;
    t.courses.forEach(function (c) { if (c.sections.end > maxSection) maxSection = c.sections.end; });
    if (!maxSection) maxSection = 10;
    maxSection = Math.min(maxSection, sectionsPerDay);

    var cellW = 150, cellH = 62, headH = 40, periodW = 62, padding = 24;
    var titleH = 64;
    var width = padding * 2 + periodW + cellW * days.length;
    var height = padding * 2 + titleH + headH + cellH * maxSection + 40;

    var scale = 2; // 2 倍图更清晰
    var canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // 背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 标题
    ctx.fillStyle = '#1f2933';
    ctx.font = 'bold 20px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(t.meta.term || '我的课表', padding, padding);

    ctx.fillStyle = '#8a94a6';
    ctx.font = '12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    var metaLine = '共 ' + t.meta.totalWeeks + ' 周 · ' + t.courses.length + ' 门课程' +
      (state.showAllWeeks ? ' · 显示全部周次' : ' · 第 ' + state.week + ' 周');
    ctx.fillText(metaLine, padding, padding + 28);

    var originY = padding + titleH;
    var originX = padding;

    // 表头
    ctx.fillStyle = '#fafbfc';
    ctx.fillRect(originX, originY, periodW + cellW * days.length, headH);
    ctx.strokeStyle = '#e3e8ef';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#52606d';
    ctx.font = 'bold 12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('节次', originX + periodW / 2, originY + 14);
    days.forEach(function (d, i) {
      ctx.fillText(P.WEEKDAY_NAMES[d], originX + periodW + cellW * i + cellW / 2, originY + 14);
    });

    // 网格与课程
    var grid = {};
    t.courses.forEach(function (c) {
      var active = state.showAllWeeks || c.weeks.indexOf(state.week) >= 0;
      if (!active) return;
      for (var s = c.sections.start; s <= c.sections.end; s++) {
        var key = c.weekday + '-' + s;
        (grid[key] = grid[key] || []).push(c);
      }
    });

    var todayIdx = new Date().getDay();
    var todayWeekday = todayIdx === 0 ? 7 : todayIdx;

    for (var s = 1; s <= maxSection; s++) {
      var y = originY + headH + (s - 1) * cellH;

      // 节次列
      ctx.fillStyle = '#fafbfc';
      ctx.fillRect(originX, y, periodW, cellH);
      ctx.fillStyle = '#52606d';
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(s), originX + periodW / 2, y + 8);
      var st = sectionTime(t, s);
      if (st) {
        ctx.fillStyle = '#8a94a6';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText(st, originX + periodW / 2, y + 26);
      }

      days.forEach(function (d, i) {
        var x = originX + periodW + cellW * i;
        if (d === todayWeekday) {
          ctx.fillStyle = '#f4f8fe';
          ctx.fillRect(x, y, cellW, cellH);
        }
        var list = grid[d + '-' + s] || [];
        if (list.length && list[0].sections.start === s) {
          var c = list[0];
          var col = colorOf(c.name);
          var span = Math.min(c.sections.end, maxSection) - c.sections.start + 1;
          var boxH = span * cellH - 4;
          var bx = x + 2, by = y + 2, bw = cellW - 4;

          ctx.fillStyle = col.bg;
          roundRect(ctx, bx, by, bw, boxH, 6);
          ctx.fill();
          ctx.fillStyle = col.bar;
          roundRect(ctx, bx, by, 3, boxH, 2);
          ctx.fill();

          ctx.textAlign = 'left';
          ctx.fillStyle = col.fg;
          ctx.font = 'bold 11px -apple-system, "PingFang SC", sans-serif';
          var extra = list.length > 1 ? ' ＋' + (list.length - 1) : '';
          ctx.fillText(clip(ctx, c.name + extra, bw - 12), bx + 8, by + 6);
          ctx.font = '10px -apple-system, "PingFang SC", sans-serif';
          ctx.fillStyle = col.fg;
          ctx.globalAlpha = 0.85;
          if (c.location) ctx.fillText(clip(ctx, c.location, bw - 12), bx + 8, by + 22);
          if (c.teacher) ctx.fillText(clip(ctx, c.teacher, bw - 12), bx + 8, by + 36);
          ctx.globalAlpha = 1;
        }
      });
    }

    // 网格线
    ctx.strokeStyle = '#e3e8ef';
    ctx.lineWidth = 1;
    for (var i = 0; i <= days.length + 1; i++) {
      var lx = originX + (i === 0 ? 0 : periodW + cellW * (i - 1)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(lx, originY);
      ctx.lineTo(lx, originY + headH + cellH * maxSection);
      ctx.stroke();
    }
    for (var j = 0; j <= maxSection + 1; j++) {
      var ly = originY + (j === 0 ? 0 : headH + cellH * (j - 1)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(originX, ly);
      ctx.lineTo(originX + periodW + cellW * days.length, ly);
      ctx.stroke();
    }

    // 页脚
    ctx.fillStyle = '#8a94a6';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('由「西藏大学学业助手」导出 · ' + new Date().toLocaleString('zh-CN'),
      padding, originY + headH + cellH * maxSection + 14);

    canvas.toBlob(function (blob) {
      U.download(fileName('png'), blob);
      U.toast('已导出 PNG 图片', 'ok');
    }, 'image/png');
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function clip(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    var t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
      t = t.slice(0, -1);
    }
    return t + '…';
  }

  function fileName(ext) {
    var t = tt();
    var term = (t.meta.term || '我的课表').replace(/[\\/:*?"<>|\s]/g, '_');
    var d = new Date();
    var stamp = d.getFullYear() + U.pad2(d.getMonth() + 1) + U.pad2(d.getDate());
    return term + '_' + stamp + '.' + ext;
  }

  /* ------------------------------------------------------------ 状态 */

  function load() {
    var saved = global.Store.read(global.Store.KEYS.timetable, null);
    if (saved && saved.courses) {
      var v = P.validateTimetable(saved);
      if (v.ok) state.timetable = v.timetable;
    }
    state.week = state.timetable ? defaultWeek(state.timetable.meta) : 1;
  }

  /**
   * 默认定位到哪一周：
   * 正常情况下是「本周」；但如果学期已经结束（当前日期算出的周次
   * 超出了学期总周数），就退回第 1 周 —— 否则用户打开页面会看到一张
   * 空课表，误以为数据没导入成功。
   *
   * 注意：不能直接用 TimetableParser.currentWeek()，它内部已把结果钳制
   * 在 [1, totalWeeks] 区间，越界信息被吞掉了，这里需要未钳制的原始周次。
   */
  function defaultWeek(meta) {
    if (!meta || !meta.startDate) return 1;
    var start = new Date(meta.startDate + 'T00:00:00');
    if (isNaN(start.getTime())) return 1;
    var rawWeek = Math.floor(Math.floor((Date.now() - start) / 86400000) / 7) + 1;
    var total = meta.totalWeeks || 20;
    if (rawWeek < 1 || rawWeek > total) return 1;
    return rawWeek;
  }

  function save() {
    if (state.timetable) {
      state.timetable.meta.updatedAt = Date.now();
      global.Store.write(global.Store.KEYS.timetable, state.timetable);
    }
    global.dispatchEvent(new CustomEvent('xzu:data-changed'));
  }

  function setTimetable(tt, opts) {
    state.timetable = tt;
    state.week = (opts && opts.week) || defaultWeek(tt.meta);
    save();
    render();
  }

  function init() {
    load();
    render();

    // 工具栏事件
    U.$('#tt-prev').addEventListener('click', function () {
      if (state.week > 1) { state.week--; renderToolbar(); renderGrid(); renderWeekOverview(); }
    });
    U.$('#tt-next').addEventListener('click', function () {
      var max = tt().meta.totalWeeks;
      if (state.week < max) { state.week++; renderToolbar(); renderGrid(); renderWeekOverview(); }
    });
    U.$('#tt-week-select').addEventListener('change', function (e) {
      state.week = parseInt(e.target.value, 10);
      renderGrid(); renderWeekOverview();
    });
    U.$('#tt-this-week').addEventListener('click', function () {
      state.week = defaultWeek(tt().meta);
      renderToolbar(); renderGrid(); renderWeekOverview();
    });
    U.$('#tt-show-all-weeks').addEventListener('change', function (e) {
      state.showAllWeeks = e.target.checked;
      renderToolbar(); renderGrid();
    });
    U.$('#tt-hide-weekend').addEventListener('change', function (e) {
      state.hideWeekend = e.target.checked;
      renderGrid();
    });

    U.$('#tt-export-json').addEventListener('click', exportJSON);
    U.$('#tt-export-csv').addEventListener('click', exportCSV);
    U.$('#tt-export-html').addEventListener('click', exportOfflineHTML);
    U.$('#tt-export-png').addEventListener('click', exportPNG);
    U.$('#tt-print').addEventListener('click', function () { window.print(); });
    U.$('#tt-clear').addEventListener('click', function () {
      if (!confirm('确定清空课表？此操作不可恢复（建议先导出备份）。')) return;
      state.timetable = null;
      global.Store.remove(global.Store.KEYS.timetable);
      global.dispatchEvent(new CustomEvent('xzu:data-changed'));
      render();
      U.toast('课表已清空', 'ok');
    });
    U.$('#tt-load-sample').addEventListener('click', loadSample);
  }

  function loadSample() {
    if (!global.SAMPLE_TIMETABLE) return;
    var copy = U.clone(global.SAMPLE_TIMETABLE);
    copy.meta.source = '示例数据（虚构，请替换为你的真实课表）';
    setTimetable(copy);
    U.toast('已载入示例课表（虚构数据，仅供试用）', 'ok');
  }

  global.TimetableView = {
    init: init,
    render: render,
    setTimetable: setTimetable,
    getTimetable: tt,
    save: save,
    loadSample: loadSample,
    buildModal: function (title, body, buttons) {
      var m = buildModal(title, body, buttons);
      document.body.appendChild(m);
      return m;
    },
    closeModal: closeModal,
    colorOf: colorOf,
    state: state
  };
})(typeof window !== 'undefined' ? window : globalThis);
