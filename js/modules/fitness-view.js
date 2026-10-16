/**
 * 体测模块视图：成绩录入、计算、结果展示、评分标准查阅
 */
(function (global) {
  'use strict';

  var U = global.Utils;
  var S = global.FitnessStandard;
  var E = global.FitnessEngine;

  /** 各性别对应的项目清单与文案 */
  var GENDER_ITEMS = {
    male: [
      { key: 'vitalCapacity', label: '肺活量', unit: '毫升', placeholder: '如 4200' },
      { key: 'sprint50', label: '50 米跑', unit: '秒', placeholder: '如 7.5' },
      { key: 'sitReach', label: '坐位体前屈', unit: '厘米', placeholder: '可为负，如 12.3' },
      { key: 'standingJump', label: '立定跳远', unit: '厘米', placeholder: '如 235' },
      { key: 'strength', label: '引体向上', unit: '次', placeholder: '如 12' },
      { key: 'endurance', label: '1000 米跑', unit: '分′秒″', placeholder: "如 4'05\" 或 245" }
    ],
    female: [
      { key: 'vitalCapacity', label: '肺活量', unit: '毫升', placeholder: '如 3000' },
      { key: 'sprint50', label: '50 米跑', unit: '秒', placeholder: '如 8.5' },
      { key: 'sitReach', label: '坐位体前屈', unit: '厘米', placeholder: '可为负，如 15.2' },
      { key: 'standingJump', label: '立定跳远', unit: '厘米', placeholder: '如 180' },
      { key: 'strength', label: '1 分钟仰卧起坐', unit: '次', placeholder: '如 45' },
      { key: 'endurance', label: '800 米跑', unit: '分′秒″', placeholder: "如 3'45\" 或 225" }
    ]
  };

  var inputs = {};
  var lastResult = null;

  /* ---------------------------------------------------------- 表单 */

  function renderInputs() {
    var gender = U.$('#fit-gender').value;
    var box = U.$('#fit-inputs');
    U.clear(box);
    inputs = {};

    GENDER_ITEMS[gender].forEach(function (item) {
      var input = U.el('input', {
        type: 'text',
        inputmode: 'decimal',
        placeholder: item.placeholder,
        id: 'fit-in-' + item.key
      });
      inputs[item.key] = input;
      box.appendChild(U.el('div', { class: 'field', style: 'margin-bottom:0' }, [
        U.el('label', {}, [item.label, U.el('span', { class: 'muted small' }, '（' + item.unit + '）')]),
        input
      ]));
    });
  }

  function collectProfile() {
    return {
      gender: U.$('#fit-gender').value,
      grade: U.$('#fit-grade').value,
      heightCm: U.$('#fit-height').value,
      weightKg: U.$('#fit-weight').value
    };
  }

  function collectRecords() {
    var rec = {};
    Object.keys(inputs).forEach(function (k) { rec[k] = inputs[k].value.trim(); });
    return rec;
  }

  function validateInputs(profile, records) {
    var errors = [];
    if (!profile.heightCm) errors.push('请填写身高');
    else if (Number(profile.heightCm) < 100 || Number(profile.heightCm) > 250) errors.push('身高应在 100～250 厘米之间');
    if (!profile.weightKg) errors.push('请填写体重');
    else if (Number(profile.weightKg) < 20 || Number(profile.weightKg) > 200) errors.push('体重应在 20～200 千克之间');

    GENDER_ITEMS[profile.gender].forEach(function (item) {
      var v = records[item.key];
      if (v === '' || v === null || v === undefined) return; // 允许留空
      if (item.key === 'endurance') {
        if (E.parseDuration(v) === null) errors.push(item.label + ' 格式无法识别，请填 4\'05" 或 245');
      } else if (isNaN(Number(v))) {
        errors.push(item.label + ' 必须是数字');
      }
    });
    return errors;
  }

  function calculate() {
    var profile = collectProfile();
    var records = collectRecords();
    var errors = validateInputs(profile, records);
    if (errors.length) {
      U.$('#fit-result').innerHTML = '<div class="card"><div class="alert alert-err mb-0">' +
        errors.map(U.escapeHtml).join('<br>') + '</div></div>';
      return;
    }

    var result = E.evaluate(profile, records);
    lastResult = result;
    saveProfile(profile, records);
    renderResult(result);
  }

  function saveProfile(profile, records) {
    global.Store.write(global.Store.KEYS.fitnessProfile, {
      profile: profile,
      records: records,
      savedAt: Date.now()
    });
  }

  function restoreProfile() {
    var saved = global.Store.read(global.Store.KEYS.fitnessProfile, null);
    if (!saved) return false;
    var p = saved.profile || {};
    if (p.gender) U.$('#fit-gender').value = p.gender;
    if (p.grade) U.$('#fit-grade').value = p.grade;
    if (p.heightCm) U.$('#fit-height').value = p.heightCm;
    if (p.weightKg) U.$('#fit-weight').value = p.weightKg;
    renderInputs();
    var rec = saved.records || {};
    Object.keys(rec).forEach(function (k) {
      if (inputs[k] && rec[k]) inputs[k].value = rec[k];
    });
    return true;
  }

  /* ---------------------------------------------------------- 结果 */

  function renderResult(r) {
    var box = U.$('#fit-result');
    U.clear(box);

    var gradeCls = r.grade.cls;

    // 概览指标卡
    var metrics = U.el('div', { class: 'grid grid-4 mb-2' }, [
      metricCard(r.total + '', '总分', '满分 120', gradeCls),
      metricCard(r.standardScore + '', '标准分', '满分 100', ''),
      metricCard('+' + r.bonusTotal, '加分', '上限 20 分', ''),
      metricCard(r.grade.label, '等级', gradeHint(r), gradeCls)
    ]);
    box.appendChild(metrics);

    // 提示
    if (!r.complete) {
      box.appendChild(U.el('div', { class: 'alert alert-warn' },
        '以下项目未填写，暂未计入总分：' + r.missing.join('、') +
        '。补全后总分可能变化。'));
    }
    if (!r.meetsGraduation) {
      box.appendChild(U.el('div', { class: 'alert alert-err' },
        '⚠ 标准分低于 50 分。按《国家学生体质健康标准》规定，' +
        '普通高等学校学生毕业时测试成绩达不到 50 分按结业处理，请尽快加强锻炼。'));
    }

    // 明细表
    var tbody = '';
    r.details.forEach(function (d) {
      var scoreText = d.score === null
        ? '<span class="muted">未填写</span>'
        : '<b>' + d.score + '</b>';
      var barPct = d.score === null ? 0 : d.score;
      var barColor = d.score === null ? '#e3e8ef'
        : (d.score >= 80 ? 'var(--ok)' : (d.score >= 60 ? 'var(--accent)' : 'var(--err)'));
      tbody += '<tr>' +
        '<td>' + U.escapeHtml(d.label) + '</td>' +
        '<td class="muted small">' + (d.extra || '') + '</td>' +
        '<td class="num">' + (d.display === undefined || d.display === null ? '-' : U.escapeHtml(String(d.display))) + '</td>' +
        '<td class="num">' + scoreText + '</td>' +
        '<td style="width:90px"><div class="bar"><i style="width:' + barPct + '%;background:' + barColor + '"></i></div></td>' +
        '<td class="num muted">' + d.weight + '%</td>' +
        '<td class="num"><b>' + (d.weighted === null ? '-' : d.weighted) + '</b></td>' +
        '</tr>';
    });

    var detailTable = U.el('div', { class: 'scroll-x' }, [
      U.el('table', {
        class: 'data',
        html: '<thead><tr><th>项目</th><th>说明</th><th class="num">成绩</th>' +
          '<th class="num">单项得分</th><th>水平</th><th class="num">权重</th><th class="num">加权分</th></tr></thead>' +
          '<tbody>' + tbody +
          '<tr class="total-row"><td colspan="6">标准分合计</td>' +
          '<td class="num">' + r.standardScore + '</td></tr>' +
          '</tbody>'
      })
    ]);
    box.appendChild(U.el('div', { class: 'card' }, [
      U.el('h3', {}, '各项得分明细'),
      detailTable
    ]));

    // 加分表
    var bonusRows = r.bonus.map(function (b) {
      return U.el('tr', {}, [
        U.el('td', {}, b.label),
        U.el('td', { class: 'num muted small' }, String(b.display === undefined ? '-' : b.display)),
        U.el('td', { class: 'num muted small' }, b.base === null ? '-' : String(b.base)),
        U.el('td', { class: 'num muted small' }, b.over ? String(b.over) : '-'),
        U.el('td', { class: 'num' }, [U.el('b', {}, '+' + b.bonus)])
      ]);
    });
    var bonusUnit = r.profile.gender === 'male' ? '次' : '次';
    box.appendChild(U.el('div', { class: 'card' }, [
      U.el('h3', {}, '加分项'),
      U.el('div', { class: 'scroll-x' }, [
        U.el('table', { class: 'data' }, [
          U.el('thead', { html: '<tr><th>项目</th><th class="num">你的成绩</th><th class="num">100 分标准</th>' +
            '<th class="num">超出幅度</th><th class="num">加分</th></tr>' }),
          U.el('tbody', {}, bonusRows.concat([
            U.el('tr', { class: 'total-row' }, [
              U.el('td', { colspan: 4 }, '加分合计（上限 20 分）'),
              U.el('td', { class: 'num' }, '+' + r.bonusTotal)
            ])
          ]))
        ])
      ]),
      U.el('p', { class: 'small muted', style: 'margin:10px 0 0' },
        '「超出幅度」对引体向上 / 仰卧起坐是' + bonusUnit + '数，对跑步是比 100 分标准快的秒数。')
    ]));

    // 提升建议
    box.appendChild(U.el('div', { class: 'card' }, [
      U.el('h3', {}, '提升建议'),
      renderSuggestions(r)
    ]));

    // 期末总分换算说明
    box.appendChild(U.el('div', { class: 'card' }, [
      U.el('h3', {}, '成绩说明'),
      U.el('p', { class: 'small muted mb-0', html:
        '本工具按《国家学生体质健康标准（2014年修订）》大学组评分表计算：' +
        '标准分 = Σ(单项得分 × 权重) ÷ 100（满分 100），' +
        '加分仅限男生引体向上 / 1000 米跑、女生 1 分钟仰卧起坐 / 800 米跑（各上限 10 分，合计上限 20 分），' +
        '总分 = 标准分 + 加分（满分 120）。<br>' +
        '<strong>注意：</strong>学校可能有免测、缓测、替代项目或成绩折算等补充规定，' +
        '最终成绩以学校体育部门和教务处公布的结果为准，本站计算仅供参考。'
      })
    ]));
  }

  function metricCard(value, label, hint, cls) {
    return U.el('div', { class: 'metric' }, [
      U.el('div', { class: 'value ' + (cls || '') }, value),
      U.el('div', { class: 'label' }, label),
      U.el('div', { class: 'label', style: 'opacity:.75' }, hint)
    ]);
  }

  function gradeHint(r) {
    var gap = E.nextGradeGap(r);
    if (!gap) return '已达最高等级';
    if (!r.meetsGraduation) return '需尽快提升';
    return '距' + gap.next + '还差 ' + gap.gap + ' 分';
  }

  function renderSuggestions(r) {
    var list = [];
    var gap = E.nextGradeGap(r);

    // 找出得分最低且已填写的项目
    var filled = r.details.filter(function (d) { return d.score !== null; });
    var weakest = filled.slice().sort(function (a, b) { return a.score - b.score; })[0];

    if (gap && weakest) {
      // 估算提升该项目到下一档能带来多少总分
      list.push('距离<strong>' + gap.next + '</strong>还差 <strong>' + gap.gap +
        '</strong> 分。当前最薄弱的是「' + U.escapeHtml(weakest.label) + '」（单项 ' +
        weakest.score + ' 分，权重 ' + weakest.weight + '%），' +
        '把它提高 1 档约可增加 ' + (weakest.weight * 0.05).toFixed(2) + '～' +
        (weakest.weight * 0.05 * 2).toFixed(2) + ' 标准分。');
    }

    if (r.profile.gender === 'male') {
      list.push('男生加分机会：<strong>引体向上</strong>超过 100 分标准后每多 1 次加 1 分（最多 +10），' +
        '<strong>1000 米跑</strong>每快 4 秒加 1 分（最多 +10）。这两项是拿 100 分以上最直接的途径。');
    } else {
      list.push('女生加分机会：<strong>1 分钟仰卧起坐</strong>超过 100 分标准后每多 2 次加 1 分（最多 +10），' +
        '<strong>800 米跑</strong>每快 5 秒加 1 分（最多 +10）。这两项是拿 100 分以上最直接的途径。');
    }

    // BMI 异常提示
    var bmiEntry = r.details.filter(function (d) { return d.item === 'bmi'; })[0];
    if (bmiEntry && bmiEntry.score !== null && bmiEntry.score < 100) {
      list.push('体重指数（BMI）为 ' + bmiEntry.display + '，属于<strong>' + bmiEntry.extra +
        '</strong>，该项得 ' + bmiEntry.score + ' 分。BMI 受身高体重影响，本项评分规则按国家标准执行。');
    }

    if (!r.complete) {
      list.push('还有 <strong>' + r.missing.length + '</strong> 项未填写（' +
        r.missing.map(U.escapeHtml).join('、') + '），补全后结果才完整。');
    }

    return U.el('ul', {
      class: 'small',
      style: 'margin:0;padding-left:20px;line-height:1.9',
      html: list.map(function (s) { return '<li>' + s + '</li>'; }).join('')
    });
  }

  /* ------------------------------------------------------ 标准表查阅 */

  function renderStandard() {
    var gender = U.$('#std-gender').value;
    var band = U.$('#std-band').value;
    var rows = S.TABLES[gender][band];
    var isMale = gender === 'male';

    var head = '<tr><th>单项得分</th><th>等级</th><th class="num">肺活量<br><span class="muted small">毫升</span></th>' +
      '<th class="num">50 米跑<br><span class="muted small">秒</span></th>' +
      '<th class="num">坐位体前屈<br><span class="muted small">厘米</span></th>' +
      '<th class="num">立定跳远<br><span class="muted small">厘米</span></th>' +
      '<th class="num">' + (isMale ? '引体向上' : '1分钟仰卧起坐') + '<br><span class="muted small">次</span></th>' +
      '<th class="num">' + (isMale ? '1000 米跑' : '800 米跑') + '<br><span class="muted small">分′秒″</span></th></tr>';

    var body = rows.map(function (row) {
      var level = levelOf(row.score);
      var cls = row.score >= 90 ? 'grade-excellent' : row.score >= 80 ? 'grade-good'
        : row.score >= 60 ? 'grade-pass' : 'grade-fail';
      var vals = ['vitalCapacity', 'sprint50', 'sitReach', 'standingJump', 'strength', 'endurance'];
      return '<tr>' +
        '<td><b>' + row.score + '</b></td>' +
        '<td class="' + cls + '">' + level + '</td>' +
        vals.map(function (k) {
          var v = row[k];
          if (v === null || v === undefined) return '<td class="num muted">—</td>';
          return '<td class="num">' + v + '</td>';
        }).join('') +
        '</tr>';
    }).join('');

    U.$('#std-table').innerHTML = '<table class="data"><thead>' + head +
      '</thead><tbody>' + body + '</tbody></table>';

    // 权重表
    var weights = Object.keys(S.WEIGHTS).map(function (k) {
      return '<tr><td>' + S.ITEM_LABELS[k] + '</td><td class="num">' + S.WEIGHTS[k] + '%</td></tr>';
    }).join('');
    U.$('#std-weights').innerHTML = '<table class="data"><thead><tr><th>单项指标</th>' +
      '<th class="num">权重</th></tr></thead><tbody>' + weights +
      '<tr class="total-row"><td>合计</td><td class="num">100%</td></tr></tbody></table>';

    // 加分表
    renderBonusTable(gender);
  }

  function levelOf(score) {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 60) return '及格';
    return '不及格';
  }

  function renderBonusTable(gender) {
    var isMale = gender === 'male';
    var strengthRule = S.BONUS[gender].strength;
    var endRule = S.BONUS[gender].endurance;

    var pairs = Object.keys(strengthRule.over).map(Number).sort(function (a, b) { return b - a; });
    var runPairs = Object.keys(endRule.over).map(Number).sort(function (a, b) { return b - a; });

    var rows = pairs.map(function (b, i) {
      var runBonus = runPairs[i];
      return '<tr><td class="num"><b>+' + b + '</b></td>' +
        '<td class="num">超出 <b>' + strengthRule.over[b] + '</b> 次</td>' +
        '<td class="num">快 <b>' + endRule.over[runBonus] + '</b> 秒</td></tr>';
    }).join('');

    U.$('#std-bonus').innerHTML = '<table class="data"><thead><tr>' +
      '<th class="num">加分</th>' +
      '<th class="num">' + (isMale ? '引体向上' : '1分钟仰卧起坐') + '</th>' +
      '<th class="num">' + (isMale ? '1000 米跑' : '800 米跑') + '</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function exportStandardCSV() {
    var gender = U.$('#std-gender').value;
    var band = U.$('#std-band').value;
    var rows = S.TABLES[gender][band];
    var isMale = gender === 'male';
    var head = ['单项得分', '等级', '肺活量(毫升)', '50米跑(秒)', '坐位体前屈(厘米)',
      '立定跳远(厘米)', isMale ? '引体向上(次)' : '1分钟仰卧起坐(次)',
      isMale ? '1000米跑' : '800米跑'];
    var lines = [head.join(',')];
    rows.forEach(function (row) {
      var vals = ['vitalCapacity', 'sprint50', 'sitReach', 'standingJump', 'strength', 'endurance'];
      lines.push([row.score, levelOf(row.score)].concat(vals.map(function (k) {
        return row[k] === null ? '' : row[k];
      })).join(','));
    });
    var name = (isMale ? '男生' : '女生') + (band === 'low' ? '大一大二' : '大三大四') + '_体测评分标准.csv';
    U.download(name, '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8');
    U.toast('已导出标准表 CSV', 'ok');
  }

  /* ------------------------------------------------------------ 初始化 */

  function init() {
    renderInputs();
    restoreProfile();
    renderStandard();

    U.$('#fit-gender').addEventListener('change', function () {
      var prev = collectRecords();
      renderInputs();
      // 保留同名项目的输入
      Object.keys(prev).forEach(function (k) {
        if (inputs[k] && prev[k]) inputs[k].value = prev[k];
      });
    });
    U.$('#fit-calc').addEventListener('click', calculate);
    U.$('#fit-reset').addEventListener('click', function () {
      U.$('#fit-height').value = '';
      U.$('#fit-weight').value = '';
      Object.keys(inputs).forEach(function (k) { inputs[k].value = ''; });
      U.$('#fit-result').innerHTML = '';
      global.Store.remove(global.Store.KEYS.fitnessProfile);
      U.toast('已清空', 'ok');
    });
    U.$('#fit-demo').addEventListener('click', fillDemo);

    // 回车即计算
    U.$$('#fit-inputs input, #fit-height, #fit-weight').forEach(function (n) {
      n.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') calculate();
      });
    });

    U.$('#std-gender').addEventListener('change', renderStandard);
    U.$('#std-band').addEventListener('change', renderStandard);
    U.$('#std-export-csv').addEventListener('click', exportStandardCSV);
  }

  function fillDemo() {
    var gender = U.$('#fit-gender').value;
    U.$('#fit-grade').value = '2';
    if (gender === 'male') {
      U.$('#fit-height').value = '172';
      U.$('#fit-weight').value = '65';
      setInput('vitalCapacity', '4100');
      setInput('sprint50', '7.2');
      setInput('sitReach', '15.5');
      setInput('standingJump', '240');
      setInput('strength', '13');
      setInput('endurance', "4'05\"");
    } else {
      U.$('#fit-height').value = '161';
      U.$('#fit-weight').value = '52';
      setInput('vitalCapacity', '2900');
      setInput('sprint50', '8.6');
      setInput('sitReach', '17.0');
      setInput('standingJump', '176');
      setInput('strength', '42');
      setInput('endurance', "3'54\"");
    }
    calculate();
    U.toast('已填入示例数据（不是你的真实成绩）', 'ok');
  }

  function setInput(key, value) {
    if (inputs[key]) inputs[key].value = value;
  }

  global.FitnessView = {
    init: init,
    renderStandard: renderStandard,
    calculate: calculate
  };
})(typeof window !== 'undefined' ? window : globalThis);
