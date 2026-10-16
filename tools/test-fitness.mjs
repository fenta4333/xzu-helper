/**
 * 体测评分引擎测试
 * 运行：node tools/test-fitness.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

require(join(__dirname, '..', 'js', 'data', 'fitness-standard.js'));
const E = require(join(__dirname, '..', 'js', 'modules', 'fitness-engine.js'));

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + '\n      期望 ' + JSON.stringify(expected) + '\n      实际 ' + JSON.stringify(actual)); }
}
function near(actual, expected, label, tol = 0.01) {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + ' 期望 ' + expected + ' 实际 ' + actual); }
}
function group(name) { console.log('\n' + name); }

/* ---------------------------------------------------------- BMI */
group('BMI 评分（男生 17.9~23.9 正常 / 女生 17.2~23.9 正常）');
eq(E.scoreBMI('male', 175, 70).score, 100, '男 175cm/70kg -> 100 分');
near(E.scoreBMI('male', 175, 70).bmi, 22.9, 'BMI 计算 22.9');
eq(E.scoreBMI('male', 175, 65).score, 100, '男 BMI 21.2 正常 -> 100');
eq(E.scoreBMI('male', 175, 55).score, 100, '男 175/55 BMI 18.0 正常 -> 100');
eq(E.scoreBMI('male', 180, 54).score, 80, '男 BMI 16.7 低体重 -> 80');
eq(E.scoreBMI('male', 180, 80).score, 80, '男 BMI 24.7 超重 -> 80');
eq(E.scoreBMI('male', 180, 95).score, 60, '男 BMI 29.3 肥胖 -> 60');
eq(E.scoreBMI('female', 160, 45).score, 100, '女 160/45 BMI 17.6 -> 100');
eq(E.scoreBMI('female', 160, 43).score, 80, '女 BMI 16.8 低体重 -> 80');

/* ------------------------------------------------------ 单项查表 */
group('单项评分：肺活量（男大一大二 100 分 = 5040）');
eq(E.scoreItem('male', 1, 'vitalCapacity', 5040).score, 100, '5040 -> 100');
eq(E.scoreItem('male', 1, 'vitalCapacity', 5039).score, 95, '5039 -> 95');
eq(E.scoreItem('male', 1, 'vitalCapacity', 3100).score, 60, '3100 -> 60');
eq(E.scoreItem('male', 1, 'vitalCapacity', 3099).score, 50, '3099 -> 50');
eq(E.scoreItem('male', 1, 'vitalCapacity', 2299).score, 0, '2299 低于最低档 -> 0');
eq(E.scoreItem('male', 3, 'vitalCapacity', 5140).score, 100, '大三大四 5140 -> 100');
eq(E.scoreItem('male', 3, 'vitalCapacity', 5040).score, 95, '大三大四 5040 -> 95');

group('单项评分：50 米跑（越小越好，男 100 分 = 6.7 秒）');
eq(E.scoreItem('male', 1, 'sprint50', 6.6).score, 100, '6.6 -> 100');
eq(E.scoreItem('male', 1, 'sprint50', 6.7).score, 100, '6.7 -> 100');
eq(E.scoreItem('male', 1, 'sprint50', 6.8).score, 95, '6.8 -> 95');
eq(E.scoreItem('male', 1, 'sprint50', 10.1).score, 10, '10.1 -> 10');
eq(E.scoreItem('male', 1, 'sprint50', 10.2).score, 0, '10.2 超最低档 -> 0');
eq(E.scoreItem('female', 1, 'sprint50', 7.5).score, 100, '女 7.5 -> 100');

group('单项评分：坐位体前屈（允许负值）');
eq(E.scoreItem('male', 1, 'sitReach', 24.9).score, 100, '24.9 -> 100');
eq(E.scoreItem('male', 1, 'sitReach', 3.7).score, 60, '3.7 -> 60');
eq(E.scoreItem('male', 1, 'sitReach', -0.3).score, 20, '-0.3 -> 20');
eq(E.scoreItem('male', 1, 'sitReach', -1.3).score, 10, '-1.3 -> 10');
eq(E.scoreItem('male', 1, 'sitReach', -2.0).score, 0, '-2.0 -> 0');

group('单项评分：1000 米跑（时长解析 + 越小越好）');
eq(E.parseDuration("3'17\""), 197, "解析 3'17\" = 197 秒");
eq(E.parseDuration('4:05'), 245, '解析 4:05 = 245 秒');
eq(E.parseDuration('4分05秒'), 245, '解析 4分05秒 = 245 秒');
eq(E.parseDuration(245), 245, '直接给秒数');
eq(E.scoreItem('male', 1, 'endurance', "3'17\"").score, 100, "3'17\" -> 100");
eq(E.scoreItem('male', 1, 'endurance', 197).score, 100, '197 秒 -> 100');
eq(E.scoreItem('male', 1, 'endurance', 198).score, 95, '198 秒 -> 95');
eq(E.scoreItem('male', 1, 'endurance', 372).score, 10, '6\'12" -> 10');
eq(E.formatDuration(197), "3'17\"", '格式化 197 -> 3\'17"');

group('单项评分：引体向上（null 档位向下就近取值）');
eq(E.scoreItem('male', 1, 'strength', 19).score, 100, '19 次 -> 100');
eq(E.scoreItem('male', 1, 'strength', 18).score, 95, '18 次 -> 95');
eq(E.scoreItem('male', 1, 'strength', 15).score, 80, '15 次 -> 80');
eq(E.scoreItem('male', 1, 'strength', 9).score, 50, '9 次 -> 50');
eq(E.scoreItem('male', 1, 'strength', 4).score, 0, '4 次 -> 0');

/* ---------------------------------------------------------- 加分 */
group('加分：男生引体向上超过 19 次');
eq(E.bonusOf('male', 'strength', 19, 19).bonus, 0, '19 次不加分');
eq(E.bonusOf('male', 'strength', 20, 19).bonus, 1, '20 次 +1');
eq(E.bonusOf('male', 'strength', 25, 19).bonus, 6, '25 次 +6');
eq(E.bonusOf('male', 'strength', 29, 19).bonus, 10, '29 次 +10');
eq(E.bonusOf('male', 'strength', 40, 19).bonus, 10, '超出上限仍 +10');
eq(E.bonusOf('male', 'strength', 18, 19).bonus, 0, '不足不加分');

group('加分：男生 1000 米比 3\'17" 快');
eq(E.bonusOf('male', 'endurance', 197, 197).bonus, 0, '同成绩不加分');
eq(E.bonusOf('male', 'endurance', 193, 197).bonus, 1, '快 4 秒 +1');
eq(E.bonusOf('male', 'endurance', 177, 197).bonus, 5, '快 20 秒 +5');
eq(E.bonusOf('male', 'endurance', 162, 197).bonus, 10, '快 35 秒 +10');

group('加分：女生仰卧起坐超过 56 次');
eq(E.bonusOf('female', 'strength', 58, 56).bonus, 1, '58 次 +1（阈值 2 次）');
eq(E.bonusOf('female', 'strength', 60, 56).bonus, 2, '60 次 +2（阈值 4 次）');
eq(E.bonusOf('female', 'strength', 66, 56).bonus, 7, '66 次 +7（阈值 10 次）');
eq(E.bonusOf('female', 'strength', 69, 56).bonus, 10, '69 次 +10');

/* ---------------------------------------------------------- 总分 */
group('总分：完整评测（男 大二，各项均 100 分）');
const perfect = E.evaluate(
  { gender: 'male', grade: 2, heightCm: 175, weightKg: 70 },
  { vitalCapacity: 5040, sprint50: 6.7, sitReach: 24.9, standingJump: 273, strength: 19, endurance: "3'17\"" }
);
eq(perfect.standardScore, 100, '标准分 100');
eq(perfect.bonusTotal, 0, '无加分');
eq(perfect.total, 100, '总分 100');
eq(perfect.grade.label, '优秀', '等级：优秀');
eq(perfect.complete, true, '数据完整');

group('总分：超出满分的加分封顶（120）');
const over = E.evaluate(
  { gender: 'male', grade: 2, heightCm: 175, weightKg: 70 },
  { vitalCapacity: 6000, sprint50: 6.0, sitReach: 30, standingJump: 300, strength: 30, endurance: "2'40\"" }
);
eq(over.standardScore, 100, '标准分仍为 100（单项封顶）');
eq(over.bonusTotal, 20, '加分封顶 20');
eq(over.total, 120, '总分 120');

group('总分：及格线上下');
// 除 BMI 外的 6 项均为 60 分档；BMI 22.9 属正常得 100 分
// 标准分 = (100×15 + 60×85) / 100 = 66
const passCase = E.evaluate(
  { gender: 'male', grade: 2, heightCm: 175, weightKg: 70 },
  { vitalCapacity: 3100, sprint50: 9.1, sitReach: 3.7, standingJump: 208, strength: 10, endurance: "4'32\"" }
);
eq(passCase.standardScore, 66, '各体能项 60 分 + BMI 100 分 -> 标准分 66');
eq(passCase.grade.label, '及格', '等级：及格');
eq(passCase.meetsGraduation, true, '达到毕业门槛');

group('总分：数据缺失时有提示且不崩');
const partial = E.evaluate(
  { gender: 'female', grade: 3, heightCm: 162, weightKg: 52 },
  { vitalCapacity: 3300, sprint50: null, sitReach: 22, standingJump: 190, strength: 52, endurance: "3'30\"" }
);
eq(partial.complete, false, '标记为不完整');
eq(partial.missing.length, 1, '缺少 1 项');
eq(partial.details.find(d => d.item === 'sprint50').score, null, '缺项得分为 null');
eq(typeof partial.standardScore, 'number', '仍给出标准分');

group('等级边界');
eq(E.gradeOf(90).label, '优秀', '90 -> 优秀');
eq(E.gradeOf(89.9).label, '良好', '89.9 -> 良好');
eq(E.gradeOf(80).label, '良好', '80 -> 良好');
eq(E.gradeOf(79.9).label, '及格', '79.9 -> 及格');
eq(E.gradeOf(60).label, '及格', '60 -> 及格');
eq(E.gradeOf(59.9).label, '不及格', '59.9 -> 不及格');

group('等级差距提示');
eq(E.nextGradeGap({ total: 75 }).next, '良好', '75 分提示冲良好');
near(E.nextGradeGap({ total: 75 }).gap, 5, '差 5 分');
eq(E.nextGradeGap({ total: 95 }), null, '95 分无更高等级');

group('年级档位');
eq(E.gradeBandOf(1), 'low', '大一 -> 低年级档');
eq(E.gradeBandOf(2), 'low', '大二 -> 低年级档');
eq(E.gradeBandOf(3), 'high', '大三 -> 高年级档');
eq(E.gradeBandOf(4), 'high', '大四 -> 高年级档');

console.log('\n──────────────────────────────');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
