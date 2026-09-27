/**
 * 十进制化之前的英镑运算。
 *
 * 移植自本项目作者自己的 Python 库 predecimal，只取本游戏用得到的部分：
 * 整数法寻记账、解析与格式化、以及《1969 年十进制货币法》附表一的法定换算。
 * 另外加了一样原库没有的东西：硬币分解，找零用。
 *
 *   https://github.com/sakulik2/predecimal
 *
 *   MIT License
 *   Copyright (c) 2026 sakulik2
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE.
 *
 * 一切都以法寻（¼ 便士）的整数记账，所以没有浮点误差：
 * 1 镑 = 20 先令 = 240 便士 = 960 法寻。
 */

export const FARTHINGS_PER_PENNY = 4;
export const PENCE_PER_SHILLING = 12;
export const SHILLINGS_PER_POUND = 20;
export const FARTHINGS_PER_POUND =
  FARTHINGS_PER_PENNY * PENCE_PER_SHILLING * SHILLINGS_PER_POUND; // 960

/** 一笔钱，按法寻计。用整数是为了让加减乘除都精确。 */
export type LSD = number;

export const lsd = (pounds = 0, shillings = 0, pence = 0, farthings = 0): LSD =>
  pounds * FARTHINGS_PER_POUND +
  shillings * PENCE_PER_SHILLING * FARTHINGS_PER_PENNY +
  pence * FARTHINGS_PER_PENNY +
  farthings;

/** 拆成镑、先令、便士、法寻。四个分量共用符号。 */
export type Parts = {
  pounds: number;
  shillings: number;
  pence: number;
  farthings: number;
  negative: boolean;
};

export function parts(value: LSD): Parts {
  const negative = value < 0;
  const abs = Math.abs(value);
  const farthings = abs % FARTHINGS_PER_PENNY;
  const totalPence = Math.floor(abs / FARTHINGS_PER_PENNY);
  const pence = totalPence % PENCE_PER_SHILLING;
  const totalShillings = Math.floor(totalPence / PENCE_PER_SHILLING);
  const shillings = totalShillings % SHILLINGS_PER_POUND;
  const pounds = Math.floor(totalShillings / SHILLINGS_PER_POUND);
  return { pounds, shillings, pence, farthings, negative };
}

const GLYPH = ['', '¼', '½', '¾'] as const;

const glyphOf = (farthings: number): string => GLYPH[farthings] ?? '';

/**
 * 账面写法：£5 9s 5½d。零镑时省掉镑。
 *
 * 只有法寻、没有整便士时写「¼d」而不是「0¼d」—— 账本上不写那个零，
 * 硬币面值本身就是四分之一便士。slash() 一直是这么做的，这里跟上。
 */
export function format(value: LSD): string {
  const p = parts(value);
  const sign = p.negative ? '-' : '';
  const pence = p.pence || !p.farthings ? String(p.pence) : '';
  const tail = `${pence}${glyphOf(p.farthings)}d`;
  if (p.pounds) return `${sign}£${p.pounds} ${p.shillings}s ${tail}`;
  if (p.shillings) return `${sign}${p.shillings}s ${tail}`;
  return `${sign}${tail}`;
}

/** 店头斜杠写法：2/11½、10/-、£5 9/5½。票价表上就是这么印的。 */
export function slash(value: LSD): string {
  const p = parts(value);
  const sign = p.negative ? '-' : '';
  // 只有法寻时写「¾」，不写「0¾」。
  const tail = p.farthings
    ? `${p.pence || ''}${glyphOf(p.farthings)}`
    : p.pence
      ? String(p.pence)
      : '-';
  if (p.pounds) return `${sign}£${p.pounds} ${p.shillings}/${tail}`;
  return `${sign}${p.shillings}/${tail}`;
}

const FRACTION: Record<string, number> = { '¼': 1, '½': 2, '¾': 3 };

/** 把 "11"、"11½"、"½" 读成法寻数。 */
function readPence(text: string): number {
  const t = text.trim();
  if (t === '') return 0;
  const last = t.slice(-1);
  const frac = FRACTION[last];
  if (frac !== undefined) {
    const head = t.slice(0, -1).trim();
    return (head ? Number(head) : 0) * FARTHINGS_PER_PENNY + frac;
  }
  return Number(t) * FARTHINGS_PER_PENNY;
}

const SLASH_RE = /^(\d+)\s*\/\s*(-|\d*[¼½¾]?)\s*d?$/;
const TOKEN_RE = /£\s*(\d+)|(\d*[¼½¾]?)\s*([sd])/g;
const GUINEA_RE = /^(\d+)\s*(gns?|guineas?|几尼)\.?\s*/i;

/** 解析 "£5 9s 5½d"、"2/11½"、"10/-"、"19s"、"6d"、"3 gns 10s 6d"。 */
export function parse(text: string): LSD {
  let t = text.trim();
  const negative = t.startsWith('-');
  if (negative) t = t.slice(1).trim();

  // 开头可以带几尼数：一几尼 = 21 先令，不是 20。
  let extra = 0;
  const gns = GUINEA_RE.exec(t);
  if (gns?.[1]) {
    extra = Number(gns[1]) * lsd(1, 1);
    t = t.slice(gns[0].length).trim();
    if (!t) return negative ? -extra : extra;
  }

  const bySlash = SLASH_RE.exec(t);
  if (bySlash?.[1]) {
    const tail = (bySlash[2] ?? '').trim();
    const value =
      Number(bySlash[1]) * PENCE_PER_SHILLING * FARTHINGS_PER_PENNY +
      (tail === '' || tail === '-' ? 0 : readPence(tail));
    return negative ? -(value + extra) : value + extra;
  }

  let total = 0;
  let matched = false;
  let consumed = '';
  for (const m of t.matchAll(TOKEN_RE)) {
    matched = true;
    consumed += m[0];
    if (m[1] !== undefined) {
      total += Number(m[1]) * FARTHINGS_PER_POUND;
    } else if (m[3] === 's') {
      total += readPence(m[2] ?? '0') * PENCE_PER_SHILLING;
    } else {
      total += readPence(m[2] ?? '0');
    }
  }
  if (!matched || t.replace(TOKEN_RE, '').trim() !== '') {
    throw new Error(`读不懂这个金额：${text}`);
  }

  const value = total + extra;
  return negative ? -value : value;
}

/* ── 通向 1971 年之后的十进制英镑 ─────────────────── */

/**
 * 《1969 年十进制货币法》附表一：不足 2 先令的零头换算成整数新便士。
 * 表格交替向上和向下取整，好让大量条目的误差相互抵消。
 * 1 便士直接不计；6 便士算 3 新便士，而不是精确的 2½。
 */
const SCHEDULE_1 = [
  0, 0, 1, 1, 2, 2, 3, 3, 3, 4, 4, 5, //  0d ‥ 11d
  5, 5, 6, 6, 7, 7, 7, 8, 8, 9, 9, 10, // 1s 0d ‥ 1s 11d
] as const;

/**
 * 法定换算：整数新便士。
 * 每满 2 先令记 10 新便士，余下不足 2 先令的部分查附表一。
 * 法寻不在表的管辖范围，截去。
 */
export function toStatutoryNewPence(value: LSD): number {
  const sign = value < 0 ? -1 : 1;
  const wholePence = Math.floor(Math.abs(value) / FARTHINGS_PER_PENNY);
  const florins = Math.floor(wholePence / 24); // 24d = 2s = 整 10 新便士
  const rest = wholePence % 24;
  return sign * (florins * 10 + (SCHEDULE_1[rest] ?? 0));
}

/** 精确新便士，写成分数。1 新便士 = 2.4 旧便士，所以常常不是整数。 */
export function toExactNewPence(value: LSD): { numerator: number; denominator: number } {
  // 新便士 = 法寻 × 100 / 960 = 法寻 × 5 / 48
  const n = value * 5;
  const d = 48;
  const g = gcd(Math.abs(n), d) || 1;
  return { numerator: n / g, denominator: d / g };
}

/** 店头折算：取到最近的半新便士，1971 年柜台就是这么做的。逢半进一。 */
export function toShopHalfNewPence(value: LSD): number {
  // 半新便士 = 法寻 × 5 / 24
  return roundHalfUp(value * 5, 24);
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** 四舍五入到最近整数，逢半远离零。 */
function roundHalfUp(numerator: number, denominator: number): number {
  const sign = numerator < 0 ? -1 : 1;
  const n = Math.abs(numerator);
  return sign * Math.floor((2 * n + denominator) / (2 * denominator));
}

/** 精确新便士的可读写法：7½p、13p、4.583…p 这种。 */
export function formatNewPence(value: LSD): string {
  const { numerator, denominator } = toExactNewPence(value);
  if (denominator === 1) return `${numerator}p`;
  if (denominator === 2) {
    const whole = Math.trunc(numerator / 2);
    const half = Math.abs(numerator % 2) ? '½' : '';
    return `${whole || (numerator < 0 ? '-0' : '0')}${half}p`;
  }
  // 除不尽，给一个截断到三位的近似值，并标明还有后续。
  const approx = (numerator / denominator).toFixed(3).replace(/0+$/, '');
  return `${approx}…p`;
}
