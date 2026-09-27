/**
 * 通关次数，存在 localStorage 里。
 *
 * 这是整个项目唯一的持久化，服务两件事：第二遍开始拆掉脚手架，同时换内容。
 *
 * 两件都要做。只拆提示的话，第二遍考的是记住那几个答案，不是算出来；
 * 只换内容的话，脚手架还在旁边撑着。史实本身不为此让步 —— 票价是查过的，
 * 换的是买几张和递什么钱；线是真实的线，所以第二条线意味着真的去查一条。
 * 这两条由 check:tiers 钉着。
 *
 * 读写全部包 try/catch：隐私模式下访问 localStorage 会直接抛异常，
 * 存储被清掉或禁掉时也读不到。任何一种失败都当作第一遍，界面照常能玩 ——
 * 拿不到进度只该让人少一层难度，不该让人看白屏。
 */

const KEY = 'metro:cleared';

export type Cleared = Record<string, number>;

/** 这一关玩到第几遍的难度。0 = 第一遍，带全部提示。 */
export type Tier = 0 | 1 | 2;

/**
 * 这一关玩过几遍（0 = 头一遍）。
 *
 * 和 tierFor 的区别：这个数不封顶，因为内容要按它循环 ——
 * 难度到第三档就到顶了，内容还得接着换，否则第四遍又回到第一批乘客。
 */
export const runFor = (game: string): number => readCleared()[game] ?? 0;

/** 难度到第 2 档就封顶：再往上没有能拆的提示了。 */
export const tierOf = (cleared: number): Tier =>
  cleared >= 2 ? 2 : cleared >= 1 ? 1 : 0;

export function readCleared(): Cleared {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    // 逐个字段核对：这份数据在用户机器上，可能被手改过，也可能是旧版本写的
    const out: Cleared = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v);
    }
    return out;
  } catch {
    return {};
  }
}

/** 某一关的难度档。读不到就是 0。 */
export const tierFor = (game: string): Tier => tierOf(readCleared()[game] ?? 0);

/** 通关一次。返回记完之后的次数，存不进去也照样返回递增后的值。 */
export function markCleared(game: string): number {
  const now = (readCleared()[game] ?? 0) + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readCleared(), [game]: now }));
  } catch {
    // 存不进去就算了：这一局的难度已经生效，只是下次记不住
  }
  return now;
}

/**
 * 直接把某一关的次数设成 n。
 *
 * 给 /test 面板用，测三个档位不必真玩三遍。也是玩家卡在第三档时的退路：
 * 难度是攒出来的，得有办法退回去。
 */
export function setCleared(game: string, n: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readCleared(), [game]: Math.max(0, n) }));
  } catch {
    // 同上
  }
}

/** 清空。目前只有 /test 面板用得上。 */
export function forgetCleared(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 同上
  }
}
