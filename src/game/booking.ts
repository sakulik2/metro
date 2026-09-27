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
  /**
   * 这一位乘客身上按过几次提示。每换一位归零 ——
   * 一位乘客卡住不该让后面几位都跟着降难度。
   */
  hintsUsed: number;
  /**
   * 交上去被退回来了。
   *
   * 第二遍起「交给乘客」不再按金额禁用 —— 按钮一亮就等于宣布算对了，
   * 那是和实时报差一样的泄露。所以照交，由乘客数完退回来，
   * 这也是真实窗口前会发生的事。
   */
  rejected: boolean;
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
  hintsUsed: 0,
  rejected: false,
});

export type Move =
  | { type: 'begin' }
  | { type: 'put'; coin: string }
  | { type: 'take' }
  | { type: 'clear' }
  | { type: 'hint' }
  /** aid 决定交得成不成：第三档还要看枚数。 */
  | { type: 'settle'; aid: Aid }
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

/* ── 第二遍开始拆脚手架 ─────────────────────────── */

/**
 * 每一档拿掉什么。
 *
 * 0  写明该找多少，托盘实时报「还差 9d」        —— 第一遍：照着凑
 * 1  不写该找多少，托盘只报自己有多少          —— 十二进制减法自己做
 * 2  同上，且必须最少枚数才能交给乘客          —— 还得挑对硬币
 *
 * 票价、乘客给的钱、九枚硬币全都没动 —— 那些是查证过的史实，没有第二组可换。
 * 难度只来自少给提示，而这一关要练的本来就是那道减法，第一遍是我替玩家做了。
 */
export type Aid = {
  /** 票价单上「该找」那一行。 */
  due: boolean;
  /** 托盘下面报「还差 9d / 多了 3d」。关掉就只报托盘里有多少。 */
  gap: boolean;
  /** 必须最少枚数才能交。 */
  fewest: boolean;
};

export const aidFor = (tier: 0 | 1 | 2): Aid => ({
  due: tier === 0,
  gap: tier === 0,
  fewest: tier === 2,
});

/**
 * 卡住了怎么办。
 *
 * 拆掉实时报差之后，算错的玩家会发现自己无路可走 —— 那不是难度，是墙。
 * 所以给一条退路，但分两步，而且是玩家自己按的：
 *
 *   1 次  只说方向：多了还是少了。够让人回去重算，不替人算。
 *   2 次  说出差多少，等于把第一遍那行提示买回来。
 *
 * 分两步的理由：一步到位的「看答案」会被立刻按下去，这一档就白设了；
 * 先只给方向，大多数情况下已经足够 —— 十二进制减法算错，通常错在借位的方向。
 */
export type HintLevel = 0 | 1 | 2;

/** 玩家按过几次提示，就给到哪一级。两次到顶。 */
export const hintLevelOf = (used: number): HintLevel =>
  used >= 2 ? 2 : used >= 1 ? 1 : 0;

/**
 * 提示说什么。level 0 不显示。
 *
 * 金额正确但枚数不对时（只有第三档会遇到）单独说，否则玩家会以为钱算错了，
 * 回去反复验算那道减法 —— 而那道减法其实已经对了。
 */
export function hintText(g: Game, aid: Aid, level: HintLevel): string | null {
  if (level === 0) return null;

  const gap = trayGap(g);

  if (gap === 0) {
    if (aid.fewest && g.tray.length !== fewestCount(g)) {
      return level === 1
        ? '钱数是对的，枚数还不是最少的 —— 试试换成面值更大的。'
        : `钱数对了。最少 ${fewestCount(g)} 枚，你现在 ${g.tray.length} 枚。`;
    }
    return '这就对了，交给乘客吧。';
  }

  if (level === 1) return gap > 0 ? '托盘里多了。' : '托盘里还差一些。';
  return gap > 0 ? `多了 ${format(gap)}。` : `还差 ${format(-gap)}。`;
}

/** 这一档在界面上怎么说。第一遍不提。 */
export const TIER_NOTE: Record<0 | 1 | 2, string | null> = {
  0: null,
  1: '第二遍：不告诉你该找多少了。票价和乘客给的钱都在单子上，减法自己做。',
  2: '第三遍：减法自己做，而且要用最少的枚数 —— 真正的售票员不会数出七枚法寻。',
};

/**
 * 这一局能不能交给乘客。
 *
 * 第三档要求最少枚数。注意仍然先看金额对不对：金额不对时提示的是「还没凑够」，
 * 而不是「枚数不对」，否则玩家会以为自己算错了钱。
 */
export const canSettle = (g: Game, aid: Aid): boolean =>
  isExact(g) && (!aid.fewest || g.tray.length === fewestCount(g));

/**
 * 乘客数完之后说什么。交对了返回 null。
 *
 * 只说「不对」和方向，不说差多少 —— 差多少要按提示才给。
 * 站在窗口前的人会说「这不够」，不会替你算出还差九便士。
 */
export function rejectionOf(g: Game, aid: Aid): string | null {
  if (!isExact(g)) {
    return trayGap(g) > 0
      ? '乘客数了一遍，推回来几枚：「这多了。」'
      : '乘客数了一遍，没有走：「这不够。」';
  }
  if (aid.fewest && g.tray.length !== fewestCount(g)) {
    return `乘客看着手里一把零钱：「数目是对的，能不能少几枚？」（最少 ${fewestCount(g)} 枚）`;
  }
  return null;
}

export function play(g: Game, move: Move): Game {
  switch (move.type) {
    case 'begin':
      return { ...g, stage: 'counting', tray: [] };

    /* 动了托盘就清掉退回提示：那句话说的是上一把钱 */
    case 'put': {
      if (g.stage !== 'counting') return g;
      if (!coinById(move.coin)) return g;
      return { ...g, tray: [...g.tray, move.coin], rejected: false };
    }

    case 'take': {
      if (g.stage !== 'counting' || g.tray.length === 0) return g;
      return { ...g, tray: g.tray.slice(0, -1), rejected: false };
    }

    case 'clear':
      return g.stage === 'counting' ? { ...g, tray: [], rejected: false } : g;

    /*
     * 要提示。两次到顶，再按不动。
     *
     * 同时清掉 rejected：提示比那句退回更有用，而且界面上两者占同一个位置，
     * 不清的话按了提示屏幕毫无变化 —— 那就又是个死胡同。
     */
    case 'hint':
      return g.stage === 'counting' && g.hintsUsed < 2
        ? { ...g, hintsUsed: g.hintsUsed + 1, rejected: false }
        : g;

    /*
     * 交给乘客。
     *
     * aid 得传进来，因为「交得成不成」在第三档还要看枚数。交不成不是无事发生 ——
     * 记 rejected，让乘客把钱退回来并说一句，否则按下去毫无反应就成了坏按钮。
     */
    case 'settle': {
      if (g.stage !== 'counting') return g;
      if (!canSettle(g, move.aid)) return { ...g, rejected: true };
      const clean = g.tray.length === fewestCount(g);
      return {
        ...g,
        stage: 'settled',
        rejected: false,
        cleanRuns: g.cleanRuns + (clean ? 1 : 0),
      };
    }

    case 'nextPassenger': {
      if (g.stage !== 'settled') return g;
      const last = g.round === ROUNDS.length - 1;
      // 提示次数跟着乘客归零
      return last
        ? { ...g, stage: 'decimal', tray: [], hintsUsed: 0 }
        : { ...g, stage: 'counting', round: g.round + 1, tray: [], hintsUsed: 0 };
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
