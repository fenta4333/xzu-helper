/**
 * 体测评分引擎
 *
 * 依据《国家学生体质健康标准（2014年修订）》大学组：
 *   标准分 = Σ(单项得分 × 权重) / 100     满分 100
 *   加分   = 男生引体向上 / 1000米；女生仰卧起坐 / 800米   各上限 10 分，合计上限 20
 *   学年总分 = 标准分 + 加分               满分 120
 *   等级：>=90 优秀 / 80~89.9 良好 / 60~79.9 及格 / <60 不及格
 *
 * 本文件为纯逻辑，不依赖 DOM，可在 Node 下直接测试。
 */
(function (global) {
  'use strict';

  var S = global.FitnessStandard ||
    (typeof require !== 'undefined' ? require('../data/fitness-standard.js') || global.FitnessStandard : null);

  /** 项目方向：true = 数值越大越好 */
  var HIGHER_IS_BETTER = {
    bmi: null,            // 按区间评分，单独处理
    vitalCapacity: true,
    sprint50: false,
    sitReach: true,
    standingJump: true,
    strength: true,
    endurance: false
  };

  // ---------------------------------------------------------------- BMI

  function bmiValue(heightCm, weightKg) {
    if (!heightCm || !weightKg) return null;
    var m = heightCm / 100;
    return weightKg / (m * m);
  }

  function scoreBMI(gender, heightCm, weightKg) {
    var bmi = bmiValue(heightCm, weightKg);
    if (bmi === null) return null;
    var rules = S.BMI_RULE[gender];
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (bmi >= r.min && bmi <= r.max) {
        return { score: r.score, bmi: round1(bmi), level: r.level };
      }
    }
    return { score: 0, bmi: round1(bmi), level: '未知' };
  }

  // ------------------------------------------------------- 单项得分查表

  /**
   * 把评分表按项目和成绩方向整理成「阈值从高到低」的可查找数组
   * 过掉 null（部分档位无阈值），并保证同一成绩只取最高分
   */
  function buildLookup(gender, gradeBand, item) {
    var rows = S.TABLES[gender][gradeBand];
    var higher = HIGHER_IS_BETTER[item];
    var out = [];
    rows.forEach(function (row) {
      var v = row[item];
      if (v === null || v === undefined) return;
      out.push({ score: row.score, value: higher ? Number(v) : parseDuration(v) });
    });
    // 得分从高到低
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  var lookupCache = {};
  function getLookup(gender, gradeBand, item) {
    var key = gender + '|' + gradeBand + '|' + item;
    if (!lookupCache[key]) lookupCache[key] = buildLookup(gender, gradeBand, item);
    return lookupCache[key];
  }

  /**
   * 单项评分
   * @returns {{score:number, value:number, reached:boolean}}
   */
  function scoreItem(gender, grade, item, rawValue) {
    var gradeBand = gradeBandOf(grade);
    if (item === 'bmi') return null; // 由 scoreBMI 处理

    // 注意：不能直接 Number(null)（结果是 0，会被误判成有效成绩）
    if (rawValue === null || rawValue === undefined || rawValue === '') return null;
    var value = item === 'endurance' ? parseDuration(rawValue) : Number(rawValue);
    if (value === null || value === undefined || isNaN(value)) return null;

    var higher = HIGHER_IS_BETTER[item];
    var table = getLookup(gender, gradeBand, item);

    for (var i = 0; i < table.length; i++) {
      var t = table[i];
      var ok = higher ? value >= t.value : value <= t.value;
      if (ok) return { score: t.score, value: value, band: gradeBand };
    }
    return { score: 0, value: value, band: gradeBand, belowTable: true };
  }

  /** 年级 -> 评分档位 */
  function gradeBandOf(grade) {
    var g = parseInt(grade, 10);
    return (g === 1 || g === 2) ? 'low' : 'high';
  }

  // ------------------------------------------------------------ 加分

  /**
   * 加分计算
   * @param {string} gender male/female
   * @param {string} item   strength | endurance
   * @param {number} value  原始成绩（strength=次数，endurance=秒）
   * @param {number} baseValue 该项目 100 分标准值
   */
  function bonusOf(gender, item, value, baseValue) {
    var rule = S.BONUS[gender][item];
    if (!rule) return { bonus: 0, over: 0 };

    var over;
    if (item === 'strength') over = value - baseValue;
    else over = baseValue - value; // 跑步：比标准快多少秒

    if (over <= 0) return { bonus: 0, over: 0, rule: rule };

    // over 阈值表：{加分: 需要达到的幅度}，按幅度从大到小找第一个达到的档位
    var pairs = Object.keys(rule.over).map(function (b) {
      return { bonus: Number(b), need: Number(rule.over[b]) };
    }).sort(function (a, b) { return b.need - a.need; });

    for (var i = 0; i < pairs.length; i++) {
      if (over >= pairs[i].need) {
        return { bonus: Math.min(pairs[i].bonus, rule.max), over: round2(over), rule: rule };
      }
    }
    return { bonus: 0, over: round2(over), rule: rule };
  }

  // ---------------------------------------------------------- 总分

  /**
   * 完整评分
   * @param {object} profile {gender:'male'|'female', grade:1..4, heightCm, weightKg}
   * @param {object} records {vitalCapacity, sprint50, sitReach, standingJump, strength, endurance}
   */
  function evaluate(profile, records) {
    var gender = profile.gender;
    var items = ['bmi', 'vitalCapacity', 'sprint50', 'sitReach', 'standingJump', 'strength', 'endurance'];
    var details = [];
    var standardSum = 0;
    var missing = [];

    items.forEach(function (item) {
      var weight = S.WEIGHTS[item];
      var label = S.ITEM_LABELS[item];
      var entry = { item: item, label: label, weight: weight };

      if (item === 'bmi') {
        var bmiRes = scoreBMI(gender, Number(profile.heightCm), Number(profile.weightKg));
        if (!bmiRes) { entry.score = null; missing.push(label); }
        else {
          entry.score = bmiRes.score;
          entry.display = bmiRes.bmi;
          entry.extra = bmiRes.level;
          standardSum += bmiRes.score * weight;
        }
      } else {
        var res = scoreItem(gender, profile.grade, item, records[item]);
        if (!res) { entry.score = null; missing.push(label); }
        else {
          entry.score = res.score;
          entry.display = item === 'endurance' ? formatDuration(res.value) : res.value;
          if (res.belowTable) entry.extra = '低于最低档，计 0 分';
          standardSum += res.score * weight;
        }
      }
      entry.weighted = entry.score === null ? null : round2(entry.score * weight / 100);
      details.push(entry);
    });

    var standardScore = round2(standardSum / 100);

    // 加分：仅男生引体向上/1000米，女生仰卧起坐/800米
    var bonusDetail = [];
    var bonusTotal = 0;
    ['strength', 'endurance'].forEach(function (item) {
      var rule = S.BONUS[gender][item];
      var base = get100Value(gender, gradeBandOf(profile.grade), item);
      var raw = item === 'endurance' ? parseDuration(records[item]) : Number(records[item]);
      var b = { item: item, label: S.ITEM_LABELS[item], base: base, max: rule.max };
      if (raw === null || isNaN(raw) || base === null) {
        b.bonus = 0; b.over = 0; b.display = '-';
      } else {
        var r = bonusOf(gender, item, raw, base);
        b.bonus = r.bonus;
        b.over = r.over;
        b.display = item === 'endurance' ? formatDuration(raw) : raw;
        bonusTotal += r.bonus;
      }
      bonusDetail.push(b);
    });
    bonusTotal = Math.min(bonusTotal, 20);

    var total = round2(Math.min(standardScore + bonusTotal, 120));
    var grade = gradeOf(total);

    return {
      profile: profile,
      details: details,
      bonus: bonusDetail,
      standardScore: standardScore,
      bonusTotal: bonusTotal,
      total: total,
      grade: grade,
      missing: missing,
      complete: missing.length === 0,
      // 毕业门槛：普通高等学校学生毕业时测试成绩达不到 50 分按结业处理
      meetsGraduation: standardScore >= 50
    };
  }

  /** 取某项目 100 分标准值 */
  function get100Value(gender, gradeBand, item) {
    var rows = S.TABLES[gender][gradeBand];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].score === 100) {
        var v = rows[i][item];
        if (v === null) return null;
        return item === 'endurance' ? parseDuration(v) : Number(v);
      }
    }
    return null;
  }

  function gradeOf(total) {
    for (var i = 0; i < S.GRADES.length; i++) {
      if (total >= S.GRADES[i].min) return S.GRADES[i];
    }
    return S.GRADES[S.GRADES.length - 1];
  }

  // ----------------------------------------------------------- 工具

  function round1(n) { return Math.round(n * 10) / 10; }
  function round2(n) { return Math.round(n * 100) / 100; }

  /** 独立实现一份时长解析，避免依赖 Utils（便于 Node 测试） */
  function parseDuration(input) {
    if (input === null || input === undefined || input === '') return null;
    if (typeof input === 'number') return input > 0 ? input : null;
    var s = String(input).trim()
      .replace(/[′'’`]/g, "'").replace(/[″"”]/g, '"')
      .replace(/分/g, "'").replace(/秒/g, '"');
    var m = s.match(/^(\d+)\s*[':：]\s*(\d+(?:\.\d+)?)/);
    if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    return null;
  }

  function formatDuration(sec) {
    if (sec === null || sec === undefined || isNaN(sec)) return '-';
    var m = Math.floor(sec / 60);
    var s = Math.round(sec - m * 60);
    if (s === 60) { m += 1; s = 0; }
    return m + "'" + (s < 10 ? '0' + s : s) + '"';
  }

  /** 距离下一等级还差多少标准分 */
  function nextGradeGap(result) {
    var t = result.total;
    if (t >= 90) return null;
    if (t >= 80) return { gap: round2(90 - t), next: '优秀' };
    if (t >= 60) return { gap: round2(80 - t), next: '良好' };
    return { gap: round2(60 - t), next: '及格' };
  }

  var api = {
    bmiValue: bmiValue,
    scoreBMI: scoreBMI,
    scoreItem: scoreItem,
    bonusOf: bonusOf,
    evaluate: evaluate,
    gradeOf: gradeOf,
    gradeBandOf: gradeBandOf,
    get100Value: get100Value,
    nextGradeGap: nextGradeGap,
    parseDuration: parseDuration,
    formatDuration: formatDuration,
    HIGHER_IS_BETTER: HIGHER_IS_BETTER
  };

  global.FitnessEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
