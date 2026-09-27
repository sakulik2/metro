import { FARTHINGS_PER_POUND, lsd, type LSD } from './lsd';

/**
 * 1863 年售票窗口抽屉里会有的硬币。
 *
 * diameter 是真实直径（毫米），用来按真实比例画。
 * 这一列数字本身就是本关要讲的事：银三便士 16mm 比青铜法寻 20mm 还小，
 * 却值它 12 倍 —— 面值和大小没有关系，全看成色。
 *
 * 尺寸来源：Chard《British Pre-Decimal Coin Specifications》与 GENUKI
 * 《British Coins 1816–2000》。1860 年铜改青铜是分界线，这里取青铜期数值。
 */
export type Coin = {
  /** 唯一键，也用作 React key。 */
  id: string;
  /** 硬币在柜台上怎么称呼。 */
  name: string;
  /** 票价表上的写法：¼d、6d、2/6。 */
  mark: string;
  value: LSD;
  /** 真实直径，毫米。 */
  diameter: number;
  metal: 'bronze' | 'silver';
};

export const COINS: Coin[] = [
  { id: 'farthing',   name: '法寻',   mark: '¼d', value: lsd(0, 0, 0, 1), diameter: 20, metal: 'bronze' },
  { id: 'halfpenny',  name: '半便士', mark: '½d', value: lsd(0, 0, 0, 2), diameter: 25, metal: 'bronze' },
  { id: 'penny',      name: '便士',   mark: '1d', value: lsd(0, 0, 1),    diameter: 31, metal: 'bronze' },
  { id: 'threepence', name: '三便士', mark: '3d', value: lsd(0, 0, 3),    diameter: 16, metal: 'silver' },
  { id: 'sixpence',   name: '六便士', mark: '6d', value: lsd(0, 0, 6),    diameter: 19, metal: 'silver' },
  { id: 'shilling',   name: '先令',   mark: '1/-', value: lsd(0, 1),      diameter: 24, metal: 'silver' },
  { id: 'florin',     name: '弗罗林', mark: '2/-', value: lsd(0, 2),      diameter: 29, metal: 'silver' },
  { id: 'halfcrown',  name: '半克朗', mark: '2/6', value: lsd(0, 2, 6),   diameter: 32, metal: 'silver' },
  { id: 'crown',      name: '克朗',   mark: '5/-', value: lsd(0, 5),      diameter: 39, metal: 'silver' },
];

export const coinById = (id: string): Coin | undefined =>
  COINS.find((c) => c.id === id);

/** 一把硬币加起来多少钱。 */
export const sumCoins = (ids: string[]): LSD =>
  ids.reduce((total, id) => total + (coinById(id)?.value ?? 0), 0);

/**
 * 用最少的硬币凑出一个金额。
 *
 * **不能用贪心。** 这套币制里贪心会给出错的答案，因为半克朗（30d）不是
 * 弗罗林（24d）的整数倍 —— 先拿走半克朗就再也凑不回最省的组合。
 * 最明显的例子是 4s 0d：贪心拿 半克朗+先令+六便士 三枚，
 * 其实两枚弗罗林就够。整个一镑范围内有 96 个金额贪心都会多算一枚，
 * 全部落在 4s–4s 11¾d 这一段。
 *
 * 这不只是显示问题：第三档要求最少枚数才能交，贪心会把玩家凑对的
 * 两枚判成不合格，逼他去凑一个更差的答案。
 *
 * 所以改用完全背包：dp[n] = 凑出 n 法寻最少几枚。金额上限是一镑
 * （960 法寻），表很小，import 时算一次就够。返回 null 表示凑不出来
 * （本游戏不会发生，有法寻在，任何整数金额都凑得出）。
 */
const MAX_FARTHINGS = FARTHINGS_PER_POUND;

/** dp[n] = 凑出 n 法寻最少几枚；from[n] = 那一步用掉哪一枚。 */
const { best, from } = (() => {
  const best = new Array<number>(MAX_FARTHINGS + 1).fill(Infinity);
  const from = new Array<string | null>(MAX_FARTHINGS + 1).fill(null);
  best[0] = 0;
  for (let n = 1; n <= MAX_FARTHINGS; n++) {
    for (const coin of COINS) {
      if (coin.value > n) continue;
      const prev = best[n - coin.value];
      if (prev !== undefined && prev + 1 < (best[n] ?? Infinity)) {
        best[n] = prev + 1;
        from[n] = coin.id;
      }
    }
  }
  return { best, from };
})();

export function fewestCoins(amount: LSD): string[] | null {
  if (amount < 0 || !Number.isInteger(amount)) return null;
  if (amount === 0) return [];
  if (amount > MAX_FARTHINGS) return null;
  if (best[amount] === Infinity) return null;

  const picked: string[] = [];
  let rest = amount;
  while (rest > 0) {
    const id = from[rest];
    if (!id) return null;
    picked.push(id);
    rest -= coinById(id)?.value ?? 0;
  }
  // 大面值在前，和钱屉的读法一致
  return picked.sort((a, b) => (coinById(b)?.value ?? 0) - (coinById(a)?.value ?? 0));
}

/** 同一种硬币拿了几枚，用来在托盘上叠着显示。 */
export function tally(ids: string[]): { coin: Coin; count: number }[] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return COINS.filter((c) => counts.has(c.id)).map((coin) => ({
    coin,
    count: counts.get(coin.id) ?? 0,
  }));
}
