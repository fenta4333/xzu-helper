/**
 * 文件中心：分类筛选、关键词检索、在线预览（PDF/图片/文本）、导入导出
 *
 * 文件本体以 DataURL / 纯文本形式存在浏览器本地存储，不上传任何服务器。
 */
(function (global) {
  'use strict';

  var U = global.Utils;
  var Store = global.Store;

  function auth() { return global.Auth; }

  /** 预置分类 */
  var CATEGORIES = ['全部', '保研推免', '评奖评优', '学籍管理', '教学运行', '体测体育', '培养方案', '办事指南', '其它'];

  var state = {
    docs: [],
    category: '全部',
    keyword: '',
    /** 文件库来源：local / bundled / sample / empty */
    source: 'empty'
  };

  var TYPE_LABEL = {
    pdf: 'PDF', doc: 'DOC', xls: 'XLS', img: '图片', txt: '文本', link: '链接'
  };

  /** 单文件大小上限（超过则只存目录条目，不存正文） */
  var MAX_EMBED_SIZE = 8 * 1024 * 1024; // 8MB
  var MAX_TOTAL_SIZE = 4.5 * 1024 * 1024; // localStorage 通常 5MB，留余量

  /* ------------------------------------------------------------ 数据 */

  /**
   * 载入文件库。优先级：
   *   1. 本地已保存的文件库（管理员在本机维护的内容）
   *   2. 打包时烧进站点的文件数据包（只读发布版发给同学的部分）
   *   3. 内置示例条目（开发调试用，标注为「占位」）
   *
   * 只读模式下不会写 localStorage，避免普通用户无意中把发布内容覆盖掉。
   */
  function load() {
    var saved = Store.read(Store.KEYS.docs, null);
    if (saved && Array.isArray(saved) && saved.length) {
      state.docs = saved;
      state.source = 'local';
      return;
    }

    if (global.XZU_BUNDLED_DOCS && Array.isArray(global.XZU_BUNDLED_DOCS)) {
      state.docs = U.clone(global.XZU_BUNDLED_DOCS);
      state.source = 'bundled';
      return;
    }

    if (global.SAMPLE_DOCS) {
      state.docs = U.clone(global.SAMPLE_DOCS);
      state.source = 'sample';
      // 示例条目只在可编辑身份下落盘，只读版不该往本地写东西
      if (!auth() || auth().canEdit()) save();
      return;
    }

    state.docs = [];
    state.source = 'empty';
  }

  function save() {
    // 运行时守卫：即便通过控制台调到这里，非管理员也写不进去
    if (auth() && !auth().canEdit()) {
      auth().requireAdmin('保存文件库');
      return false;
    }
    var ok = Store.write(Store.KEYS.docs, state.docs);
    if (ok) global.dispatchEvent(new CustomEvent('xzu:data-changed'));
    return ok;
  }

  function totalEmbedSize() {
    return state.docs.reduce(function (n, d) {
      if (d.content && typeof d.content === 'string') return n + d.content.length;
      if (d.fileData) return n + d.fileData.length;
      return n;
    }, 0);
  }

  /* ------------------------------------------------------------ 筛选 */

  function filtered() {
    var kw = state.keyword.trim().toLowerCase();
    return state.docs.filter(function (d) {
      if (state.category !== '全部' && d.category !== state.category) return false;
      if (!kw) return true;
      var hay = [
        d.title, d.description, d.college, d.year, d.source,
        (d.tags || []).join(' '), d.category,
        // 文本类文件可全文检索
        d.content || ''
      ].join(' ').toLowerCase();
      return hay.indexOf(kw) >= 0;
    });
  }

  /* ------------------------------------------------------------ 渲染 */

  function render() {
    renderFilters();
    renderList();
    updateStorageInfo();
  }

  function renderFilters() {
    var counts = {};
    state.docs.forEach(function (d) {
      counts[d.category] = (counts[d.category] || 0) + 1;
    });

    var box = U.$('#doc-filters');
    var html = CATEGORIES.map(function (c) {
      var n = c === '全部' ? state.docs.length : (counts[c] || 0);
      if (n === 0 && c !== '全部') return '';
      return '<span class="chip' + (state.category === c ? ' active' : '') +
        '" data-cat="' + U.escapeHtml(c) + '">' + U.escapeHtml(c) +
        '<span class="count">' + n + '</span></span>';
    }).join('');
    box.innerHTML = html;

    U.$$('#doc-filters .chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.category = chip.getAttribute('data-cat');
        render();
      });
    });
  }

  function renderList() {
    var list = filtered();
    var box = U.$('#doc-list');

    if (!list.length) {
      box.innerHTML = '<div class="empty"><div class="icon">📂</div>' +
        '<h3>' + (state.docs.length ? '没有匹配的文件' : '文件中心还是空的') + '</h3>' +
        '<p class="small">' +
        (state.docs.length
          ? '试试换个关键词，或点「全部」查看所有文件。'
          : (guard2()
            ? '点击右上角「导入文件」把保研推免、评奖评优等文件放进来，也可以新建文本或添加网页链接。'
            : '管理员还没有发布任何文件，请稍后再来看看。')) +
        '</p></div>';
      return;
    }

    box.innerHTML = list.map(function (d) {
      var type = d.fileType || 'txt';
      var meta = [
        d.category,
        d.college,
        d.year ? d.year + ' 年' : '',
        d.size ? U.formatBytes(d.size) : '',
        d.addedAt ? U.formatDate(d.addedAt) : ''
      ].filter(Boolean);

      return '<div class="doc-item" data-id="' + U.escapeHtml(d.id) + '">' +
        '<div class="doc-icon ' + type + '">' + (TYPE_LABEL[type] || '文件') + '</div>' +
        '<div class="doc-main">' +
        '<b>' + U.escapeHtml(d.title) + (d.placeholder ? ' <span class="tag tag-muted">占位</span>' : '') + '</b>' +
        '<div class="doc-meta">' + meta.map(function (m) {
          return '<span>' + U.escapeHtml(m) + '</span>';
        }).join('') + '</div>' +
        (d.description ? '<div class="small muted" style="margin-top:3px">' +
          U.escapeHtml(d.description) + '</div>' : '') +
        '</div>' +
        '<div class="btn-row">' +
        '<button class="btn btn-sm btn-primary" data-preview="' + U.escapeHtml(d.id) + '">查看</button>' +
        adminButtons(d) +
        '</div></div>';
    }).join('');

    U.$$('#doc-list [data-preview]').forEach(function (b) {
      b.addEventListener('click', function () { openPreview(byId(b.getAttribute('data-preview'))); });
    });
    U.$$('#doc-list [data-edit-doc]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!guard('编辑文件')) return;
        editDoc(byId(b.getAttribute('data-edit-doc')));
      });
    });
    U.$$('#doc-list [data-del-doc]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!guard('删除文件')) return;
        var d = byId(b.getAttribute('data-del-doc'));
        if (!d) return;
        if (!confirm('确定删除「' + d.title + '」？')) return;
        state.docs = state.docs.filter(function (x) { return x.id !== d.id; });
        save(); render();
        U.toast('已删除', 'ok');
      });
    });
  }

  function byId(id) {
    return state.docs.filter(function (d) { return String(d.id) === String(id); })[0];
  }

  function updateStorageInfo() {
    var box = U.$('#doc-alert');
    var embed = totalEmbedSize();

    // 只读发布版：说明内容来源
    if (state.source === 'bundled' && !guard2()) {
      box.innerHTML = '<div class="alert alert-info">' +
        '这些文件由管理员统一整理发布，共 <strong>' + state.docs.length +
        '</strong> 条。你可以在下方按分类筛选或搜索关键词，点「查看」在线预览。</div>';
      return;
    }
    if (embed > MAX_TOTAL_SIZE * 0.8) {
      box.innerHTML = '<div class="alert alert-warn">' +
        '本地已存放约 ' + U.formatBytes(embed) + ' 的文件内容，接近浏览器上限（约 5MB）。' +
        '建议：大文件改用「添加链接」指向网盘/校园网地址，或先导出备份后删除部分文件。</div>';
    } else {
      box.innerHTML = '';
    }
  }

  /* ------------------------------------------------------------ 权限 */

  /**
   * 检查当前是否可编辑。返回 false 时给出提示并中止操作。
   * 这些守卫是「运行时」的，不能只靠界面上隐藏按钮。
   */
  function guard(action) {
    if (auth() && auth().canEdit()) return true;
    if (auth()) auth().requireAdmin(action);
    else U.toast('请先用管理员密码登录', 'warn');
    return false;
  }

  /** 列表项上的管理按钮只在管理员身份下渲染 */
  function adminButtons(d) {
    if (!guard2()) return '';
    return '<button class="btn btn-sm" data-edit-doc="' + U.escapeHtml(d.id) + '">编辑</button>' +
      '<button class="btn btn-sm btn-danger" data-del-doc="' + U.escapeHtml(d.id) + '">删除</button>';
  }

  /** 静默判断，不弹提示（用于渲染时决定是否画按钮） */
  function guard2() {
    return !!(auth() && auth().canEdit());
  }

  /* ------------------------------------------------------------ 预览 */

  function openPreview(d) {
    if (!d) return;
    var body = U.el('div', {});
    var type = d.fileType || 'txt';

    // 元信息
    body.appendChild(U.el('div', { class: 'small muted mb-2' }, [
      [d.category, d.college, d.year ? d.year + ' 年' : '', d.source].filter(Boolean).join(' · ')
    ].join(' ')));

    if (d.description) {
      body.appendChild(U.el('div', { class: 'alert alert-info' }, d.description));
    }

    if (d.placeholder) {
      body.appendChild(U.el('div', { class: 'alert alert-warn' },
        '这是一条占位记录。请点「编辑」把它替换为真实文件信息，或点「导入文件」上传正式文件后删除本条。'));
    }

    // 内容区
    if (d.url) {
      body.appendChild(U.el('div', { class: 'mb-2' }, [
        U.el('a', { href: d.url, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn-primary' },
          '🔗 在新标签页打开链接')
      ]));
      body.appendChild(U.el('p', { class: 'small muted' }, '链接地址：' + d.url));
    } else if (d.fileData) {
      if (type === 'pdf') {
        body.appendChild(U.el('iframe', { class: 'preview-frame', src: d.fileData, title: d.title }));
      } else if (type === 'img') {
        body.appendChild(U.el('img', { class: 'preview-img', src: d.fileData, alt: d.title }));
      } else {
        // doc/xls 等交给浏览器或下载
        body.appendChild(U.el('div', { class: 'alert alert-info' },
          '这类文件无法在网页内直接预览，请点下方「下载文件」用本机应用打开。'));
      }
    } else if (d.content) {
      var pre = U.el('pre', {
        style: 'white-space:pre-wrap;word-break:break-word;background:var(--surface-2);' +
          'padding:14px;border-radius:8px;border:1px solid var(--border);' +
          'font-family:inherit;font-size:13.5px;line-height:1.8;max-height:56vh;overflow:auto;margin:0'
      }, d.content);
      body.appendChild(pre);
    } else {
      body.appendChild(U.el('div', { class: 'empty' }, [
        U.el('div', { class: 'icon' }, '📄'),
        U.el('p', { class: 'small' }, '这个条目还没有正文内容，点「编辑」补充说明或导入文件。')
      ]));
    }

    var buttons = [];
    if (d.fileData) {
      buttons.push({
        text: '⬇ 下载文件', cls: 'btn', onClick: function () {
          U.download(d.fileName || (d.title + '.' + d.fileType), dataURLtoBlob(d.fileData));
        }
      });
    } else if (d.content) {
      buttons.push({
        text: '⬇ 导出为 TXT', cls: 'btn', onClick: function () {
          U.download(d.title + '.txt', d.content, 'text/plain;charset=utf-8');
        }
      });
    }
    buttons.push({ text: '关闭', cls: 'btn btn-primary', onClick: global.TimetableView.closeModal });

    global.TimetableView.buildModal(
      d.title,
      body,
      buttons
    );
  }

  function dataURLtoBlob(dataURL) {
    var parts = dataURL.split(',');
    var mime = parts[0].match(/:(.*?);/)[1];
    var bin = atob(parts[1]);
    var len = bin.length;
    var arr = new Uint8Array(len);
    for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /* ------------------------------------------------------------ 编辑 */

  function editDoc(d) {
    if (!guard('新建或编辑文件')) return;
    var isNew = !d;
    d = d || {
      id: U.uid('doc'), title: '', category: '其它', college: '', year: '',
      fileType: 'txt', size: 0, addedAt: Date.now(), source: '手动录入',
      description: '', tags: [], content: ''
    };

    var f = {};
    var body = U.el('div', { class: 'grid grid-2' });
    function field(label, key, value, type, opts) {
      var input;
      if (type === 'select') {
        input = U.el('select', {});
        (opts || []).forEach(function (o) {
          input.appendChild(U.el('option', { value: o, selected: o === value ? 'selected' : null }, o));
        });
      } else if (type === 'textarea') {
        input = U.el('textarea', { value: value || '' });
      } else {
        input = U.el('input', { type: 'text', value: value || '' });
      }
      f[key] = input;
      body.appendChild(U.el('div', { class: 'field' + (type === 'textarea' ? ' grid-span-2' : '') }, [
        U.el('label', {}, label), input
      ]));
    }

    field('标题', 'title', d.title);
    field('分类', 'category', d.category, 'select', CATEGORIES.filter(function (c) { return c !== '全部'; }));
    field('适用学院', 'college', d.college);
    field('年份', 'year', d.year);
    field('来源', 'source', d.source);
    field('标签（逗号分隔）', 'tags', (d.tags || []).join(','));
    field('网页链接（可选）', 'url', d.url || '');
    field('说明', 'description', d.description);
    field('正文内容（文本类文件用）', 'content', d.content || '', 'textarea');

    var buttons = [{ text: '取消', cls: 'btn', onClick: global.TimetableView.closeModal }];
    buttons.push({
      text: isNew ? '创建' : '保存', cls: 'btn btn-primary', onClick: function () {
        if (!f.title.value.trim()) { U.toast('标题不能为空', 'error'); return; }
        d.title = f.title.value.trim();
        d.category = f.category.value;
        d.college = f.college.value.trim();
        d.year = f.year.value.trim();
        d.source = f.source.value.trim();
        d.tags = f.tags.value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
        d.url = f.url.value.trim();
        d.description = f.description.value.trim();
        d.content = f.content.value;
        d.placeholder = false;
        if (d.url) d.fileType = 'link';
        if (!d.addedAt) d.addedAt = Date.now();

        if (isNew) state.docs.unshift(d);
        save(); render();
        global.TimetableView.closeModal();
        U.toast(isNew ? '已创建' : '已保存', 'ok');
      }
    });

    global.TimetableView.buildModal(isNew ? '新建文件条目' : '编辑文件条目', body, buttons);
  }

  /* ------------------------------------------------------------ 导入 */

  function importFiles(files) {
    if (!files || !files.length) return;
    // 上传权限检查：普通用户即使绕过界面也无法导入
    if (!guard('上传文件')) return;
    var arr = Array.prototype.slice.call(files);
    var remaining = arr.length;
    var added = 0, skipped = [];

    // 逐个读取（串行，避免一次性占满内存）
    var queue = arr.slice();

    function next() {
      if (!queue.length) {
        save(); render();
        var msg = '已导入 ' + added + ' 个文件';
        if (skipped.length) msg += '，' + skipped.length + ' 个因过大仅记录目录（' + skipped.join('、') + '）';
        U.toast(msg, added ? 'ok' : 'warn');
        return;
      }
      var file = queue.shift();
      var ext = (file.name.split('.').pop() || '').toLowerCase();
      var type = extToType(ext);

      var doc = {
        id: U.uid('doc'),
        title: file.name.replace(/\.[^.]+$/, ''),
        category: guessCategory(file.name),
        college: '',
        year: String(new Date().getFullYear()),
        fileType: type,
        fileName: file.name,
        size: file.size,
        addedAt: Date.now(),
        source: '本机导入',
        description: '',
        tags: [],
        content: '',
        url: ''
      };

      if (file.size > MAX_EMBED_SIZE || totalEmbedSize() + file.size * 1.4 > MAX_TOTAL_SIZE) {
        // 太大：只存元信息
        skipped.push(file.name);
        doc.description = '文件较大（' + U.formatBytes(file.size) +
          '），未存入浏览器本地存储。请保留原文件，或改用「添加链接」。';
        state.docs.unshift(doc);
        next();
        return;
      }

      var reader = type === 'txt'
        ? U.readFileAsText(file).then(function (text) { doc.content = text; })
        : U.readFileAsDataURL(file).then(function (dataUrl) { doc.fileData = dataUrl; });

      reader.then(function () {
        state.docs.unshift(doc);
        added++;
        next();
      }).catch(function (e) {
        console.warn('[docs] 读取失败', file.name, e);
        doc.description = '读取失败：' + e.message;
        state.docs.unshift(doc);
        skipped.push(file.name);
        next();
      });
    }
    next();
  }

  function extToType(ext) {
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx', 'rtf', 'odt'].indexOf(ext) >= 0) return 'doc';
    if (['xls', 'xlsx', 'csv', 'ods'].indexOf(ext) >= 0) return 'xls';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].indexOf(ext) >= 0) return 'img';
    return 'txt';
  }

  function guessCategory(filename) {
    var n = filename;
    if (/推免|保研|免试|研究生/.test(n)) return '保研推免';
    if (/奖|评优|测评|综测|助学金|奖学金/.test(n)) return '评奖评优';
    if (/学籍|转专业|休学|复学|退学|毕业|学位/.test(n)) return '学籍管理';
    if (/校历|课表|选课|考试|教学|学期/.test(n)) return '教学运行';
    if (/体测|体质|体育|免测/.test(n)) return '体测体育';
    if (/培养方案|课程大纲|教学计划/.test(n)) return '培养方案';
    if (/指南|流程|办理|申请|办法/.test(n)) return '办事指南';
    return '其它';
  }

  function exportCatalog() {
    if (!guard('导出目录')) return;
    if (!state.docs.length) { U.toast('还没有文件', 'warn'); return; }
    // 导出目录（不含文件本体，便于分享）
    var catalog = state.docs.map(function (d) {
      return {
        title: d.title, category: d.category, college: d.college, year: d.year,
        fileType: d.fileType, size: d.size, source: d.source,
        description: d.description, tags: d.tags, url: d.url,
        hasContent: !!d.content, hasFile: !!d.fileData
      };
    });
    U.downloadJSON('文件目录_' + U.formatDate(Date.now()) + '.json', catalog);
    U.toast('已导出目录（不含文件本体）', 'ok');
  }

  /* ------------------------------------------------------------ 初始化 */

  function init() {
    load();
    render();

    U.$('#doc-search').addEventListener('input', U.debounce(function (e) {
      state.keyword = e.target.value;
      renderList();
    }, 180));

    // 管理员专用按钮：只读发布版里这些元素会被打包工具剥离，
    // 因此必须先判断元素存在再绑定 —— 否则 U.$() 返回 null，绑定就抛错，
    // 整个站点会白屏（实测踩过这个坑）。
    var addFileBtn = U.$('#doc-add-file');
    var fileInput = U.$('#doc-file');
    if (addFileBtn && fileInput) {
      addFileBtn.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function (e) {
        importFiles(e.target.files);
        e.target.value = '';
      });
    }

    var addTextBtn = U.$('#doc-add-text');
    if (addTextBtn) addTextBtn.addEventListener('click', function () { editDoc(null); });

    var addLinkBtn = U.$('#doc-add-link');
    if (addLinkBtn) {
      addLinkBtn.addEventListener('click', function () {
        var d = {
          id: U.uid('doc'), title: '', category: '其它', college: '', year: '',
          fileType: 'link', size: 0, addedAt: Date.now(), source: '手动录入',
          description: '', tags: [], content: '', url: 'https://'
        };
        editDoc(d);
      });
    }

    var exportBtn = U.$('#doc-export');
    if (exportBtn) exportBtn.addEventListener('click', exportCatalog);

    // 登录状态变化时重画列表（按钮的显隐随身份变）
    global.addEventListener('xzu:auth-changed', function () {
      render();
    });

    // 拖拽导入
    var page = U.$('#page-docs');
    page.addEventListener('dragover', function (e) {
      e.preventDefault();
      page.style.outline = '2px dashed var(--brand)';
    });
    page.addEventListener('dragleave', function () { page.style.outline = ''; });
    page.addEventListener('drop', function (e) {
      e.preventDefault();
      page.style.outline = '';
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        importFiles(e.dataTransfer.files);
      }
    });
  }

  global.DocsView = {
    init: init,
    render: render,
    openPreview: openPreview,
    importFiles: importFiles,

    /**
     * 仅供测试使用：替换内存中的文件库并尝试落盘。
     * 刻意走的是同一个 save() —— 也就是带权限守卫的那条路径，
     * 这样才能真正验证「绕过界面直接写入」会被拦住。
     */
    _setDocsForTest: function (docs) {
      state.docs = docs;
    },
    _testSave: function () {
      return save();
    },
    _source: function () { return state.source; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
