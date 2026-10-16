/**
 * SHA-256 实现正确性测试
 *
 * 前端没有 crypto.subtle（file:// 下不是安全上下文，取不到），
 * 所以密码哈希用的是自己实现的纯 JS SHA-256。
 * 密码学原语不能靠「看起来对」，这里直接跟 Node 的 crypto 逐字节比对。
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// sha256.js 是给浏览器写的（挂到 globalThis），同时兼容 CommonJS，
// 所以这里用和其他测试一致的 createRequire 方式加载。
const require = createRequire(import.meta.url);
const mod = require(join(root, 'js/core/sha256.js'));
const Sha256 = globalThis.Sha256 || mod.sha256;
const safeEqual = globalThis.Sha256Equal || mod.safeEqual;

let pass = 0, fail = 0;
const failures = [];
function eq(a, b, msg) {
  if (a === b) pass++;
  else { fail++; failures.push(msg); console.error(`  ✗ ${msg}\n      期望 ${b}\n      实际 ${a}`); }
}

const ref = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

/* ---------------------------------------------- 标准测试向量 */

console.log('\n=== SHA-256 标准向量 ===');
eq(Sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '空字符串');
eq(Sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', '"abc"');
eq(Sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
  '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1', '448 位标准向量');
eq(Sha256('a'.repeat(1000000)),
  'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0', '一百万个 a');

/* ---------------------------------------------- 边界长度 */

console.log('=== 长度边界（块填充） ===');
for (const n of [1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 200, 1000]) {
  const s = 'x'.repeat(n);
  eq(Sha256(s), ref(s), `长度 ${n} 与 Node crypto 一致`);
}

/* ---------------------------------------------- 中文与多字节 */

console.log('=== 中文 / 多字节 / 代理对 ===');
const texts = [
  '西藏大学', '西藏大学学业助手', '保研推免', '国家学生体质健康标准（2014年修订）',
  '　全角空格　', 'a藏b大c学d', 'emoji😀测试', '👨‍👩‍👧‍👦 家庭', 'ß ü ñ é',
  '𝄞 音乐符号', '中'.repeat(100), '藏'.repeat(55), '文'.repeat(56)
];
for (const t of texts) eq(Sha256(t), ref(t), `"${t.slice(0, 16)}${t.length > 16 ? '…' : ''}" 一致`);

/* ---------------------------------------------- 随机对拍 */

console.log('=== 随机对拍 200 组 ===');
let mismatch = 0;
for (let i = 0; i < 200; i++) {
  const len = Math.floor(Math.random() * 300);
  let s = '';
  for (let j = 0; j < len; j++) {
    // 混合 ASCII 与中文，覆盖多字节边界
    s += Math.random() < 0.5
      ? String.fromCharCode(32 + Math.floor(Math.random() * 95))
      : String.fromCharCode(0x4e00 + Math.floor(Math.random() * 1000));
  }
  if (Sha256(s) !== ref(s)) mismatch++;
}
eq(mismatch, 0, '200 组随机字符串全部与 Node crypto 一致');

/* ---------------------------------------------- 恒定时间比较 */

console.log('=== 恒定时间比较 ===');
const a = ref('abc'), b = ref('abc'), c = ref('abd');
eq(safeEqual(a, b), true, '相同哈希为真');
eq(safeEqual(a, c), false, '不同哈希为假');
eq(safeEqual(a, a.slice(0, 63)), false, '长度不同为假');
eq(safeEqual('', ''), true, '两个空串为真');
eq(safeEqual('', 'a'), false, '空串与非空为假');

/* ---------------------------------------------- 密码哈希用法 */

console.log('=== 密码哈希（加盐） ===');
const hashPwd = (pwd, salt) => Sha256(salt + '::' + pwd + '::xzu-helper');
const s1 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const s2 = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';
eq(hashPwd('mypassword', s1), hashPwd('mypassword', s1), '相同密码+相同盐结果稳定');
eq(hashPwd('mypassword', s1) === hashPwd('mypassword', s2), false, '相同密码+不同盐结果不同（防彩虹表）');
eq(hashPwd('mypassword', s1).length, 64, '哈希为 64 位十六进制');
eq(hashPwd('mypassword', s1).includes('mypassword'), false, '哈希中不含明文');
eq(hashPwd('密码', s1), ref('a1b2c3d4e5f60718293a4b5c6d7e8f90::密码::xzu-helper'), '中文密码与 Node 一致');

console.log('\n' + '─'.repeat(50));
if (fail) { console.log(`失败 ${fail} 项：`); failures.forEach((f) => console.log('  ✗ ' + f)); }
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
console.log('─'.repeat(50) + '\n');
process.exit(fail ? 1 : 0);
