/**
 * 通用工具函数
 */
(function (global) {
  'use strict';

  /* ---------------- DOM ---------------- */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /**
   * 创建元素
   * el('div', { class: 'x', onclick: fn }, [child, '文本'])
   */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class' || k === 'className') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'dataset') {
          Object.keys(v).forEach(function (dk) { node.dataset[dk] = v[dk]; });
        } else if (k.indexOf('on') === 0 && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === 'style' && typeof v === 'object') {
          Object.assign(node.style, v);
        } else {
          node.setAttribute(k, v);
        }
      });
    }
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children === null || children === undefined) return;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number'
        ? document.createTextNode(String(c))
        : c);
    });
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* ---------------- 提示 ---------------- */

  var toastTimer = null;
  function toast(message, type) {
    var box = $('#toast');
    if (!box) {
      box = el('div', { id: 'toast', class: 'toast' });
      document.body.appendChild(box);
    }
    box.textContent = message;
    box.className = 'toast show' + (type ? ' toast-' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.className = 'toast'; }, 2600);
  }

  /* ---------------- 下载 / 文件 ---------------- */

  function download(filename, content, mime) {
    var blob = content instanceof Blob
      ? content
      : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function downloadJSON(filename, obj) {
    download(filename, JSON.stringify(obj, null, 2), 'application/json;charset=utf-8');
  }

  function readFileAsText(file, encoding) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var buf = reader.result;
        var text = new TextDecoder(encoding || 'utf-8').decode(buf);
        // UTF-8 解码出现大量替换字符时，回退到 GBK（教务系统导出常见）
        if (!encoding) {
          var bad = (text.match(/\uFFFD/g) || []).length;
          if (bad > 3) {
            try { text = new TextDecoder('gb18030').decode(buf); } catch (e) { /* ignore */ }
          }
        }
        resolve(text.replace(/^\uFEFF/, ''));
      };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(file);
    });
  }

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }

  function formatBytes(n) {
    if (!n && n !== 0) return '-';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  /* ---------------- 时间 ---------------- */

  /**
   * 解析成绩录入的跑步用时，支持：
   *   "4'05\"" / "4′05″" / "4:05" / "4分05秒" / "405" / 245
   * 返回秒数；无法解析返回 null
   */
  function parseDuration(input) {
    if (input === null || input === undefined || input === '') return null;
    if (typeof input === 'number') return input > 0 ? input : null;
    var s = String(input).trim()
      .replace(/[′'’`]/g, "'")
      .replace(/[″"”]/g, '"')
      .replace(/分/g, "'")
      .replace(/秒/g, '"');

    // 形如 4'05" 或 4:05
    var m = s.match(/^(\d+)\s*[':：]\s*(\d+(?:\.\d+)?)/);
    if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2]);

    // 纯数字：>=100 视为总秒数，否则视为「分.秒」意义存疑 -> 按总秒数处理
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    return null;
  }

  /** 秒 -> mm'ss" */
  function formatDuration(sec) {
    if (sec === null || sec === undefined || isNaN(sec)) return '-';
    var m = Math.floor(sec / 60);
    var s = Math.round(sec - m * 60);
    if (s === 60) { m += 1; s = 0; }
    return m + "'" + (s < 10 ? '0' + s : s) + '"';
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function formatDate(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function formatDateTime(ts) {
    var d = new Date(ts);
    return formatDate(ts) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /* ---------------- 其它 ---------------- */

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 7);
  }

  function debounce(fn, wait) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait || 200);
    };
  }

  function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  /** 深拷贝（结构化数据） */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /** 简单的 CSV 行解析（支持双引号包裹） */
  function parseCSV(text) {
    var rows = [];
    var row = [], field = '', inQuote = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuote) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuote = false;
        } else field += c;
      } else {
        if (c === '"') inQuote = true;
        else if (c === ',' || c === '\t') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* skip */ }
        else field += c;
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  /**
   * 全局事件广播。放在最底层的 utils 里，避免依赖具体模块的加载顺序
   * （auth-view 需要通知 docs-view 刷新，但两者谁先加载不该成为隐患）。
   */
  global.docsEvent = function (name) {
    global.dispatchEvent(new CustomEvent('xzu:' + name));
  };

  global.Utils = {
    $: $, $$: $$, el: el, clear: clear, toast: toast,
    download: download, downloadJSON: downloadJSON,
    readFileAsText: readFileAsText, readFileAsDataURL: readFileAsDataURL,
    formatBytes: formatBytes,
    parseDuration: parseDuration, formatDuration: formatDuration,
    formatDate: formatDate, formatDateTime: formatDateTime, pad2: pad2,
    uid: uid, debounce: debounce, escapeHtml: escapeHtml, clamp: clamp,
    clone: clone, parseCSV: parseCSV
  };
})(typeof window !== 'undefined' ? window : globalThis);
