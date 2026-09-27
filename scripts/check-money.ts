/**
 * 校验 £sd 运算这份移植。数字取自 predecimal 自己的测试和法条原文 ——
 * 钱算错了，游戏就没有意义。
 */
import {
  format, formatNewPence, lsd, parse, slash,
  toExactNewPence, toShopHalfNewPence, toStatutoryNewPence,
} from '../src/money/lsd.ts';

const fails: string[] = [];
const eq = (got: unknown, want: unknown, what: string): void => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) fails.push(`${what}：得到 ${g}，应为 ${w}`);
};

// 刻度
eq(lsd(1), 960, '1 镑 = 960 法寻');
eq(lsd(0, 1), 48, '1 先令 = 48 法寻');
eq(lsd(0, 0, 1), 4, '1 便士 = 4 法寻');
eq(lsd(0, 2, 6), 120, '半克朗 = 120 法寻');

// 格式化
eq(format(lsd(5, 9, 5, 2)), '£5 9s 5½d', 'format 账面');
eq(format(lsd(0, 0, 6)), '6d', 'format 纯便士');
eq(format(lsd(0, 4)), '4s 0d', 'format 纯先令');
eq(slash(lsd(0, 2, 11, 2)), '2/11½', 'slash 店头');
eq(slash(lsd(0, 10)), '10/-', 'slash 整十先令');
eq(slash(lsd(5, 9, 5, 2)), '£5 9/5½', 'slash 带镑');

// 解析
eq(parse('£5 9s 5½d'), lsd(5, 9, 5, 2), 'parse 账面');
eq(parse('2/11½'), lsd(0, 2, 11, 2), 'parse 斜杠');
eq(parse('10/-'), lsd(0, 10), 'parse 10/-');
eq(parse('6d'), lsd(0, 0, 6), 'parse 便士');
eq(parse('19s'), lsd(0, 19), 'parse 先令');
eq(parse('3 gns 10s 6d'), lsd(3, 13, 6), 'parse 几尼（1 gn = 21s）');

// 往返
for (const v of [0, 1, 4, 120, 251, 960, 12345]) {
  eq(parse(format(v)), v, `往返 ${v} 法寻`);
}

// 附表一法定换算（legislation.gov.uk 原文）
const TABLE = [0,0,1,1,2,2,3,3,3,4,4,5,5,5,6,6,7,7,7,8,8,9,9,10];
TABLE.forEach((want, d) => eq(toStatutoryNewPence(lsd(0, 0, d)), want, `法定 ${d}d`));
eq(toStatutoryNewPence(lsd(0, 2)), 10, '法定 2s');
eq(toStatutoryNewPence(lsd(0, 10)), 50, '法定 10s');
eq(toStatutoryNewPence(lsd(1)), 100, '法定 £1');
eq(toStatutoryNewPence(lsd(0, 2, 1)), 10, '法定 2s 1d：零头 1d 不计');
eq(toStatutoryNewPence(lsd(0, 2, 6)), 13, '法定半克朗 = 13p，而非 12½');
eq(toStatutoryNewPence(lsd(5, 15, 7)), 578, '法定 £5 15s 7d');
eq(toStatutoryNewPence(lsd(0, 0, 6, 3)), 3, '法定截去法寻');
eq(toStatutoryNewPence(-lsd(0, 2, 6)), -13, '法定负数');

// 店头折算：以半新便士为单位
eq(toShopHalfNewPence(lsd(0, 2, 6)), 25, '店头半克朗 = 12½p');
eq(toShopHalfNewPence(lsd(0, 0, 6)), 5, '店头 6d = 2½p');
eq(toShopHalfNewPence(lsd(0, 0, 1)), 1, '店头 1d ≈ ½p');
eq(toShopHalfNewPence(lsd(0, 1)), 10, '店头 1s = 5p');
eq(toShopHalfNewPence(lsd(0, 0, 3)), 3, '店头 3d 逢半进一 → 1½p');

// 精确新便士
eq(toExactNewPence(lsd(0, 2, 6)), { numerator: 25, denominator: 2 }, '精确半克朗 = 25/2');
eq(toExactNewPence(lsd(0, 1)), { numerator: 5, denominator: 1 }, '精确 1s = 5p');
eq(formatNewPence(lsd(0, 2, 6)), '12½p', '精确半克朗文字');
eq(formatNewPence(lsd(0, 0, 6)), '2½p', '精确 6d 文字');
eq(formatNewPence(lsd(0, 1)), '5p', '精确 1s 文字');

// 这个库的核心论点：2 先令以下，除 1s 外没有整数新便士
for (let d = 1; d < 24; d++) {
  const { denominator } = toExactNewPence(lsd(0, 0, d));
  if (denominator === 1 && d !== 12) fails.push(`${d}d 竟是整数新便士，与前提矛盾`);
}

if (fails.length) {
  console.log('钱算错了：');
  for (const f of fails) console.log('  × ' + f);
  process.exit(1);
}
console.log('钱算对了：刻度、解析、格式化、附表一、店头折算全部一致。');
