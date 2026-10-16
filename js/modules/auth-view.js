/**
 * 权限界面：登录弹窗、身份标识、管理员面板、只读提示条
 */
(function (global) {
  'use strict';

  var U = global.Utils;
  var Auth = global.Auth;

  /* ------------------------------------------------------ 登录弹窗 */

  function openLogin() {
    if (!Auth.hasPassword()) {
      U.toast('还没有设置管理员密码，请到「设置与备份」页设置', 'warn');
      global.App.goto('settings');
      return;
    }

    var box = U.el('div', {});
    box.appendChild(U.el('p', { class: 'small muted' },
      '管理员登录后才能在文件中心上传、编辑和删除文件。普通访问者无需登录，可直接浏览。'));

    var pwdInput = U.el('input', { type: 'password', placeholder: '管理员密码', autocomplete: 'current-password' });
    var remember = U.el('input', { type: 'checkbox', id: 'login-remember' });
    var errBox = U.el('div', {});

    box.appendChild(U.el('div', { class: 'field' }, [
      U.el('label', {}, '密码'), pwdInput
    ]));
    box.appendChild(U.el('label', { class: 'checkbox-line', for: 'login-remember' }, [
      remember, U.el('span', {}, '记住我 7 天（在共用电脑上请勿勾选）')
    ]));
    box.appendChild(errBox);

    function submit() {
      var res = Auth.login(pwdInput.value, remember.checked);
      if (res.ok) {
        global.TimetableView.closeModal();
        U.toast('已登录为管理员', 'ok');
        refresh();
        global.docsEvent('auth-changed');
      } else {
        errBox.innerHTML = '<div class="alert alert-err mb-0">' + U.escapeHtml(res.reason) + '</div>';
        pwdInput.value = '';
        pwdInput.focus();
      }
    }

    pwdInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
    });

    var mask = global.TimetableView.buildModal('管理员登录', box, [
      { text: '取消', cls: 'btn', onClick: global.TimetableView.closeModal },
      { text: '登录', cls: 'btn btn-primary', onClick: submit }
    ]);
    setTimeout(function () { pwdInput.focus(); }, 50);
    return mask;
  }

  /* ------------------------------------------------------ 界面刷新 */

  function refresh() {
    var admin = Auth.isAdmin();
    var published = Auth.isPublished();
    // 注意：这里判断的是「要不要给登录入口」，不是「能不能改密码」。
    // 发布版即使密码是打包烧入的（改不了密码），也必须保留登录按钮，
    // 否则管理员在线上根本没有地方可以登录。
    var loginAvailable = Auth.showAdminEntry();

    // 顶栏身份标识
    var badge = U.$('#role-badge');
    if (badge) {
      if (!loginAvailable) {
        badge.textContent = '只读浏览';
        badge.className = 'role-badge role-guest';
        badge.title = '本站为只读发布版，文件由管理员统一维护';
      } else if (admin) {
        badge.textContent = '管理员';
        badge.className = 'role-badge role-admin';
        badge.title = '你已登录为管理员，可以维护文件中心';
      } else {
        badge.textContent = '普通访客';
        badge.className = 'role-badge role-guest';
        badge.title = Auth.hasPassword() ? '浏览模式，管理员可登录后维护文件' : '尚未设置管理员密码';
      }
    }

    // 顶栏登录/退出按钮
    var btn = U.$('#auth-btn');
    if (btn) {
      if (!loginAvailable) {
        btn.style.display = 'none';
      } else if (admin) {
        btn.style.display = '';
        btn.textContent = '退出管理员';
        btn.className = 'btn btn-sm';
        btn.onclick = function () {
          Auth.logout();
          U.toast('已退出管理员登录', 'ok');
          refresh();
          global.docsEvent('auth-changed');
        };
      } else if (Auth.hasPassword()) {
        btn.style.display = '';
        btn.textContent = '🔒 管理员登录';
        btn.className = 'btn btn-sm';
        btn.onclick = openLogin;
      } else {
        btn.style.display = '';
        btn.textContent = '⚙️ 设置管理员密码';
        btn.className = 'btn btn-sm';
        btn.onclick = function () { global.App.goto('settings'); };
      }
    }

    // 文件中心：管理员操作区
    var docActions = U.$('#doc-admin-actions');
    if (docActions) docActions.style.display = Auth.canEdit() ? '' : 'none';

    var docLogin = U.$('#doc-admin-login');
    if (docLogin) {
      var showLogin = !Auth.canEdit() && Auth.hasPassword() && Auth.showAdminEntry();
      docLogin.style.display = showLogin ? '' : 'none';
      docLogin.onclick = openLogin;
    }

    // 设置页权限卡片
    var card = U.$('#card-security');
    if (card) card.style.display = Auth.canManagePassword() ? '' : 'none';
    renderSecurityBox();

    // 只读提示条
    var bar = U.$('#readonly-bar');
    if (bar) {
      if (published) {
        bar.style.display = '';
        U.$('#readonly-text').innerHTML = loginAvailable
          ? '📖 当前为<strong>只读发布模式</strong>：文件内容由管理员维护，普通访问者可自由浏览与检索。'
          : '📖 本站为<strong>只读发布版</strong>：文件由管理员统一维护，仅提供浏览与检索。';
      } else {
        bar.style.display = 'none';
      }
    }
  }

  function renderSecurityBox() {
    var box = U.$('#auth-status-box');
    if (!box) return;

    var has = Auth.hasPassword();
    var admin = Auth.isAdmin();

    if (!has) {
      box.innerHTML = '<div class="alert alert-info">' +
        '<strong>当前未设置管理员密码</strong>，文件中心处于只读状态，' +
        '任何人都无法上传、编辑或删除文件。<br>' +
        '要维护文件，请先在下方设置管理员密码，设置后当前设备即成为管理员。' +
        '把站点发给同学时，建议用只读打包版本，那样发布版里根本不含上传功能。</div>';
    } else if (admin) {
      box.innerHTML = '<div class="alert alert-ok">' +
        '<strong>✓ 已设置管理员密码，当前已登录为管理员</strong>，可以维护文件中心。<br>' +
        '普通访客看到的是只读界面，没有上传/编辑/删除入口。</div>';
    } else {
      var lock = Auth.lockRemaining();
      box.innerHTML = '<div class="alert alert-warn">' +
        '<strong>已设置管理员密码，当前为普通访客身份</strong>。' +
        (lock > 0 ? '登录已锁定，请 ' + Math.ceil(lock / 60000) + ' 分钟后再试。' : '') +
        '<br>要维护文件，请点右上角「🔒 管理员登录」。</div>';
    }

    var lbl = U.$('#auth-pwd-label');
    if (lbl) lbl.textContent = has ? '设置新密码' : '设置管理员密码';

    var oldField = U.$('#auth-old-pwd-field');
    if (oldField) oldField.style.display = has ? '' : 'none';

    // 已设置密码时，取消密码保护按钮只在已登录时可用
    var removeBtn = U.$('#auth-remove-pwd');
    if (removeBtn) removeBtn.style.display = has ? '' : 'none';

    var logoutBtn = U.$('#auth-logout');
    if (logoutBtn) logoutBtn.style.display = admin ? '' : 'none';

    var saveBtn = U.$('#auth-save-pwd');
    if (saveBtn) saveBtn.textContent = has ? '修改密码' : '设置密码';
  }

  /* ------------------------------------------------------ 初始化 */

  function init() {
    refresh();

    U.$('#auth-save-pwd').addEventListener('click', function () {
      var pwd = U.$('#auth-new-pwd').value;
      var pwd2 = U.$('#auth-new-pwd2').value;
      var old = U.$('#auth-old-pwd').value;

      if (!pwd) { U.toast('请输入新密码', 'warn'); return; }
      if (pwd.length < 4) { U.toast('密码至少 4 位', 'warn'); return; }
      if (pwd !== pwd2) { U.toast('两次输入的密码不一致', 'error'); return; }

      try {
        if (Auth.hasPassword()) {
          if (!old) { U.toast('请输入原密码', 'warn'); return; }
          Auth.changePassword(old, pwd);
          U.toast('密码已修改', 'ok');
        } else {
          Auth.setPassword(pwd);
          U.toast('管理员密码已设置，现在只有管理员能上传文件', 'ok');
        }
        U.$('#auth-new-pwd').value = '';
        U.$('#auth-new-pwd2').value = '';
        U.$('#auth-old-pwd').value = '';
        refresh();
        global.docsEvent('auth-changed');
      } catch (e) {
        U.toast(e.message, 'error');
      }
    });

    U.$('#auth-logout').addEventListener('click', function () {
      Auth.logout();
      U.toast('已退出管理员登录', 'ok');
      refresh();
      global.docsEvent('auth-changed');
    });

    U.$('#auth-remove-pwd').addEventListener('click', function () {
      if (!confirm('取消密码保护后，任何人都能在文件中心上传和删除文件。确定继续？')) return;
      var pwd = prompt('请输入当前管理员密码以确认：');
      if (pwd === null) return;
      try {
        Auth.removePassword(pwd);
        U.toast('已取消密码保护', 'ok');
        refresh();
        global.docsEvent('auth-changed');
      } catch (e) {
        U.toast(e.message, 'error');
      }
    });

    // 密码输入框回车提交
    ['#auth-new-pwd', '#auth-new-pwd2', '#auth-old-pwd'].forEach(function (sel) {
      var node = U.$(sel);
      if (node) node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') U.$('#auth-save-pwd').click();
      });
    });
  }

  /**
   * 监听身份变化并自动重绘。
   *
   * 放在这里而不是让每个调用方手动 refresh()：登录状态可能从任何地方改变
   * （登录弹窗、登出按钮、控制台、测试脚本），漏掉一处界面就会停在旧状态 ——
   * 该出现的上传按钮不出现，该消失的还留着。
   */
  global.addEventListener('xzu:auth-changed', function () {
    refresh();
  });

  global.AuthView = {
    init: init,
    refresh: refresh,
    openLogin: openLogin
  };
})(typeof window !== 'undefined' ? window : globalThis);
