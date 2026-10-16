/**
 * 应用入口：路由、页面切换、导入流程串联、首页状态
 */
(function (global) {
  'use strict';

  var U = global.Utils;
  var P = global.TimetableParser;

  var PAGE_TITLES = {
    home: '首页',
    timetable: '我的课表',
    import: '导入课表',
    fitness: '体测计算',
    standard: '评分标准',
    docs: '文件中心',
    settings: '设置与备份'
  };

  var currentPage = 'home';
  var pendingImport = null; // 待保存的解析结果

  /* ------------------------------------------------------------ 路由 */

  function goto(page) {
    if (!PAGE_TITLES[page]) page = 'home';
    currentPage = page;

    U.$$('.page').forEach(function (n) {
      n.classList.toggle('active', n.id === 'page-' + page);
    });
    U.$$('.nav-item').forEach(function (n) {
      n.classList.toggle('active', n.getAttribute('data-page') === page);
    });
    U.$('#page-title').textContent = PAGE_TITLES[page];

    // 关闭移动端侧栏
    U.$('#sidebar').classList.remove('open');

    if (location.hash !== '#' + page) {
      history.replaceState(null, '', '#' + page);
    }

    window.scrollTo(0, 0);
    updateTopbarSub();

    // 进入页面时同步一次该页界面（例如刚保存完课表就切到设置页）
    if (page === 'settings') {
      global.SettingsView.loadSettings();
      global.AuthView.refresh();
    } else if (page === 'docs') {
      global.DocsView.render();
      global.AuthView.refresh();
    }
  }

  function updateTopbarSub() {
    var tt = global.TimetableView.getTimetable();
    var sub = '';
    if (tt && tt.courses.length) {
      var week = global.TimetableView.state.week;
      sub = (tt.meta.term || '课表') + ' · 第 ' + week + ' 周';
    }
    U.$('#topbar-sub').textContent = sub;
  }

  /* ------------------------------------------------------------ 导入 */

  function parseImportText() {
    var text = U.$('#import-text').value;
    if (!text.trim()) {
      U.toast('请先粘贴课表内容', 'warn');
      return;
    }
    var totalWeeks = U.clamp(parseInt(U.$('#import-total-weeks').value, 10) || 18, 1, 30);
    var result = P.parseAuto(text, { totalWeeks: totalWeeks });

    if (!result.courses.length) {
      U.$('#import-result').style.display = '';
      U.$('#import-messages').innerHTML = '<div class="alert alert-err">' +
        '没有解析出任何课程。<br>' +
        (result.errors.length ? result.errors.map(U.escapeHtml).join('<br>') : '请检查内容格式。') +
        '</div>';
      U.$('#import-preview').innerHTML = '';
      pendingImport = null;
      return;
    }

    // 补充学期信息
    result.meta = {
      term: U.$('#import-term').value.trim(),
      startDate: U.$('#import-start').value,
      totalWeeks: totalWeeks,
      sectionsPerDay: 12,
      source: '粘贴导入（' + result.format + '）'
    };
    pendingImport = result;
    renderImportPreview(result);
  }

  function renderImportPreview(result) {
    U.$('#import-result').style.display = '';

    var msgs = '';
    msgs += '<div class="alert alert-ok">成功解析 <strong>' + result.courses.length +
      '</strong> 门课程。</div>';
    if (result.warnings && result.warnings.length) {
      msgs += '<div class="alert alert-warn"><strong>提示：</strong><br>' +
        result.warnings.map(U.escapeHtml).join('<br>') + '</div>';
    }
    if (result.errors && result.errors.length) {
      msgs += '<div class="alert alert-err"><strong>' + result.errors.length +
        ' 行未能解析：</strong><br>' + result.errors.map(U.escapeHtml).join('<br>') + '</div>';
    }
    U.$('#import-messages').innerHTML = msgs;

    var head = '<tr><th>课程名称</th><th>教师</th><th>星期</th><th>节次</th>' +
      '<th>周次</th><th>地点</th></tr>';
    var rows = result.courses.map(function (c) {
      return '<tr><td><b>' + U.escapeHtml(c.name) + '</b></td>' +
        '<td>' + U.escapeHtml(c.teacher || '-') + '</td>' +
        '<td>' + P.WEEKDAY_NAMES[c.weekday] + '</td>' +
        '<td>' + c.sections.start + '-' + c.sections.end + ' 节</td>' +
        '<td class="small">' + U.escapeHtml(c.weeksText || '') + '</td>' +
        '<td class="small">' + U.escapeHtml(c.location || '-') + '</td></tr>';
    }).join('');
    U.$('#import-preview').innerHTML = '<table class="data"><thead>' + head +
      '</thead><tbody>' + rows + '</tbody></table>';
  }

  function saveImport() {
    if (!pendingImport || !pendingImport.courses.length) {
      U.toast('没有可保存的课程', 'warn');
      return;
    }
    var tt = P.createTimetable(pendingImport.meta);
    tt.courses = pendingImport.courses;
    P.validateTimetable(tt);
    global.TimetableView.setTimetable(tt);
    pendingImport = null;
    U.$('#import-result').style.display = 'none';
    U.toast('课表已保存到本地', 'ok');
    goto('timetable');
  }

  function initImport() {
    U.$('#import-parse').addEventListener('click', parseImportText);
    U.$('#import-save').addEventListener('click', saveImport);

    U.$('#import-clear-text').addEventListener('click', function () {
      U.$('#import-text').value = '';
      U.$('#import-result').style.display = 'none';
      pendingImport = null;
    });

    U.$('#import-sample-text').addEventListener('click', function () {
      U.$('#import-text').value = [
        '课程名称,教师,星期,节次,周次,上课地点',
        '高等数学,张老师,周一,1-2节,1-16周,教学楼A-201',
        '大学英语,李老师,周三,3-4节,1-16周(单),外语楼B-105',
        '计算机基础,王老师,周三,5-6节,1-12周,实验楼C-302',
        '大学物理,刘老师,周五,1-2节,1-16周,实验楼C-201',
        '体育,赵老师,周五,5-6节,1-16周,田径场'
      ].join('\n');
      U.$('#import-term').value = '2025—2026学年 第一学期';
      U.$('#import-start').value = '2025-09-01';
      U.toast('已填入格式示例，点「解析预览」试试', 'ok');
    });

    U.$('#import-file-btn').addEventListener('click', function () {
      U.$('#import-file').click();
    });

    U.$('#import-file').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      U.readFileAsText(file).then(function (text) {
        U.$('#import-text').value = text;
        U.toast('已读取 ' + file.name + '，点「解析预览」继续', 'ok');
        parseImportText();
      }).catch(function (err) {
        U.toast('读取文件失败：' + err.message, 'error');
      });
    });

    U.$('#import-load-sample').addEventListener('click', function () {
      global.TimetableView.loadSample();
      goto('timetable');
    });
  }

  /* ------------------------------------------------------------ 首页 */

  function renderHomeStatus() {
    var box = U.$('#home-status');
    if (!box) return;
    var tt = global.TimetableView.getTimetable();
    var docs = global.Store.read(global.Store.KEYS.docs, []) || [];
    var profile = global.Store.read(global.Store.KEYS.fitnessProfile, null);

    var cards = [
      {
        value: tt ? tt.courses.length : '—',
        label: '课表课程数',
        hint: tt ? (tt.meta.term || '已导入') : '尚未导入课表'
      },
      {
        value: tt ? tt.meta.totalWeeks + ' 周' : '—',
        label: '学期总周数',
        hint: tt && tt.meta.startDate ? '开学 ' + tt.meta.startDate : '可在设置中修改'
      },
      {
        value: docs.length,
        label: '文件条目',
        hint: docs.length ? '在文件中心查看' : '还没有文件'
      },
      {
        value: profile ? '已保存' : '—',
        label: '体测数据',
        hint: profile ? '可继续修改' : '还没算过'
      }
    ];

    box.innerHTML = cards.map(function (c) {
      return '<div class="metric"><div class="value">' + U.escapeHtml(String(c.value)) +
        '</div><div class="label">' + U.escapeHtml(c.label) +
        '</div><div class="label" style="opacity:.75">' + U.escapeHtml(c.hint) +
        '</div></div>';
    }).join('');
  }

  /* ------------------------------------------------------------ 启动 */

  function init() {
    // 导航
    U.$$('.nav-item').forEach(function (n) {
      n.addEventListener('click', function (e) {
        e.preventDefault();
        goto(n.getAttribute('data-page'));
      });
    });

    // 任意带 data-goto 的元素
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-goto]') : null;
      if (!t) return;
      e.preventDefault();
      goto(t.getAttribute('data-goto'));
    });

    U.$('#menu-btn').addEventListener('click', function () {
      U.$('#sidebar').classList.toggle('open');
    });

    // 权限先初始化：后面的模块渲染要按身份决定显示什么
    global.Auth.init();

    // 模块初始化
    global.TimetableView.init();
    global.FitnessView.init();
    global.DocsView.init();
    global.AuthView.init();
    global.SettingsView.init();
    initImport();

    // 数据变化时刷新首页与顶部栏
    global.addEventListener('xzu:data-changed', function () {
      renderHomeStatus();
      updateTopbarSub();
      global.SettingsView.updateStorageDetail();
      updateSidebarStorage();
    });

    // 切到课表 / 设置页时同步一次界面，避免显示的是导入前的旧状态
    U.$('#tt-week-select').addEventListener('change', updateTopbarSub);
    U.$('#tt-prev').addEventListener('click', updateTopbarSub);
    U.$('#tt-next').addEventListener('click', updateTopbarSub);

    renderHomeStatus();
    updateSidebarStorage();

    // 初始页面（支持 #hash 直达）
    var hash = (location.hash || '').replace('#', '');
    goto(PAGE_TITLES[hash] ? hash : 'home');

    global.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace('#', '');
      if (PAGE_TITLES[h] && h !== currentPage) goto(h);
    });

    console.log('%c西藏大学学业助手', 'color:#1a5fb4;font-weight:bold;font-size:14px',
      '已启动 · 所有数据仅存于本机浏览器');
  }

  function updateSidebarStorage() {
    var box = U.$('#storage-info');
    if (!box) return;
    box.textContent = '已用 ' + U.formatBytes(global.Store.usage());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.App = { goto: goto };
})(typeof window !== 'undefined' ? window : globalThis);
