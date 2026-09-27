import { COINS, coinById, fewestCoins, sumCoins } from '../money/coins';
import { format, parse, type LSD } from '../money/lsd';
import raw from './rounds.json';

/** 一位乘客：要买什么票、递了什么钱。 */
export type Round = {
  id: string;
  who: string;
  asks: string;
  fare: LSD;
  fareNote: string;
  /** 乘客递过来的硬币。 */
  paid: string[];
  /** 找对之后讲给玩家的那一句。 */
  teach: string;
};

/** 十进制日那一关：同一笔钱，四种都说得通的答案。 */
export type DecimalChoice = {
  id: string;
  label: string;
  sub: string;
  why: string;
};

export type DecimalDay = {
  year: number;
  title: string;
  /** 1971 年的站名。1863 年叫 Farringdon Street，1936 年起才叫 Farringdon。 */
  station: string;
  /** 改名的经过，摆在站名底下一行小字。 */
  renamed: string;
  intro: string;
  fare: LSD;
  choices: DecimalChoice[];
  answer: string;
  closing: string;
};

function readRound(r: unknown, i: number): Round {
  if (typeof r !== 'object' || r === null) throw new Error(`第 ${i + 1} 位乘客不是对象`);
  const o = r as Record<string, unknown>;
  for (const k of ['id', 'who', 'asks', 'fare', 'fareNote', 'teach'] as const) {
    if (typeof o[k] !== 'string' || !o[k]) throw new Error(`第 ${i + 1} 位乘客缺 ${k}`);
  }
  const paid = o.paid;
  if (!Array.isArray(paid) || paid.length === 0) throw new Error(`第 ${i + 1} 位乘客没给钱`);
  for (const id of paid) {
    if (typeof id !== 'string' || !coinById(id)) throw new Error(`没有这枚硬币：${String(id)}`);
  }

  const fare = parse(o.fare as string);
  const given = sumCoins(paid as string[]);
  if (given < fare) {
    throw new Error(`第 ${i + 1} 位乘客给的钱不够票价（${format(given)} < ${format(fare)}）`);
  }
  if (fewestCoins(given - fare) === null) {
    throw new Error(`第 ${i + 1} 位乘客的零钱凑不出来：${format(given - fare)}`);
  }

  return {
    id: o.id as string,
    who: o.who as string,
    asks: o.asks as string,
    fare,
    fareNote: o.fareNote as string,
    paid: paid as string[],
    teach: o.teach as string,
  };
}

const src = raw as Record<string, unknown>;

export const STATION = String(src.station ?? '售票');
export const TITLE = String(src.title ?? '');
export const YEAR = Number(src.year ?? 1863);
export const INTRO = String(src.intro ?? '');

export const ROUNDS: Round[] = (src.rounds as unknown[]).map(readRound);

const dd = src.decimalDay as Record<string, unknown>;

export const DECIMAL_DAY: DecimalDay = {
  year: Number(dd.year),
  title: String(dd.title),
  station: String(dd.station),
  renamed: String(dd.renamed),
  intro: String(dd.intro),
  fare: parse(String(dd.fare)),
  choices: (dd.choices as DecimalChoice[]).map((c) => ({
    id: String(c.id),
    label: String(c.label),
    sub: String(c.sub),
    why: String(c.why),
  })),
  answer: String(dd.answer),
  closing: String(dd.closing),
};

if (!DECIMAL_DAY.choices.some((c) => c.id === DECIMAL_DAY.answer)) {
  throw new Error('十进制日那一关的 answer 不在 choices 里');
}

/* ── 玩一局 ─────────────────────────────────────── */

export type Stage = 'brief' | 'counting' | 'settled' | 'decimal' | 'closed';

export type Game = {
  stage: Stage;
  /** 第几位乘客。 */
  round: number;
  /** 玩家从抽屉里拣出来的硬币，按点击顺序。 */
  tray: string[];
  /** 本局是否一次找对（没按过「重来」也没多给少给）。 */
  cleanRuns: number;
  /** 十进制日选了哪个答案。 */
  decimalPick: string | null;
};

/**
 * 开一局。
 *
 * stage 只有测试跳关会传：1971 那两幕在五位乘客之后，不给个入口就得每次
 * 从头数一遍钱。见 src/dev/testRoute.ts。
 */
export const newGame = (stage: Stage = 'brief'): Game => ({
  stage,
  round: stage === 'decimal' || stage === 'closed' ? ROUNDS.length - 1 : 0,
  tray: [],
  cleanRuns: 0,
  decimalPick: null,
});

export type Move =
  | { type: 'begin' }
  | { type: 'put'; coin: string }
  | { type: 'take' }
  | { type: 'clear' }
  | { type: 'settle' }
  | { type: 'nextPassenger' }
  | { type: 'pickDecimal'; choice: string }
  | { type: 'close' }
  | { type: 'restart' };

/** 这一位乘客应该找回多少。 */
export const changeDue = (g: Game): LSD => {
  const r = ROUNDS[g.round];
  if (!r) return 0;
  return sumCoins(r.paid) - r.fare;
};

/** 托盘里现在有多少。 */
export const trayTotal = (g: Game): LSD => sumCoins(g.tray);

/** 托盘和应找金额的差：正数是给多了，负数是还差。 */
export const trayGap = (g: Game): LSD => trayTotal(g) - changeDue(g);

export const isExact = (g: Game): boolean => trayGap(g) === 0;

/** 最少要几枚硬币。找对之后用来夸一句「而且是最少枚数」。 */
export const fewestCount = (g: Game): number =>
  fewestCoins(changeDue(g))?.length ?? 0;

export function play(g: Game, move: Move): Game {
  switch (move.type) {
    case 'begin':
      return { ...g, stage: 'counting', tray: [] };

    case 'put': {
      if (g.stage !== 'counting') return g;
      if (!coinById(move.coin)) return g;
      return { ...g, tray: [...g.tray, move.coin] };
    }

    case 'take': {
      if (g.stage !== 'counting' || g.tray.length === 0) return g;
      return { ...g, tray: g.tray.slice(0, -1) };
    }

    case 'clear':
      return g.stage === 'counting' ? { ...g, tray: [] } : g;

    case 'settle': {
      if (g.stage !== 'counting' || !isExact(g)) return g;
      const clean = g.tray.length === fewestCount(g);
      return {
        ...g,
        stage: 'settled',
        cleanRuns: g.cleanRuns + (clean ? 1 : 0),
      };
    }

    case 'nextPassenger': {
      if (g.stage !== 'settled') return g;
      const last = g.round === ROUNDS.length - 1;
      return last
        ? { ...g, stage: 'decimal', tray: [] }
        : { ...g, stage: 'counting', round: g.round + 1, tray: [] };
    }

    case 'pickDecimal': {
      if (g.stage !== 'decimal' || g.decimalPick !== null) return g;
      return { ...g, decimalPick: move.choice };
    }

    case 'close':
      return g.stage === 'decimal' && g.decimalPick !== null
        ? { ...g, stage: 'closed' }
        : g;

    case 'restart':
      return newGame();
  }
}

/** 抽屉里按面值从小到大排列，和真实钱屉一样。 */
export const DRAWER = [...COINS].sort((a, b) => a.value - b.value);
