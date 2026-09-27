import { lsd, type LSD } from './lsd';

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
 * 英国这套币制下贪心是最优的：每一枚都能被更小的若干枚整除地替代，
 * 所以先拿大的永远不会亏。返回 null 表示凑不出来（本游戏不会发生，
 * 因为有法寻，任何金额都凑得出）。
 */
export function fewestCoins(amount: LSD): string[] | null {
  if (amount < 0) return null;
  const picked: string[] = [];
  let rest = amount;
  for (const coin of [...COINS].sort((a, b) => b.value - a.value)) {
    while (rest >= coin.value) {
      rest -= coin.value;
      picked.push(coin.id);
    }
  }
  return rest === 0 ? picked : null;
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
