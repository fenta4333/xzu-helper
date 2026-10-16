/**
 * 设置与备份模块
 */
(function (global) {
  'use strict';

  var U = global.Utils;
  var Store = global.Store;

  function init() {
    loadSettings();

    U.$('#set-save').addEventListener('click', saveSettings);

    U.$('#backup-export').addEventListener('click', function () {
      var payload = Store.exportAll();
      payload.exportedAt = new Date().toISOString();
      U.downloadJSON('西藏大学学业助手_备份_' + U.formatDate(Date.now()) + '.json', payload);
      U.toast('已导出备份文件，请妥善保存', 'ok');
    });

    U.$('#backup-import-btn').addEventListener('click', function () {
      U.$('#backup-import').click();
    });

    U.$('#backup-import').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      U.readFileAsText(file).then(function (text) {
        var payload;
        try {
          payload = JSON.parse(text);
        } catch (err) {
          U.toast('文件不是有效的备份 JSON', 'error');
          return;
        }
        if (!confirm('导入备份会覆盖当前所有数据，确定继续？')) return;
        try {
          Store.importAll(payload);
          // 重新加载各模块
          global.TimetableView.state.timetable = null;
          global.TimetableView.init();
          global.DocsView.init();
          loadSettings();
          global.dispatchEvent(new CustomEvent('xzu:data-changed'));
          U.toast('备份已恢复', 'ok');
        } catch (err) {
          U.toast('恢复失败：' + err.message, 'error');
        }
      }).catch(function (err) {
        U.toast('读取文件失败：' + err.message, 'error');
      });
    });

    // ---- 发布：导出文件数据包 + 打包命令 ----
    U.$('#pack-export-docs').addEventListener('click', function () {
      if (!global.Auth.canEdit()) {
        global.Auth.requireAdmin('导出文件数据包');
        return;
      }
      var docs = global.Store.read(global.Store.KEYS.docs, null);
      if (!docs || !docs.length) {
        U.toast('文件中心还没有内容，先去导入文件', 'warn');
        return;
      }
      var pack = {
        app: 'XZU Helper',
        type: 'xzu-docs-pack',
        version: 1,
        packedAt: new Date().toISOString(),
        count: docs.length,
        docs: docs
      };
      U.downloadJSON('文件数据包_' + U.formatDate(Date.now()) + '.json', pack);
      U.toast('已导出 ' + docs.length + ' 条文件，接下来用打包命令生成只读版本', 'ok');
    });

    U.$('#pack-copy-cmd').addEventListener('click', function () {
      var cmd = U.$('#pack-cmd').textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cmd).then(function () {
          U.toast('命令已复制到剪贴板', 'ok');
        }).catch(function () {
          U.toast('复制失败，请手动选中命令复制', 'warn');
        });
      } else {
        U.toast('请手动选中命令复制', 'warn');
      }
    });

    U.$('#data-clear').addEventListener('click', function () {
      if (!confirm('这会清除课表、体测记录和全部文件条目，且无法恢复。\n建议先导出备份。确定清除？')) return;
      if (!confirm('再确认一次：真的要清除全部本地数据吗？')) return;
      Store.clearAll();
      global.TimetableView.state.timetable = null;
      global.TimetableView.init();
      global.DocsView.init();
      loadSettings();
      global.dispatchEvent(new CustomEvent('xzu:data-changed'));
      U.toast('已清除全部本地数据', 'ok');
    });

    updateStorageDetail();
  }

  function loadSettings() {
    var tt = global.TimetableView.getTimetable();
    if (tt) {
      U.$('#set-term').value = tt.meta.term || '';
      U.$('#set-start-date').value = tt.meta.startDate || '';
      U.$('#set-total-weeks').value = tt.meta.totalWeeks || 18;
      U.$('#set-sections-per-day').value = tt.meta.sectionsPerDay || 12;
    } else {
      var settings = Store.read(Store.KEYS.settings, {});
      U.$('#set-term').value = settings.term || '';
      U.$('#set-start-date').value = settings.startDate || '';
      U.$('#set-total-weeks').value = settings.totalWeeks || 18;
      U.$('#set-sections-per-day').value = settings.sectionsPerDay || 12;
    }
    var pubCard = U.$('#card-publish');
    if (pubCard) {
      pubCard.style.display = (global.Auth && global.Auth.canEdit()) ? '' : 'none';
    }
    updateStorageDetail();
  }

  function saveSettings() {
    var values = {
      term: U.$('#set-term').value.trim(),
      startDate: U.$('#set-start-date').value,
      totalWeeks: U.clamp(parseInt(U.$('#set-total-weeks').value, 10) || 18, 1, 30),
      sectionsPerDay: U.clamp(parseInt(U.$('#set-sections-per-day').value, 10) || 12, 4, 16)
    };

    var tt = global.TimetableView.getTimetable();
    if (tt) {
      tt.meta.term = values.term;
      tt.meta.startDate = values.startDate;
      // 总周数变小后，需要裁掉超出范围的周次
      if (values.totalWeeks < tt.meta.totalWeeks) {
        tt.courses.forEach(function (c) {
          c.weeks = c.weeks.filter(function (w) { return w <= values.totalWeeks; });
          c.weeksText = global.TimetableParser.formatWeeks(c.weeks);
        });
      }
      tt.meta.totalWeeks = values.totalWeeks;
      tt.meta.sectionsPerDay = values.sectionsPerDay;
      global.TimetableView.save();
      global.TimetableView.render();
    }
    Store.write(Store.KEYS.settings, values);
    updateStorageDetail();
    U.toast('设置已保存', 'ok');
  }

  function updateStorageDetail() {
    var box = U.$('#storage-detail');
    if (!box) return;
    var usage = Store.usage();
    var tt = global.TimetableView.getTimetable();
    var lines = [
      '已用本地空间：约 ' + U.formatBytes(usage) + '（浏览器上限通常为 5MB）',
      '课表：' + (tt ? tt.courses.length + ' 门课程' : '未导入'),
      '本地存储可用：' + (Store.available ? '是' : '否（数据仅在当前页面有效）')
    ];
    box.innerHTML = lines.join('<br>');
  }

  global.SettingsView = {
    init: init,
    loadSettings: loadSettings,
    updateStorageDetail: updateStorageDetail
  };
})(typeof window !== 'undefined' ? window : globalThis);
