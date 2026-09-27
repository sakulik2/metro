/*
 * 校验重玩难度。
 *
 * 这一套的危险在于：拆脚手架很容易拆成「玩不下去」，或者反过来，
 * 以为拆掉了其实还从别处漏出答案。所以这里钉住三件事：
 *
 *   1 每一档都拿掉了东西，而且是单调递减的（不会第三遍比第二遍容易）
 *   2 每一档都有退路：拆了提示的档必须有对应的提示级别能把信息要回来
 *   3 提示到顶时一定给出可执行的答案，不能只是安慰话
 *
 * 第 2 条是这个脚本真正的理由 —— 少给信息是设计，让人卡死不是。
 */

/*
 * 应用代码必须用动态 import 拿进来。
 *
 * 静态 import 会在任何模块体执行之前统一解析完，所以解析钩子再早也来不及注册；
 * await import 是执行到那一行才解析，钩子这时已经装好了。
 */
import { strict as assert } from 'node:assert';

import './resolve-src.ts';

const booking = await import('../src/game/booking.ts');
const d = await import('../src/game/drawing.ts');
const cleared = await import('../src/state/cleared.ts');

const bad: string[] = [];
const ok = (cond: boolean, msg: string): void => {
  if (!cond) bad.push(msg);
};

/* ── 售票窗口 ─────────────────────────────────── */

const { aidFor, hintLevelOf, hintText, canSettle, rejectionOf, ROUNDS, newGame } = booking;

const TIERS = [0, 1, 2];

// 1 单调：后一档不能比前一档给得多
for (const key of ['due', 'gap']) {
  for (let t = 1; t < TIERS.length; t++) {
    const prev = aidFor(t - 1)[key];
    const cur = aidFor(t)[key];
    ok(!(cur && !prev), `售票 第${t + 1}遍的 ${key} 比上一档更宽松`);
  }
}
ok(aidFor(0).due && aidFor(0).gap, '售票 第一遍必须给全部提示');
ok(!aidFor(1).due && !aidFor(1).gap, '售票 第二遍必须收走该找和差额');
ok(!aidFor(2).fewest === false, '售票 第三遍必须要求最少枚数');
ok(!aidFor(0).fewest && !aidFor(1).fewest, '前两遍不该要求最少枚数');

// 2 退路：拆了 gap 的档，两级提示必须都说得出话
for (const t of [1, 2]) {
  const aid = aidFor(t);
  // 造一个差额不为零的局：托盘里放一枚法寻，几乎不可能正好等于应找金额
  const g = { ...newGame(), stage: 'counting', tray: ['farthing'] };
  const l1 = hintText(g, aid, hintLevelOf(1));
  const l2 = hintText(g, aid, hintLevelOf(2));
  ok(typeof l1 === 'string' && l1.length > 0, `售票 第${t + 1}遍 一级提示是空的`);
  ok(typeof l2 === 'string' && l2.length > 0, `售票 第${t + 1}遍 二级提示是空的`);
  // 3 二级必须给数，不能只说方向
  ok(/\d/.test(l2), `售票 第${t + 1}遍 二级提示没给出具体数目：${l2}`);
  ok(l1 !== l2, `售票 第${t + 1}遍 两级提示一模一样，等于只有一级`);
}

// 第一遍不需要提示按钮（托盘一直在报差），但 hintText 也不该崩
ok(hintText({ ...newGame(), stage: 'counting', tray: [] }, aidFor(0), 0) === null,
  '售票 0 级提示应当什么都不显示');

// 交割门槛：金额对但枚数不对，第三档要拦下来并说明白
const exactRound = ROUNDS[1]; // 头等 6d 付先令，应找 6d
ok(exactRound !== undefined, '找不到第二位乘客，测试前提变了');
{
  const g = { ...newGame(), stage: 'counting', round: 1, tray: ['threepence', 'threepence'] };
  ok(canSettle(g, aidFor(1)), '第二遍 两枚三便士凑够 6d 应当能交');
  ok(!canSettle(g, aidFor(2)), '第三遍 两枚三便士不是最少枚数，应当交不成');
  const why = rejectionOf(g, aidFor(2));
  ok(typeof why === 'string' && /\d/.test(why),
    `第三遍 拦下来却没说清最少几枚：${why}`);
  // 金额不对时说的必须是钱不对，不能说枚数
  const short = { ...g, tray: ['threepence'] };
  const why2 = rejectionOf(short, aidFor(2));
  ok(typeof why2 === 'string' && !/枚/.test(why2),
    `金额不够时却在说枚数，会让人回去白验算：${why2}`);
}

/* ── 绘图板 ───────────────────────────────────── */

for (const key of ['bearing', 'ghost'] as const) {
  for (let t = 1; t < TIERS.length; t++) {
    ok(!(d.aidFor(t)[key] && !d.aidFor(t - 1)[key]),
      `绘图 第${t + 1}遍的 ${key} 比上一档更宽松`);
  }
}
ok(d.aidFor(0).bearing && d.aidFor(0).ghost, '绘图 第一遍必须给读数和影线');
ok(!d.aidFor(1).bearing && d.aidFor(1).ghost, '绘图 第二遍收走读数，留影线');
ok(!d.aidFor(2).bearing && !d.aidFor(2).ghost, '绘图 第三遍两样都收走');

// 退路：每一段、每一级都要说得出话，二级必须给出方向
for (const [i, leg] of d.LEGS.entries()) {
  const l1 = d.hintText(leg, d.hintLevelOf(1));
  const l2 = d.hintText(leg, d.hintLevelOf(2));
  ok(/\d/.test(l1 ?? ''), `绘图 第${i + 1}段 一级提示没给读数`);
  ok((l2 ?? '').includes(d.DIR_NAME[leg.snap]),
    `绘图 第${i + 1}段 二级提示没说出正解方向：${l2}`);
}
ok(d.hintText(d.LEGS[0], 0) === null, '绘图 0 级提示应当什么都不显示');

// 提示次数在画下一段和擦回去时都要归零，否则一次提示会一直挂着
{
  const b0 = d.newBoard();
  const asked = d.draw(b0, { type: 'hint' });
  ok(asked.hintsUsed === 1, '绘图 要提示没记上');
  ok(d.draw(asked, { type: 'hint' }).hintsUsed === 2, '绘图 二级提示要不到');
  ok(d.draw(d.draw(asked, { type: 'hint' }), { type: 'hint' }).hintsUsed === 2,
    '绘图 提示级别没有封顶');
  const drew = d.draw(asked, { type: 'draw', dir: d.LEGS[0].snap });
  ok(drew.hintsUsed === 0, '绘图 画下一段后提示次数没归零');
  ok(d.draw(drew, { type: 'undo' }).hintsUsed === 0, '绘图 擦回去后提示次数没归零');
}

/* ── 通关计数 ─────────────────────────────────── */

ok(cleared.tierOf(0) === 0 && cleared.tierOf(1) === 1 && cleared.tierOf(2) === 2,
  'tierOf 的档位不对');
ok(cleared.tierOf(9) === 2, 'tierOf 没有封顶在 2');

// 没有 localStorage 的环境（Node 里就是）必须当作第一遍，而不是抛异常
assert.doesNotThrow(() => cleared.readCleared(), 'readCleared 在没有 localStorage 时抛了');
ok(Object.keys(cleared.readCleared()).length === 0,
  '没有 localStorage 时应当返回空表');
ok(cleared.tierFor('booking') === 0, '读不到进度时应当当作第一遍');
assert.doesNotThrow(() => cleared.markCleared('booking'), 'markCleared 在没有 localStorage 时抛了');

/* ── 结果 ─────────────────────────────────────── */

if (bad.length) {
  console.error('重玩难度有问题：\n');
  for (const m of bad) console.error(`  · ${m}`);
  process.exit(1);
}

const n = d.LEGS.length;
console.log(
  `难度档位没问题：三档逐层收紧，每一档都有两级退路（绘图 ${n} 段、售票 ${ROUNDS.length} 位乘客）。`,
);
