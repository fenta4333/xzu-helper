/**
 * 权限控制模块：管理员 / 普通用户
 *
 * ⚠️ 必须清楚的局限性（写在代码里，也写进 README）：
 *   本站是纯静态网页，没有服务端。所以这套权限只能做到：
 *     ✅ 普通用户界面上完全看不到上传/编辑/删除入口
 *     ✅ 数据写入函数有运行时守卫，误调用也不会写进去
 *     ✅ 密码以加盐 SHA-256 保存，带失败锁定
 *     ❌ 挡不住懂技术的人打开 DevTools 篡改内存里的判断，或直接改本地文件
 *   要做到真正不可绕过，必须有服务端鉴权。静态站点做不到，这是原理限制。
 *
 * 因此发布给同学时有两个模式：
 *   - 普通模式：上传入口对未登录者隐藏，管理员可用密码登录后维护
 *   - 只读发布模式（tools/pack.mjs --hard）：打包时物理剥离管理员代码，
 *     连密码校验函数都不存在，任何人都无法上传
 */
(function (global) {
  'use strict';

  var Store = global.Store;
  var sha256 = global.Sha256;
  var safeEqual = global.Sha256Equal;

  var KEY = 'xzu.auth.v1';
  var SESSION_KEY = 'xzu.auth.session.v1';

  /** 连续失败几次后锁定 */
  var MAX_ATTEMPTS = 5;
  /** 锁定时长（毫秒） */
  var LOCK_MS = 5 * 60 * 1000;
  /** 「记住我」登录状态有效期 */
  var REMEMBER_MS = 7 * 24 * 60 * 60 * 1000;

  var state = {
    /** 当前会话是否已通过管理员验证 */
    admin: false,
    /** 只读发布模式（打包生成） */
    published: false,
    /** 只读模式下是否还保留管理员入口（--hard 时为 false） */
    allowAdminLogin: true
  };

  /* ---------------------------------------------------------- 工具 */

  function randomSalt() {
    var bytes = new Uint8Array(16);
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.prototype.map.call(bytes, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  function hashPassword(password, salt) {
    return sha256(salt + '::' + password + '::xzu-helper');
  }

  /**
   * 广播「身份状态变了」。
   *
   * 由 auth 模块自己在状态变化时调用，而不是让每个调用方记得去通知界面 ——
   * 否则只要有入口忘记通知（登录弹窗、控制台调用、测试脚本……），
   * 界面就会停留在旧的权限状态：按钮该出现的不出现，该消失的不消失。
   */
  function notifyChanged() {
    if (typeof global.docsEvent === 'function') global.docsEvent('auth-changed');
  }

  /* ---------------------------------------------------------- 配置 */

  /**
   * 打包时烧进发布版的管理员凭据（js/data/admin.js 里的 window.XZU_ADMIN）。
   *
   * 为什么需要它：localStorage 是「每个浏览器各自的」，密码不会跟着网站走。
   * 如果不烧进去，部署到 GitHub Pages 后会有两个后果：
   *   1. 管理员在自己电脑上设的密码在线上不存在，登录不了；
   *   2. 第一个访问的人可以把密码抢注成自己的，真正的主人反而进不去。
   * 所以把 hash + salt 直接写进发布版，成为所有人共享、且任何人都改不掉的凭据。
   */
  function getBakedCredential() {
    var baked = global.XZU_ADMIN;
    if (baked && baked.hash && baked.salt) return baked;
    return null;
  }

  /** 读取管理员凭据；烧进发布版的优先，其次才是本地设置 */
  function getCredential() {
    return getBakedCredential() || Store.read(KEY, null);
  }

  /** 是否已设置管理员密码 */
  function hasPassword() {
    var c = getCredential();
    return !!(c && c.hash && c.salt);
  }

  /**
   * 设置（或修改）管理员密码
   * @param {string} newPassword
   * @param {string} [oldPassword] 已设置过密码时必须提供旧密码
   */
  function setPassword(newPassword, oldPassword) {
    if (!newPassword || String(newPassword).length < 4) {
      throw new Error('密码至少 4 位');
    }
    if (getBakedCredential()) {
      // 发布版里的凭据是所有人共享的，改掉它只影响自己这台浏览器，
      // 与其让人误以为「改成功了」，不如直接说清楚。
      throw new Error('本发布版的管理员密码由维护者在打包时确定，无法在网页上修改');
    }
    if (hasPassword()) {
      if (!verifyPassword(oldPassword)) {
        throw new Error('原密码不正确');
      }
    }
    var salt = randomSalt();
    Store.write(KEY, {
      salt: salt,
      hash: hashPassword(newPassword, salt),
      updatedAt: Date.now()
    });
    state.admin = true;
    persistSession(true);
    return true;
  }

  /** 取消管理员密码保护（需要当前密码） */
  function removePassword(password) {
    if (getBakedCredential()) {
      throw new Error('本发布版的管理员密码由维护者在打包时确定，无法在网页上取消');
    }
    if (!verifyPassword(password)) throw new Error('密码不正确');
    Store.remove(KEY);
    // 必须用 clearSession()，它会同时清 sessionStorage 和 localStorage。
    // 不能只调 Store.remove(SESSION_KEY)：Store 只认 localStorage，
    // 而普通登录的会话是写在 sessionStorage 里的，那样会残留一个
    // 仍然有效的「管理员」会话，取消密码后刷新页面又变成管理员。
    clearSession();
    state.admin = false;
    notifyChanged();
    notifyChanged();
    return true;
  }

  /**
   * 校验密码是否正确（不改变登录状态），带失败锁定
   * @returns {{ok:boolean, reason?:string, remaining?:number}}
   */
  function verifyPassword(password) {
    var cred = getCredential();
    if (!cred) return false;

    var lock = Store.read(KEY + '.lock', null);
    if (lock && lock.until > Date.now()) {
      return false;
    }

    var ok = safeEqual(hashPassword(String(password || ''), cred.salt), cred.hash);

    if (ok) {
      Store.remove(KEY + '.lock');
      return true;
    }

    // 记录失败次数。
    // 注意：能走到这里说明锁定期已过（上面已提前 return），所以直接累加即可。
    // 不要写成「lock.until <= Date.now() 就归零」——未锁定记录的 until 是 0，
    // 那个条件恒为真，会导致次数永远是 1，锁定永远不会触发。
    var attempts = ((lock && lock.attempts) || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      Store.write(KEY + '.lock', { attempts: 0, until: Date.now() + LOCK_MS });
    } else {
      Store.write(KEY + '.lock', { attempts: attempts, until: 0 });
    }
    return false;
  }

  /** 查询锁定剩余时间（毫秒），未锁定返回 0 */
  function lockRemaining() {
    var lock = Store.read(KEY + '.lock', null);
    if (!lock || !lock.until) return 0;
    return Math.max(0, lock.until - Date.now());
  }

  /** 剩余尝试次数 */
  function attemptsLeft() {
    var lock = Store.read(KEY + '.lock', null);
    if (!lock || lock.until) return MAX_ATTEMPTS;
    return Math.max(0, MAX_ATTEMPTS - (lock.attempts || 0));
  }

  /* ---------------------------------------------------------- 会话 */

  function persistSession(remember) {
    // sessionStorage：关掉标签页即失效
    // localStorage：记住 7 天
    var payload = { admin: true, exp: Date.now() + (remember ? REMEMBER_MS : 12 * 60 * 60 * 1000) };
    try {
      if (remember) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
      } else {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
      }
    } catch (e) {
      /* 存储不可用时退化为仅内存 */
    }
  }

  function restoreSession() {
    var raw = null;
    try {
      raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    } catch (e) {
      raw = null;
    }
    if (!raw) return false;
    try {
      var p = JSON.parse(raw);
      if (p && p.admin && p.exp > Date.now()) {
        state.admin = true;
        return true;
      }
    } catch (e) { /* 忽略损坏的会话 */ }
    clearSession();
    return false;
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
  }

  /**
   * 管理员登录
   * @returns {{ok:boolean, reason?:string}}
   */
  function login(password, remember) {
    if (!hasPassword()) return { ok: false, reason: '尚未设置管理员密码' };

    var locked = lockRemaining();
    if (locked > 0) {
      return { ok: false, reason: '尝试次数过多，已锁定，请 ' + Math.ceil(locked / 60000) + ' 分钟后再试' };
    }

    if (!verifyPassword(password)) {
      var left = attemptsLeft();
      return {
        ok: false,
        reason: left > 0 ? '密码错误，还可尝试 ' + left + ' 次' : '密码错误次数过多，已锁定 5 分钟'
      };
    }

    state.admin = true;
    persistSession(!!remember);
    notifyChanged();
    return { ok: true };
  }

  function logout() {
    state.admin = false;
    clearSession();
  }

  /* ---------------------------------------------------------- 判定 */

  /** 是否为管理员（已通过验证） */
  function isAdmin() {
    return state.admin === true;
  }

  /** 是否为只读发布模式 */
  function isPublished() {
    return state.published === true;
  }

  /**
   * 当前页面是不是「本机」打开的。
   *
   * file:// 双击打开、或 localhost / 127.0.0.1 都算本机；
   * 只要是通过网络访问的（含 GitHub Pages 这种 https 域名），就不算。
   */
  function isLocalOrigin() {
    var loc = global.location;
    if (!loc) return true;
    if (loc.protocol === 'file:') return true;
    var host = loc.hostname || '';
    return host === '' || host === 'localhost' || host === '127.0.0.1' ||
      host === '::1' || host === '[::1]';
  }

  /**
   * 是否可以编辑共享内容（上传 / 新增 / 修改 / 删除文件）
   *
   *  1. 硬只读发布版（published && !allowAdminLogin）→ 永远 false
   *  2. 已设置密码 → 只有登录后的管理员为 true
   *  3. 尚未设置密码：
   *       - 本机打开（file:// 或 localhost）→ true。
   *         这是管理员自己的电脑，第一次打开就该能导入文件，否则新用户一个都传不进去。
   *       - 通过网络访问 → false（**安全兜底**）。
   *         没设密码又把页面挂到网上，等于谁都能上传和删除。
   *         这条兜底专门防「不小心把源码目录部署到 GitHub Pages」这种情况：
   *         部署上去了也不会被人乱改，只是变成只读。
   *         管理员要远程维护，就设一个密码再登录。
   */
  function canEdit() {
    if (state.published && !state.allowAdminLogin) return false;
    if (!hasPassword()) return !state.published && isLocalOrigin();
    return isAdmin();
  }

  /** 只读的原因，用于给出准确提示（而不是笼统说「请登录」） */
  function readOnlyReason() {
    if (state.published && !state.allowAdminLogin) return 'readonly-release';
    if (!hasPassword()) {
      if (state.published) return 'published-no-password';
      if (!isLocalOrigin()) return 'remote-no-password';
      return null;
    }
    return 'not-logged-in';
  }

  /** 上传入口是否应该显示（未登录时也给管理员留一个入口） */
  function showAdminEntry() {
    if (isAdmin()) return true;
    if (state.published && !state.allowAdminLogin) return false;
    return true;
  }

  /** 是否允许设置/修改密码 */
  function canManagePassword() {
    if (state.published && !state.allowAdminLogin) return false;
    if (getBakedCredential()) return false;
    return true;
  }

  /**
   * 运行时写入守卫。所有会改动共享文件库的函数都必须先过这一关，
   * 不能只在界面上把按钮藏起来。
   */
  function requireAdmin(action) {
    if (canEdit()) return true;
    if (global.Utils && global.Utils.toast) {
      var reason = readOnlyReason();
      var msg;
      if (reason === 'readonly-release') {
        msg = '本站为只读发布版，文件由管理员统一维护';
      } else if (reason === 'remote-no-password') {
        msg = '本站通过网址访问且未设置管理员密码，为安全起见已自动只读';
      } else if (reason === 'published-no-password') {
        msg = '本站为公开发布版，未设置管理员密码，无法修改内容';
      } else {
        msg = '请先用管理员密码登录';
      }
      global.Utils.toast(msg, 'warn');
    }
    console.warn('[auth] 拦截未授权的写操作：' + (action || 'unknown'));
    return false;
  }

  /* ---------------------------------------------------------- 初始化 */

  function init(options) {
    options = options || {};

    // 发布模式来自打包脚本生成的 js/data/published.js
    if (global.XZU_PUBLISHED && global.XZU_PUBLISHED.mode === 'readonly') {
      state.published = true;
      state.allowAdminLogin = global.XZU_PUBLISHED.allowAdminLogin !== false;
    }
    // URL 参数也能临时进只读模式，方便预览
    if (/[?&]view=1/.test(global.location ? global.location.search : '')) {
      state.published = true;
    }

    if (typeof options.published === 'boolean') state.published = options.published;
    if (typeof options.allowAdminLogin === 'boolean') state.allowAdminLogin = options.allowAdminLogin;

    restoreSession();
    return state;
  }

  global.Auth = {
    init: init,
    state: state,

    isAdmin: isAdmin,
    isPublished: isPublished,
    canEdit: canEdit,
    isLocalOrigin: isLocalOrigin,
    readOnlyReason: readOnlyReason,
    showAdminEntry: showAdminEntry,
    canManagePassword: canManagePassword,
    requireAdmin: requireAdmin,

    hasPassword: hasPassword,
    setPassword: setPassword,
    removePassword: removePassword,
    changePassword: function (oldPwd, newPwd) {
      // 必须和 setPassword 一样先挡住烧入凭据。这里是历史上漏掉的一处：
      // 只改掉自己浏览器里的 localStorage，对别人毫无影响，却会让人
      // 误以为「密码已经换了」，下次在别的设备上登不进来。
      if (getBakedCredential()) {
        throw new Error('本发布版的管理员密码由维护者在打包时确定，无法在网页上修改');
      }
      if (!verifyPassword(oldPwd)) throw new Error('原密码不正确');
      var salt = randomSalt();
      Store.write(KEY, { salt: salt, hash: hashPassword(newPwd, salt), updatedAt: Date.now() });
      state.admin = true;
      persistSession(true);
      notifyChanged();
      return true;
    },

    login: login,
    logout: logout,
    lockRemaining: lockRemaining,
    attemptsLeft: attemptsLeft,

    // 供测试与打包脚本使用
    _hashPassword: hashPassword,
    _randomSalt: randomSalt,
    _MAX_ATTEMPTS: MAX_ATTEMPTS,
    _LOCK_MS: LOCK_MS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.Auth;
})(typeof window !== 'undefined' ? window : globalThis);
